import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SKILLS } from "../../core/skills";
import { createServices, type ServiceOptions } from "../services";
import { openStore } from "../store";
import { answerProof, makeClock, SKILL, teachPerfectly, tempDbUrl } from "./helpers";

// F11 Part 1. The Shishya Challenge: one public link for 30–40 school students who join alone on their phones,
// with no teacher in the room. The organiser makes a challenge class; a student opens /join/<token>, says which
// class they are in, gets a random code and is logged in. Every skill is open, proofs are always open and there is
// no wait after a missed proof. Each student is put in group A (practise only) or B (practise + teach the Shishya),
// alternating within each class level from a random start, once, and never changed.

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function fresh(opts: Omit<ServiceOptions, "now"> = {}) {
  const { url, cleanup: rm } = tempDbUrl();
  const counter = { n: 0 };
  const store = await openStore({ url, onRoundTrip: () => void counter.n++ });
  const clock = makeClock();
  const svc = createServices(store, { cooldownHours: 24, ...opts, now: clock.now });
  cleanup = () => {
    store.close();
    rm();
  };
  const trips = async <T>(fn: () => Promise<T>): Promise<{ n: number; out: T }> => {
    counter.n = 0;
    const out = await fn();
    return { n: counter.n, out };
  };
  return { store, svc, clock, trips };
}

type Svc = Awaited<ReturnType<typeof fresh>>["svc"];

const TOKEN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;

async function challenge(svc: Svc, input: Partial<Parameters<Svc["createChallenge"]>[0]> = {}) {
  return svc.createChallenge({ title: "Udgam Shishya Challenge", trial: false, online: true, pin: "123456", ...input });
}

async function joined(svc: Svc, token: string, grade: number) {
  const r = await svc.joinChallenge(token, grade);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

describe("creating a challenge link", () => {
  it("needs the online tick; makes a real challenge class with no students, consent recorded, proofs always open, no wait", async () => {
    const { svc, store } = await fresh();
    await expect(challenge(svc, { online: false })).rejects.toThrow();
    await expect(challenge(svc, { title: "   " })).rejects.toThrow();
    await expect(challenge(svc, { title: "x".repeat(61) })).rejects.toThrow();

    const ch = await challenge(svc);
    expect(ch.joinToken).toMatch(TOKEN);
    expect(ch.pin).toBe("123456");
    expect(ch.recoveryCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/);
    const cls = await svc.getClass(ch.classId);
    expect(cls).toMatchObject({
      mode: "challenge",
      kind: "real",
      title: "Udgam Shishya Challenge",
      joinToken: ch.joinToken,
      aiAllowed: false,
      proofWindowRequired: false,
      proofCooldownHours: 0,
      consentRecordedAt: expect.any(String),
    });
    expect(await store.countStudents(ch.classId)).toBe(0);
    // the teacher opens it with the PIN, like any class
    expect(await svc.verifyTeacherPin(ch.classCode, "123456")).toMatchObject({ ok: true, classId: ch.classId });
    const consent = (await store.listEvents()).filter((e) => e.type === "consent_recorded").map((e) => JSON.parse(e.payloadJson));
    expect(consent).toEqual([{ classId: ch.classId, online: true }]);
  });

  it("a trial run is a test class: never counted for impact", async () => {
    const { svc, store } = await fresh();
    const ch = await challenge(svc, { trial: true });
    expect(await svc.getClass(ch.classId)).toMatchObject({ mode: "challenge", kind: "test" });
    const r = await joined(svc, ch.joinToken, 9);
    const item = await svc.servePracticeItem(r.studentId, SKILL);
    if (!item.ok) throw new Error(item.reason);
    await svc.submitPracticeAnswer(item.itemId, "1000"); // explained by no mistake
    expect(await svc.exportPilotCsv(ch.classId)).toContain("test class: not counted for impact");
    expect(await store.listUnknownErrors(SKILL)).toEqual([]);
  });

  it("every join token is different, and classroom classes have none", async () => {
    const { svc } = await fresh();
    const tokens = new Set<string>();
    for (let i = 0; i < 15; i++) tokens.add((await challenge(svc)).joinToken);
    expect(tokens.size).toBe(15);
    const room = await svc.createClassroom({ grade: 8, section: "B", studentCount: 2, pin: "123456" });
    expect(await svc.getClass(room.classId)).toMatchObject({ mode: "classroom", joinToken: null });
  });
});

describe("joining with the link", () => {
  it("creates a working student: a random code, logged in, every skill open, and the code logs in again later", async () => {
    const { svc } = await fresh();
    const ch = await challenge(svc);
    expect(await svc.challengeByToken(ch.joinToken)).toMatchObject({ classId: ch.classId, classCode: ch.classCode, title: "Udgam Shishya Challenge" });

    const r = await joined(svc, ch.joinToken, 8);
    expect(r.code).toMatch(/^8C-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    expect(r.classCode).toBe(ch.classCode);
    const map = await svc.getSkillMap(r.studentId);
    expect(map.map((s) => s.state)).toEqual(SKILLS.map(() => "OPEN"));
    expect(await svc.studentLogin(ch.classCode, r.code)).toEqual({ ok: true, studentId: r.studentId });
    expect(await svc.getStudentContext(r.studentId)).toMatchObject({ classMode: "challenge", selfGrade: 8, challengeTitle: "Udgam Shishya Challenge" });
  });

  it("the class level is required: 7, 8, 9 or 10 only", async () => {
    const { svc, store } = await fresh();
    const ch = await challenge(svc);
    for (const bad of [0, 6, 11, 8.5, Number.NaN]) {
      expect(await svc.joinChallenge(ch.joinToken, bad), String(bad)).toMatchObject({ ok: false, code: "bad_request" });
    }
    expect(await store.countStudents(ch.classId)).toBe(0);
    for (const grade of [7, 8, 9, 10]) expect((await joined(svc, ch.joinToken, grade)).code.startsWith(`${grade}C-`)).toBe(true);
  });

  it("codes are all different", async () => {
    const { svc, clock } = await fresh();
    const ch = await challenge(svc);
    const codes = new Set<string>();
    for (let i = 0; i < 120; i++) {
      if (i % 50 === 49) clock.advanceMinutes(11);
      codes.add((await joined(svc, ch.joinToken, 7 + (i % 4))).code);
    }
    expect(codes.size).toBe(120);
  });

  it("is impossible with a wrong token, an old classroom class, or a deleted challenge", async () => {
    const { svc, store } = await fresh();
    const ch = await challenge(svc);
    expect(await svc.challengeByToken("ABCDEFGHJKMN")).toBeUndefined();
    expect(await svc.joinChallenge("ABCDEFGHJKMN", 8)).toMatchObject({ ok: false, code: "none" });
    expect(await svc.joinChallenge("", 8)).toMatchObject({ ok: false, code: "none" });
    expect(await svc.joinChallenge(ch.classCode, 8)).toMatchObject({ ok: false, code: "none" });
    // the token in another case is the same link
    expect(await svc.joinChallenge(ch.joinToken.toLowerCase(), 8)).toMatchObject({ ok: true });
    await svc.deleteClass(ch.classId, ch.classCode);
    expect(await svc.joinChallenge(ch.joinToken, 8)).toMatchObject({ ok: false, code: "none" });
    expect(await store.getClassByJoinToken(ch.joinToken)).toBeUndefined();
  });

  it("at most 60 joins per 10 minutes per class: then a polite 'try again in a few minutes'", async () => {
    const { svc, clock } = await fresh();
    const ch = await challenge(svc);
    const other = await challenge(svc);
    for (let i = 0; i < 60; i++) await joined(svc, ch.joinToken, 9);
    expect(await svc.joinChallenge(ch.joinToken, 9)).toMatchObject({ ok: false, code: "busy" });
    // another challenge class is not slowed down
    expect(await svc.joinChallenge(other.joinToken, 9)).toMatchObject({ ok: true });
    clock.advanceMinutes(10);
    clock.advanceMinutes(1);
    expect(await svc.joinChallenge(ch.joinToken, 9)).toMatchObject({ ok: true });
  });

  it("at most 300 students per challenge class", async () => {
    const { svc, store, clock } = await fresh();
    const ch = await challenge(svc);
    for (let i = 0; i < 300; i++) {
      if (i > 0 && i % 60 === 0) clock.advanceMinutes(11);
      await joined(svc, ch.joinToken, 7 + (i % 4));
    }
    clock.advanceMinutes(11);
    expect(await svc.joinChallenge(ch.joinToken, 8)).toMatchObject({ ok: false, code: "full" });
    expect(await store.countStudents(ch.classId)).toBe(300);
  });

  it("a challenge class never needs the teacher: proofs start without a window, a missed proof can be tried again at once", async () => {
    const { svc, store } = await fresh();
    const ch = await challenge(svc);
    const r = await joined(svc, ch.joinToken, 9);
    await teachPerfectly(svc, store, r.studentId);
    expect(await svc.proofStatus(r.studentId, SKILL)).toEqual({ canStart: true });
    const proof = await svc.startProof(r.studentId, SKILL);
    if (!proof.ok) throw new Error(proof.reason);
    expect(await answerProof(svc, store, proof.items.map((i) => i.itemId), 0)).toMatchObject({ finished: true, passed: false });
    expect(await svc.proofStatus(r.studentId, SKILL)).toEqual({ canStart: true });
    // nobody unlocked anything or opened a window
    const types = (await store.listEvents()).map((e) => e.type);
    expect(types).not.toContain("teacher_unlock_class");
    expect(types).not.toContain("proof_window_opened");
    expect(await svc.getStudentContext(r.studentId)).toMatchObject({ aiAllowed: false, proofWindowRequired: false, proofCooldownHours: 0 });
  });

  it("a challenge class keeps its codes: 'Give new codes' is refused (students wrote theirs down at home)", async () => {
    const { svc } = await fresh();
    const ch = await challenge(svc);
    const r = await joined(svc, ch.joinToken, 8);
    await expect(svc.reissueStudentCodes(ch.classId)).rejects.toThrow();
    expect(await svc.studentLogin(ch.classCode, r.code)).toMatchObject({ ok: true });
  });

  it(`a join takes at most 6 round trips`, async () => {
    const { svc, trips } = await fresh();
    const ch = await challenge(svc);
    const { n, out } = await trips(() => svc.joinChallenge(ch.joinToken, 8));
    expect(out.ok).toBe(true);
    expect(n).toBeLessThanOrEqual(6);
  });
});

describe("random groups (A: practise only, B: practise + teach the Shishya)", () => {
  it("alternate within each class level, starting at random once per class", async () => {
    const { svc, store } = await fresh({ random: () => 0.9 }); // this class starts with B
    const ch = await challenge(svc);
    const grades = [7, 7, 9, 7, 9, 9, 7, 10];
    const arms: string[] = [];
    for (const g of grades) arms.push((await store.getChallengeStudent((await joined(svc, ch.joinToken, g)).studentId))!.studyArm!);
    // class 7: B A B A · class 9: B A B · class 10: B
    expect(arms).toEqual(["B", "A", "B", "B", "A", "B", "A", "B"]);
  });

  it("the start is chosen once per class, and every student's group is stored and never changes", async () => {
    const { svc, store } = await fresh({ random: () => 0.1 });
    const ch = await challenge(svc);
    const first = await joined(svc, ch.joinToken, 8);
    const second = await joined(svc, ch.joinToken, 8);
    expect((await store.getChallengeStudent(first.studentId))!.studyArm).toBe("A");
    expect((await store.getChallengeStudent(second.studentId))!.studyArm).toBe("B");
    for (let i = 0; i < 10; i++) await joined(svc, ch.joinToken, 8);
    await svc.studentLogin(ch.classCode, first.code);
    expect(await store.getChallengeStudent(first.studentId)).toMatchObject({ selfGrade: 8, studyArm: "A" });
    // no code ever updates a stored group
    const src = readFileSync(join(__dirname, "..", "store.ts"), "utf8");
    expect(src).not.toMatch(/UPDATE\s+students\s+SET[^`"]*studyArm/i);
  });

  it("are balanced: in every class level the groups differ by at most one", async () => {
    const { svc, store, clock } = await fresh();
    const ch = await challenge(svc);
    const ids: string[] = [];
    for (let i = 0; i < 59; i++) ids.push((await joined(svc, ch.joinToken, [7, 8, 8, 9, 10, 10, 10][i % 7])).studentId);
    clock.advanceMinutes(1);
    const byGrade = new Map<number, { A: number; B: number }>();
    for (const id of ids) {
      const s = (await store.getChallengeStudent(id))!;
      const g = byGrade.get(s.selfGrade!) ?? { A: 0, B: 0 };
      g[s.studyArm!]++;
      byGrade.set(s.selfGrade!, g);
    }
    for (const [grade, g] of byGrade) expect(Math.abs(g.A - g.B), String(grade)).toBeLessThanOrEqual(1);
  });

  it("are never shown to the student as A/B", async () => {
    const { svc } = await fresh();
    const ch = await challenge(svc);
    const r = await joined(svc, ch.joinToken, 8);
    expect(Object.keys(r)).not.toContain("studyArm");
    const ctx = await svc.getStudentContext(r.studentId);
    expect(Object.keys(ctx!)).not.toContain("studyArm");
  });
});

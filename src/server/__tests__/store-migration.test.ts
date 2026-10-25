import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { openStore } from "../store";
import { tempDbUrl } from "./helpers";

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

describe("store migration: mined mistake statuses", () => {
  it("upgrades an older database (draft/approved/rejected) to DRAFT_TESTED/APPROVED/REJECTED, keeping the rows", async () => {
    const tmp = tempDbUrl();
    cleanup = tmp.cleanup;
    const old = createClient({ url: tmp.url });
    await old.executeMultiple(`
      CREATE TABLE minedMistakes (
        id TEXT PRIMARY KEY, skillId TEXT NOT NULL, source TEXT NOT NULL, testsJson TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')), approver TEXT, createdAt TEXT NOT NULL);
      INSERT INTO minedMistakes VALUES ('m1', 's', '{}', '{}', 'draft', NULL, '2026-10-18');
      INSERT INTO minedMistakes VALUES ('m2', 's', '{}', '{}', 'approved', 'teacher', '2026-10-18');
    `);
    old.close();

    const store = await openStore({ url: tmp.url });
    expect((await store.listMinedMistakes("DRAFT_TESTED")).map((m) => m.id)).toEqual(["m1"]);
    expect((await store.listMinedMistakes("APPROVED")).map((m) => m.id)).toEqual(["m2"]);
    expect(await store.decideMinedMistake("m1", "REJECTED", "teacher")).toBe(true);
    expect(await store.getMinedMistake("m1")).toMatchObject({ status: "REJECTED", approver: "teacher" });
    store.close();

    const again = await openStore({ url: tmp.url }); // running the migration twice is safe
    expect((await again.listMinedMistakes("APPROVED")).map((m) => m.id)).toEqual(["m2"]);
    again.close();
  });
});

describe("store migration: proof windows", () => {
  it("adds the proof window columns; classes that already exist do not need a window, new ones do", async () => {
    const tmp = tempDbUrl();
    cleanup = tmp.cleanup;
    const old = createClient({ url: tmp.url });
    await old.executeMultiple(`
      CREATE TABLE classes (
        id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
        section TEXT NOT NULL DEFAULT '', aiAllowed INTEGER NOT NULL CHECK (aiAllowed IN (0, 1)), teacherPinHash TEXT);
      INSERT INTO classes VALUES ('c1', '8B-OLD1', 8, 'B', 1, NULL);
    `);
    old.close();

    const store = await openStore({ url: tmp.url });
    expect(await store.getClass("c1")).toMatchObject({ code: "8B-OLD1", proofWindowRequired: false, proofWindowOpenUntil: null });
    expect(
      await store.insertClass({ id: "c2", code: "8C-NEW1", grade: 8, section: "C", aiAllowed: true, proofWindowRequired: true, proofWindowOpenUntil: null }),
    ).toBe(true);
    expect(await store.getClass("c2")).toMatchObject({ proofWindowRequired: true });
    store.close();

    const again = await openStore({ url: tmp.url }); // running the migration twice is safe
    expect(await again.getClass("c1")).toMatchObject({ proofWindowRequired: false });
    expect(await again.getClass("c2")).toMatchObject({ proofWindowRequired: true });
    again.close();
  });
});

describe("store migration: item source (P1a Paper Mode)", () => {
  it("adds items.source; items that already exist are 'app' and keep working; running twice is safe", async () => {
    const tmp = tempDbUrl();
    cleanup = tmp.cleanup;
    const old = createClient({ url: tmp.url });
    await old.executeMultiple(`
      CREATE TABLE items (
        id TEXT PRIMARY KEY, studentId TEXT NOT NULL, skillId TEXT NOT NULL, version TEXT NOT NULL, seed INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('practice', 'teach', 'proof')),
        format TEXT NOT NULL DEFAULT 'solve' CHECK (format IN ('solve', 'apply')), runId TEXT, mistakeId TEXT,
        paramsJson TEXT NOT NULL, answer TEXT NOT NULL, servedAt TEXT NOT NULL, answeredAt TEXT);
      INSERT INTO items VALUES ('i1', 's1', 'alg.linear.both-sides', '1', 7, 'practice', 'solve', NULL, NULL, '{}', '1', '2026-10-18', NULL);
    `);
    old.close();

    const store = await openStore({ url: tmp.url });
    expect(await store.getItem("i1")).toMatchObject({ id: "i1", kind: "practice", source: "app" });
    store.close();
    const again = await openStore({ url: tmp.url });
    expect(await again.getItem("i1")).toMatchObject({ source: "app" });
    again.close();
  });
});

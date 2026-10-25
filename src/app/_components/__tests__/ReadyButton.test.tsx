import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { hi } from "@/i18n/hi";
import { TeachScreen } from "../../s/teach/[skill]/TeachScreen";
import { ReadyButton } from "../ReadyButton";

// A tap before React has attached its handlers (slow school PC or phone) used to be lost without a word.
// Until the page is ready, such buttons are disabled and say "Loading…". (The server render is exactly what
// a child sees before hydration, so these tests render on the server.)

describe("ReadyButton before the page is ready", () => {
  const html = renderToStaticMarkup(
    <ReadyButton type="button" className="btn btn-primary">
      Start teaching
    </ReadyButton>,
  );

  it("is disabled, busy, and says Loading… next to its own words", () => {
    expect(en["common.loading"]).toBe("Loading…");
    expect(hi["common.loading"]).toBeTruthy();
    expect(html).toMatch(/<button[^>]*\bdisabled=""/);
    expect(html).toMatch(/<button[^>]*aria-busy="true"/);
    expect(html).toMatch(/<button[^>]*data-ready="no"/);
    expect(html).toContain("Start teaching");
    expect(html).toContain("Loading…");
  });

  it("keeps the caller's classes and lets the label wrap at phone width", () => {
    expect(html).toMatch(/class="btn btn-primary flex-wrap"/);
  });

  it("a real screen: 'Start teaching' is disabled with Loading… in the first (server) render", () => {
    const teach = renderToStaticMarkup(<TeachScreen skillId="alg.linear.both-sides" />);
    expect(teach).toMatch(/<button[^>]*disabled=""[^>]*>Start teaching<span[^>]*>Loading…<\/span><\/button>/);
  });
});

describe("every button that needs JavaScript waits for the page", () => {
  const APP = join(__dirname, "..", "..");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return f === "__tests__" ? [] : files(p);
      return f.endsWith(".tsx") ? [p] : [];
    });
  const rel = (p: string) => relative(APP, p).replace(/\\/g, "/");

  // Submit buttons of server-action forms work even before hydration (the browser posts the form to the
  // server action; checked in Edge with JavaScript off), so they stay plain <button>s.
  const SERVER_ACTION_FORMS = [
    "s/StudentLoginForm.tsx", // log in
    "s/home/page.tsx", // log out
    "teacher/CreateClassForm.tsx", // create a class
    "teacher/TeacherPinForm.tsx", // teacher PIN
    "teacher/[class]/ClassBoardView.tsx", // Unlock for class, open / close proofs, give new codes, consent, cooldown
    "teacher/[class]/delete/page.tsx", // Delete this class and all its data
    "teacher/recover/RecoverPinForm.tsx", // Forgot the PIN?
    "tour/StartTourForm.tsx", // Try it as a judge
    "tour/[stop]/page.tsx", // Skip ahead (Judge Tour, stop 3)
  ];

  it("raw <button> appears only in ReadyButton and in server-action forms", () => {
    const withRawButton = files(APP)
      .filter((p) => /<button\b/.test(readFileSync(p, "utf8")))
      .map(rel)
      .sort();
    expect(withRawButton).toEqual(["_components/ReadyButton.tsx", ...SERVER_ACTION_FORMS].sort());
  });

  it("those server-action forms really post to a server action (no onClick / onSubmit needed)", () => {
    for (const f of SERVER_ACTION_FORMS) {
      const src = readFileSync(join(APP, f), "utf8");
      expect(src, f).toMatch(/<form[^>]*\baction=\{/);
      expect(src, f).not.toMatch(/onSubmit=|<button[^>]*onClick=/);
    }
  });
});

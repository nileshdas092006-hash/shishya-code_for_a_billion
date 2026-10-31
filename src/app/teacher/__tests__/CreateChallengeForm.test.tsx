import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/en";

vi.mock("../../actions", () => ({ createChallengeAction: vi.fn() }));
const { CreateChallengeForm } = await import("../CreateChallengeForm");

// F11: "Create a challenge link (online, no classroom)" on the teacher page. It works before the page is ready
// (a plain server-action form), and it cannot be sent without the tick about running it online.

describe("the challenge link form", () => {
  const html = renderToStaticMarkup(<CreateChallengeForm />);
  /** The whole <input …> tag with this name (attributes in any order). */
  const input = (name: string) => html.match(new RegExp(`<input[^>]*\\bname="${name}"[^>]*>`))?.[0] ?? "";

  it("asks for the name students see, a trial-run tick and the required online tick", () => {
    expect(html).toContain(en["create.challenge.title"]);
    expect(input("title")).toMatch(/\brequired=""/);
    expect(input("title")).toMatch(/maxLength="60"/);
    expect(input("trial")).toMatch(/type="checkbox"/);
    expect(input("trial")).not.toMatch(/\brequired/);
    expect(input("online")).toMatch(/type="checkbox"/);
    expect(input("online")).toMatch(/\brequired=""/);
    expect(html).toContain(en["create.challenge.online"]);
  });

  it("its button is a plain submit button (no JavaScript needed)", () => {
    expect(html).toMatch(/<button type="submit"[^>]*>Create the challenge link<\/button>/);
  });
});

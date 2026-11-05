import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/en";

vi.mock("../../actions", () => ({ createChallengeAction: vi.fn() }));
const { CreateChallengeForm } = await import("../CreateChallengeForm");

// F12 Part 2: "Create a challenge link" has a choice of pack: School (the default, as before) or College pack.

describe("the pack choice", () => {
  const html = renderToStaticMarkup(<CreateChallengeForm />);
  const radio = (value: string) => html.match(new RegExp(`<input[^>]*\\bname="pack"[^>]*\\bvalue="${value}"[^>]*>|<input[^>]*\\bvalue="${value}"[^>]*\\bname="pack"[^>]*>`))?.[0] ?? "";

  it("offers School (Classes 7–10) and College pack, with School chosen", () => {
    expect(html).toContain(en["create.challenge.pack"]);
    expect(html).toContain(en["create.challenge.pack.school"]);
    expect(html).toContain(en["create.challenge.pack.college"]);
    expect(en["create.challenge.pack.school"]).toBe("School (Classes 7–10)");
    expect(en["create.challenge.pack.college"]).toBe("College pack");
    expect(radio("school")).toMatch(/type="radio"/);
    expect(radio("school")).toMatch(/checked=""/);
    expect(radio("college")).toMatch(/type="radio"/);
    expect(radio("college")).not.toMatch(/checked=""/);
  });
});

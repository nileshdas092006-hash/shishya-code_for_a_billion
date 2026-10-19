import { notFound, redirect } from "next/navigation";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/en";
import { SetupError } from "@/server/instance";
import { guardPage, LoggedOutNotice, SETUP_MISSING_TEACHER } from "../page-guard";

const html = async (node: Promise<React.ReactNode>) => renderToStaticMarkup(<>{await node}</>);
const setupError = () => new SetupError("SESSION_SECRET", "SESSION_SECRET (32+ characters) must be set in production.");

afterEach(() => vi.restoreAllMocks());

describe("pages that need a login never crash", () => {
  it("a missing server setting shows a friendly page to the child; the real cause goes only to the server log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await html(
      guardPage("student", async () => {
        throw setupError();
      }),
    );
    expect(en["setup.missing"]).toBe("Shishya is not set up yet: the server is missing a setting. Tell your teacher.");
    expect(out).toContain(en["setup.missing"]);
    expect(out).not.toContain("SESSION_SECRET");
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0].join(" "))).toContain("SESSION_SECRET");
  });

  it("teacher pages get the same friendly message, worded for the teacher", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await html(
      guardPage("teacher", async () => {
        throw setupError();
      }),
    );
    expect(out).toContain(SETUP_MISSING_TEACHER);
    expect(out).not.toContain("SESSION_SECRET");
  });

  it("any other server error shows 'Something went wrong' instead of a crash, and is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await html(
      guardPage("student", async () => {
        throw new Error("libsql: connection refused");
      }),
    );
    expect(out).toContain(en["common.error"]);
    expect(out).not.toContain("libsql");
    expect(String(log.mock.calls[0].join(" "))).toContain("connection refused");
  });

  it("lets Next.js handle redirect() and notFound() as usual", async () => {
    await expect(guardPage("student", async () => redirect("/s"))).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    await expect(guardPage("teacher", async () => notFound())).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("renders the page when nothing goes wrong", async () => {
    expect(await html(guardPage("student", async () => <p>skill map</p>))).toBe("<p>skill map</p>");
  });

  it("a child with no valid login is asked to type the codes again, with a link to /s", () => {
    expect(en["login.again"]).toBe("Please type your codes again.");
    const out = renderToStaticMarkup(<LoggedOutNotice />);
    expect(out).toContain(en["login.again"]);
    expect(out).toMatch(/<a[^>]*href="\/s"/);
  });
});

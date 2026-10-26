import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/en";
import { hi } from "@/i18n/hi";
import { SkipAheadForm } from "../SkipAheadForm";
import { StartTourForm } from "../StartTourForm";

// "Try it as a judge" (~6 s live) and "Skip ahead" (~6 s live) showed no sign of work. While the server action
// runs, each button says what is happening and is disabled. Both stay plain server-action forms; the pending
// state comes from React's useFormStatus, which these tests switch on.

const status = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: status.pending, data: null, method: null, action: null }),
}));
afterEach(() => {
  status.pending = false;
});

const button = (html: string) => html.match(/<button[^>]*>.*?<\/button>/)![0];

describe("pending state of the tour's slow buttons", () => {
  it("the words, in English and Hindi", () => {
    expect(en["tour.starting"]).toBe("Setting up your made-up class…");
    expect(en["tour.skipping"]).toBe("Finishing the teaching…");
    expect(hi["tour.starting"]).toBeTruthy();
    expect(hi["tour.skipping"]).toBeTruthy();
  });

  it("'Try it as a judge': its own words while idle; 'Setting up your made-up class…' and disabled while working", () => {
    const idle = button(renderToStaticMarkup(<StartTourForm />));
    expect(idle).toContain(en["home.tour"]);
    expect(idle).not.toMatch(/disabled/);
    status.pending = true;
    const busy = button(renderToStaticMarkup(<StartTourForm />));
    expect(busy).toContain(en["tour.starting"]);
    expect(busy).not.toContain(en["home.tour"]);
    expect(busy).toMatch(/disabled=""/);
    expect(busy).toMatch(/aria-busy="true"/);
  });

  it("'Skip ahead': its own words while idle; 'Finishing the teaching…' and disabled while working", () => {
    const idle = button(renderToStaticMarkup(<SkipAheadForm />));
    expect(idle).toContain(en["tour.skip"]);
    expect(idle).not.toMatch(/disabled/);
    status.pending = true;
    const busy = button(renderToStaticMarkup(<SkipAheadForm />));
    expect(busy).toContain(en["tour.skipping"]);
    expect(busy).toMatch(/disabled=""/);
  });

  it("both are still plain server-action forms (they work before the page is ready)", () => {
    for (const f of ["StartTourForm.tsx", "SkipAheadForm.tsx"]) {
      const src = readFileSync(join(__dirname, "..", f), "utf8");
      expect(src, f).toMatch(/<form[^>]*\baction=\{/);
      expect(src, f).not.toMatch(/onSubmit=|onClick=/);
      expect(src, f).toMatch(/PendingSubmit/);
    }
  });
});

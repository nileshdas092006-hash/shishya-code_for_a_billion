import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { hi } from "@/i18n/hi";
import { ProofWindow } from "../ClassBoardView";

// The board's proof box when the class needs no proof window. A Judge Tour (sandbox) class has none on purpose,
// so it must not say "made before proof windows" (live bug, 25 Oct): that is only true of real old classes.

const always = { required: false, openUntil: null, minutesLeft: 0 };

describe("proof box for a class with no proof window", () => {
  it("a tour class says proofs are always open in the tour, and what a real class does", () => {
    expect(en["board.proofs.tour"]).toBe("In the tour, proofs are always open. In a real class, the teacher opens them for 15 minutes.");
    expect(hi["board.proofs.tour"]).toBeTruthy();
    const html = renderToStaticMarkup(<ProofWindow classCode="TOUR-K7QM" proof={always} tour />);
    expect(html).toContain(en["board.proofs.tour"]);
    expect(html).not.toContain(en["board.proofs.always"]);
  });

  it("a real class made before proof windows keeps the old note", () => {
    const html = renderToStaticMarkup(<ProofWindow classCode="8B-K7QM" proof={always} tour={false} />);
    expect(html).toContain(en["board.proofs.always"]);
    expect(html).not.toContain(en["board.proofs.tour"]);
  });

  it("a real class with proof windows still shows the open button", () => {
    const html = renderToStaticMarkup(<ProofWindow classCode="8B-K7QM" proof={{ ...always, required: true }} tour={false} />);
    expect(html).toContain(en["board.proofs.open"]);
  });
});

import { describe, expect, it } from "vitest";
import { en } from "../en";
import { hi } from "../hi";

// The login page's two hints: class codes and child codes look alike (8B-K7QM, 8B-R4TX), so each hint has its own
// example and says where that code comes from: the class code from the board, the child's code from their card.

describe("login hints", () => {
  it("the class-code hint has its own example and says it is on the board", () => {
    expect(en["login.classCodeHint"]).toBe("Your teacher writes it on the board, like 8B-K7QM.");
    expect(hi["login.classCodeHint"]).toContain("8B-K7QM");
    for (const text of [en["login.classCodeHint"], hi["login.classCodeHint"]]) expect(text).not.toContain("8B-R4TX");
  });

  it("the child-code hint has a different example and says it is on the child's card", () => {
    expect(en["login.studentCodeHint"]).toBe("Like 8B-R4TX, on your card. Your teacher gives you this.");
    expect(hi["login.studentCodeHint"]).toContain("8B-R4TX");
    expect(hi["login.studentCodeHint"]).toContain("कार्ड");
    for (const text of [en["login.studentCodeHint"], hi["login.studentCodeHint"]]) expect(text).not.toContain("8B-K7QM");
  });
});

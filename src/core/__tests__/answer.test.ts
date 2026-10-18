import { describe, expect, it } from "vitest";
import { parseAnswer } from "../answer";
import { frac } from "../fraction";

describe("parseAnswer", () => {
  it.each([
    ["5", frac(5)],
    ["-5", frac(-5)],
    ["−5", frac(-5)],
    ["5/3", frac(5, 3)],
    ["-7/2", frac(-7, 2)],
    ["10/4", frac(5, 2)],
    ["x = 5", frac(5)],
    ["x=−7/2", frac(-7, 2)],
    ["  X = 2 ", frac(2)],
  ])("reads %j", (text, value) => {
    expect(parseAnswer(text)).toEqual({ ok: true, value });
  });

  it.each(["", "abc", "5/0", "2.5", "5/-3", "x", "x = ", "= 5", "1 2", "9999999"])(
    "rejects %j with a reason and no exception",
    (text) => {
      const r = parseAnswer(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
    },
  );
});

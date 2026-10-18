import { toMistake } from "../minedMistake";
import { linearBothSides } from "../skills/linear-both-sides";

export const toMinedMistakeForTest = () =>
  toMistake(
    {
      id: "divided-by-a",
      label: "Divided by a",
      childLabel: "Divide both sides by the number in front of x in that line.",
      stepType: "divide",
      firstWrongLine: 5,
      lines: { "5": "x = {(d - b) / a}" },
      answerFormula: "(d - b) / a",
    },
    linearBothSides,
  );

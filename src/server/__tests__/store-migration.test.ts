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

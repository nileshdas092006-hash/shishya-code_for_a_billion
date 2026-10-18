import { describe, expect, it } from "vitest";
import { databaseConfig } from "../instance";

describe("database configuration from the environment", () => {
  it("uses the local file data/shishya.db on a laptop when DATABASE_URL is not set", () => {
    expect(databaseConfig({ NODE_ENV: "development" })).toEqual({ url: "file:data/shishya.db", authToken: undefined });
  });

  it("uses DATABASE_URL and DATABASE_AUTH_TOKEN when set (Turso in the cloud)", () => {
    expect(
      databaseConfig({ NODE_ENV: "production", DATABASE_URL: " libsql://shishya-x.turso.io ", DATABASE_AUTH_TOKEN: "tok" }),
    ).toEqual({ url: "libsql://shishya-x.turso.io", authToken: "tok" });
  });

  it("in production, refuses to fall back to a local file (Vercel would lose it)", () => {
    expect(() => databaseConfig({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
    expect(() => databaseConfig({ NODE_ENV: "production", DATABASE_URL: "  " })).toThrow(/DATABASE_URL/);
  });
});

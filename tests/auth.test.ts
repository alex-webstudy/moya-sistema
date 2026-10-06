import { beforeEach, describe, expect, it } from "vitest";
import { checkPassword, createSession, verifySession } from "../src/lib/auth";

describe("auth", () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = "correct horse";
    process.env.SESSION_SECRET = "x".repeat(40);
  });
  it("checks the password", async () => {
    expect(await checkPassword("correct horse")).toBe(true);
    expect(await checkPassword("wrong")).toBe(false);
  });
  it("accepts its own session and rejects tampered or expired ones", async () => {
    const now = Date.now();
    const { value } = await createSession(now);
    expect(await verifySession(value, now)).toBe(true);
    const [exp, sig] = value.split(".");
    expect(await verifySession(`${Number(exp) + 999}.${sig}`, now)).toBe(false);
    expect(await verifySession(value, now + 31 * 86400_000)).toBe(false);
    expect(await verifySession(undefined, now)).toBe(false);
  });
});

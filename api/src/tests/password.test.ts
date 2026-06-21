// api/src/tests/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../auth/password.js";

describe("password", () => {
  it("hashea y verifica correctamente", async () => {
    const hash = await hashPassword("secret123");
    expect(hash).not.toBe("secret123");
    expect(await verifyPassword(hash, "secret123")).toBe(true);
  });

  it("rechaza password incorrecta", async () => {
    const hash = await hashPassword("secret123");
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });
});

// api/src/tests/tokens.test.ts
import { describe, it, expect } from "vitest";
import { signAccessToken, signRefreshToken, verifyAccessToken } from "../auth/tokens.js";

const payload = { sub: "user-1", role: "usuario" as const };

describe("tokens", () => {
  it("firma y verifica access token", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.role).toBe("usuario");
  });

  it("verifyAccessToken rechaza un refresh token", () => {
    const refresh = signRefreshToken(payload);
    expect(() => verifyAccessToken(refresh)).toThrow();
  });
});

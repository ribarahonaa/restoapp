// api/src/tests/authorize.test.ts
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { errorHandler } from "../middleware/error.js";
import { signAccessToken } from "../auth/tokens.js";

function appWithGuard() {
  const app = express();
  app.get("/admin", authenticate, authorize("superadmin"), (_req, res) =>
    res.json({ ok: true })
  );
  app.use(errorHandler);
  return app;
}

describe("authorize", () => {
  it("permite el rol correcto", async () => {
    const token = signAccessToken({ sub: "u1", role: "superadmin" });
    const res = await request(appWithGuard())
      .get("/admin")
      .set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("bloquea rol incorrecto con 403", async () => {
    const token = signAccessToken({ sub: "u1", role: "usuario" });
    const res = await request(appWithGuard())
      .get("/admin")
      .set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("bloquea sin token con 401", async () => {
    const res = await request(appWithGuard()).get("/admin");
    expect(res.status).toBe(401);
  });
});

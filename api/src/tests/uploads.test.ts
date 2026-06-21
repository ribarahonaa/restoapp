import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { resetDb, seedAdminFixture, tokenFor } from "./helpers.js";
import { prisma } from "../prisma.js";

vi.mock("../storage/minio.js", () => ({
  uploadBuffer: vi.fn(async () => "http://localhost:9000/restoapp/admin/fake.jpg"),
}));

let app: import("express").Express;
beforeEach(async () => {
  await resetDb();
  await seedAdminFixture();
  app = (await import("../app.js")).createApp();
});
afterAll(async () => prisma.$disconnect());

describe("POST /admin/uploads", () => {
  it("401 sin token", async () => {
    const res = await request(app).post("/admin/uploads").attach("file", Buffer.from("x"), "a.jpg");
    expect(res.status).toBe(401);
  });

  it("400 si el tipo no es imagen", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .post("/admin/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("x"), { filename: "a.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("201 con imagen válida devuelve url", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .post("/admin/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("fake-bytes"), { filename: "a.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(201);
    expect(res.body.url).toContain("/restoapp/");
  });

  it("400 si el archivo supera 5MB", async () => {
    const token = await tokenFor("general@demo.cl");
    const res = await request(app)
      .post("/admin/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.alloc(6 * 1024 * 1024), { filename: "big.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("file_too_large");
  });
});

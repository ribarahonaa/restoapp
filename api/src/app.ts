import express from "express";
import cors from "cors";
import { authRouter } from "./auth/auth.routes.js";
import { branchesRouter } from "./branches/branches.routes.js";
import { purposesRouter } from "./purposes/purposes.routes.js";
import { adsRouter } from "./ads/ads.routes.js";
import { adminRouter } from "./admin/admin.routes.js";
import { errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/branches", branchesRouter);
  app.use("/purposes", purposesRouter);
  app.use("/ads", adsRouter);
  app.use("/admin", adminRouter);
  app.use(errorHandler);
  return app;
}

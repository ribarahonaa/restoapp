import express from "express";
import cors from "cors";
import { authRouter } from "./auth/auth.routes.js";
import { branchesRouter } from "./branches/branches.routes.js";
import { purposesRouter } from "./purposes/purposes.routes.js";
import { adsRouter } from "./ads/ads.routes.js";
import { adminRouter } from "./admin/admin.routes.js";
import { authenticate } from "./middleware/authenticate.js";
import { favoritesRouter } from "./me/favorites.routes.js";
import { errorHandler } from "./middleware/error.js";
import { env } from "./env.js";

export function createApp() {
  const app = express();
  // Sin CORS_ORIGIN => refleja cualquier origen (dev). Con valor => lista blanca.
  const allowed = env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);
  app.use(cors(allowed?.length ? { origin: allowed, credentials: true } : {}));
  if (!allowed?.length) {
    console.warn("[cors] CORS_ORIGIN sin definir: se permite cualquier origen (no usar en producción)");
  }
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/branches", branchesRouter);
  app.use("/purposes", purposesRouter);
  app.use("/ads", adsRouter);
  app.use("/admin", adminRouter);
  app.use("/me/favorites", authenticate, favoritesRouter);
  app.use(errorHandler);
  return app;
}

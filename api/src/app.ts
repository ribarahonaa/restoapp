import express from "express";
import cors from "cors";
import { authRouter } from "./auth/auth.routes.js";
import { errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use(errorHandler);
  return app;
}

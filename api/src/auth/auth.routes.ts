import { Router } from "express";
import { z } from "zod";
import { registerUser, loginUser } from "./auth.service.js";
import { authenticate } from "../middleware/authenticate.js";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "./tokens.js";
import { HttpError } from "../middleware/error.js";
import { prisma } from "../prisma.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    res.status(201).json(await registerUser(data));
  } catch (e) {
    next(e);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    res.json(await loginUser(data));
  } catch (e) {
    next(e);
  }
});

authRouter.post("/refresh", (req, res, next) => {
  try {
    const token = z.object({ refreshToken: z.string() }).parse(req.body).refreshToken;
    const payload = verifyRefreshToken(token);
    res.json({
      accessToken: signAccessToken({ sub: payload.sub, role: payload.role }),
      refreshToken: signRefreshToken({ sub: payload.sub, role: payload.role }),
    });
  } catch {
    next(new HttpError(401, "invalid_refresh"));
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, email: true, name: true, role: true, preferredLang: true },
    });
    if (!user) throw new HttpError(404, "not_found");
    res.json(user);
  } catch (e) {
    next(e);
  }
});

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

export const profileRouter = Router();

const ME_SELECT = { id: true, email: true, name: true, role: true, preferredLang: true, avatarUrl: true } as const;

profileRouter.patch("/", async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    const user = await prisma.user.update({ where: { id: req.user!.sub }, data: { name }, select: ME_SELECT });
    res.json(user);
  } catch (e) { next(e); }
});

profileRouter.post("/password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw new HttpError(401, "invalid_token");
    if (!(await verifyPassword(user.passwordHash, currentPassword))) throw new HttpError(400, "invalid_password");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    res.status(204).end();
  } catch (e) { next(e); }
});

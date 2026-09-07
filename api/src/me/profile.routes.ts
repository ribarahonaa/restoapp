import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import multer, { MulterError } from "multer";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { uploadBuffer } from "../storage/minio.js";

export const profileRouter = Router();

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err) => {
    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") return next(new HttpError(400, "file_too_large"));
      return next(new HttpError(400, "upload_error"));
    }
    next(err);
  });
}

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

profileRouter.post("/avatar", uploadSingle, async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new HttpError(400, "file_required");
    if (!ALLOWED.has(file.mimetype)) throw new HttpError(400, "invalid_type");
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const key = `avatars/${req.user!.sub}-${randomUUID()}.${ext}`;
    const avatarUrl = await uploadBuffer(file.buffer, file.mimetype, key);
    await prisma.user.update({ where: { id: req.user!.sub }, data: { avatarUrl } });
    res.status(201).json({ avatarUrl });
  } catch (e) { next(e); }
});

profileRouter.delete("/avatar", async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.user!.sub }, data: { avatarUrl: null } });
    res.status(204).end();
  } catch (e) { next(e); }
});

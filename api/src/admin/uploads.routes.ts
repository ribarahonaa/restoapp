import { Router, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { randomUUID } from "node:crypto";
import { uploadBuffer } from "../storage/minio.js";
import { HttpError } from "../middleware/error.js";

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

export const uploadsRouter = Router();

uploadsRouter.post("/", uploadSingle, async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new HttpError(400, "file_required");
    if (!ALLOWED.has(file.mimetype)) throw new HttpError(400, "invalid_type");
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const key = `admin/${req.user!.sub}-${randomUUID()}.${ext}`;
    const url = await uploadBuffer(file.buffer, file.mimetype, key);
    res.status(201).json({ url });
  } catch (e) {
    next(e);
  }
});

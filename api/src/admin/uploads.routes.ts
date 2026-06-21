import { Router } from "express";
import multer from "multer";
import { uploadBuffer } from "../storage/minio.js";
import { HttpError } from "../middleware/error.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const uploadsRouter = Router();

uploadsRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new HttpError(400, "file_required");
    if (!ALLOWED.has(file.mimetype)) throw new HttpError(400, "invalid_type");
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const key = `admin/${req.user!.sub}-${Date.now()}.${ext}`;
    const url = await uploadBuffer(file.buffer, file.mimetype, key);
    res.status(201).json({ url });
  } catch (e) {
    next(e);
  }
});

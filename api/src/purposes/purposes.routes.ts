import { Router } from "express";
import { prisma } from "../prisma.js";

export const purposesRouter = Router();

purposesRouter.get("/", async (_req, res, next) => {
  try {
    const tags = await prisma.purposeTag.findMany({
      select: { slug: true, labelEs: true, labelEn: true, labelPt: true },
      orderBy: { slug: "asc" },
    });
    res.json(tags);
  } catch (e) {
    next(e);
  }
});

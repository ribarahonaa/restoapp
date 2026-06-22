import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";

export const adRequestsRouter = Router();

const listSchema = z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() });

adRequestsRouter.get("/ad-requests", async (req, res, next) => {
  try {
    const { status } = listSchema.parse(req.query);
    const rows = await prisma.adRequest.findMany({
      where: { status: status ?? "pending" },
      orderBy: { createdAt: "desc" },
      include: { business: { select: { id: true, name: true } } },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

async function loadPending(id: string) {
  const r = await prisma.adRequest.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "request_not_found");
  if (r.status !== "pending") throw new HttpError(409, "already_reviewed");
  return r;
}

adRequestsRouter.post("/ad-requests/:id/approve", async (req, res, next) => {
  try {
    const r = await loadPending(req.params.id);
    const updated = await prisma.adRequest.update({
      where: { id: r.id },
      data: { status: "approved", reviewedBy: req.user!.sub, reviewedAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

adRequestsRouter.post("/ad-requests/:id/reject", async (req, res, next) => {
  try {
    const r = await loadPending(req.params.id);
    const updated = await prisma.adRequest.update({
      where: { id: r.id },
      data: { status: "rejected", reviewedBy: req.user!.sub, reviewedAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

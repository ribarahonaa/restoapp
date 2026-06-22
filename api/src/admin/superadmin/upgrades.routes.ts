import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";

export const upgradesRouter = Router();

const listSchema = z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() });

upgradesRouter.get("/upgrade-requests", async (req, res, next) => {
  try {
    const { status } = listSchema.parse(req.query);
    const rows = await prisma.planUpgradeRequest.findMany({
      where: { status: status ?? "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        business: { select: { id: true, name: true } },
        requestedPlan: { select: { id: true, name: true, maxBranches: true, maxPromos: true, maxMenuItems: true } },
      },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

async function loadPending(id: string) {
  const r = await prisma.planUpgradeRequest.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "request_not_found");
  if (r.status !== "pending") throw new HttpError(409, "already_reviewed");
  return r;
}

upgradesRouter.post("/upgrade-requests/:id/approve", async (req, res, next) => {
  try {
    const r = await loadPending(req.params.id);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.business.update({ where: { id: r.businessId }, data: { planId: r.requestedPlanId } });
      return tx.planUpgradeRequest.update({
        where: { id: r.id },
        data: { status: "approved", reviewedBy: req.user!.sub, reviewedAt: new Date() },
      });
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

upgradesRouter.post("/upgrade-requests/:id/reject", async (req, res, next) => {
  try {
    const r = await loadPending(req.params.id);
    const updated = await prisma.planUpgradeRequest.update({
      where: { id: r.id },
      data: { status: "rejected", reviewedBy: req.user!.sub, reviewedAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

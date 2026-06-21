import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { requireBusinessAccess } from "../middleware/ownership.js";

export const requestsRouter = Router();

const upgradeSchema = z.object({
  businessId: z.string().min(1),
  requestedPlanId: z.string().min(1),
  note: z.string().max(1000).nullable().optional(),
});

requestsRouter.post("/upgrade-requests", requireBusinessAccess(), async (req, res, next) => {
  try {
    const d = upgradeSchema.parse(req.body);
    const reqRow = await prisma.planUpgradeRequest.create({
      data: { businessId: d.businessId, requestedPlanId: d.requestedPlanId, note: d.note ?? null, createdBy: req.user!.sub },
    });
    res.status(201).json(reqRow);
  } catch (e) {
    next(e);
  }
});

const adReqSchema = z.object({
  businessId: z.string().min(1),
  branchId: z.string().min(1).nullable().optional(),
  desiredStartsAt: z.string().datetime(),
  desiredEndsAt: z.string().datetime(),
  wantsPopup: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
});

// Acceso a anuncio: con branchId → acceso a ese branch (dueño o sucursal asignada); sin branchId → dueño del business.
async function canRequestAd(user: { sub: string; role: string }, businessId: string, branchId?: string | null) {
  if (user.role === "superadmin") return true;
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true, business: { select: { ownerUserId: true } } } });
    if (!branch || branch.businessId !== businessId) return false;
    if (user.role === "admin_general") return branch.business.ownerUserId === user.sub;
    const link = await prisma.branchAdmin.findUnique({ where: { userId_branchId: { userId: user.sub, branchId } } });
    return !!link;
  }
  if (user.role === "admin_general") {
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerUserId: true } });
    return !!biz && biz.ownerUserId === user.sub;
  }
  return false;
}

requestsRouter.post("/ad-requests", async (req, res, next) => {
  try {
    const d = adReqSchema.parse(req.body);
    const ok = await canRequestAd(req.user!, d.businessId, d.branchId ?? null);
    if (!ok) throw new HttpError(403, "forbidden");
    const reqRow = await prisma.adRequest.create({
      data: {
        businessId: d.businessId,
        branchId: d.branchId ?? null,
        desiredStartsAt: new Date(d.desiredStartsAt),
        desiredEndsAt: new Date(d.desiredEndsAt),
        wantsPopup: d.wantsPopup ?? false,
        note: d.note ?? null,
        createdBy: req.user!.sub,
      },
    });
    res.status(201).json(reqRow);
  } catch (e) {
    next(e);
  }
});

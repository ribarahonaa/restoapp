import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";
import { env } from "../../env.js";

export const adsRouter = Router();

const createSchema = z.object({
  businessId: z.string().min(1),
  branchId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  placement: z.enum(["section", "popup"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  active: z.boolean().optional(),
});

adsRouter.post("/ads", async (req, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const startsAt = new Date(d.startsAt);
    const endsAt = new Date(d.endsAt);
    // Si el anuncio es de una sucursal puntual, debe pertenecer al business indicado.
    if (d.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: d.branchId }, select: { businessId: true } });
      if (!branch || branch.businessId !== d.businessId) throw new HttpError(400, "branch_business_mismatch");
    }
    if (d.placement === "popup") {
      // Cuenta popups activos cuyo rango se solapa con [startsAt, endsAt].
      const overlapping = await prisma.ad.count({
        where: { placement: "popup", active: true, startsAt: { lte: endsAt }, endsAt: { gte: startsAt } },
      });
      if (overlapping >= env.MAX_POPUPS_PER_DAY) throw new HttpError(403, "popup_quota_full");
    }
    const ad = await prisma.ad.create({
      data: {
        businessId: d.businessId, branchId: d.branchId ?? null, title: d.title,
        description: d.description ?? null, imageUrl: d.imageUrl ?? null, placement: d.placement,
        startsAt, endsAt, active: d.active ?? true, createdBy: req.user!.sub,
      },
    });
    res.status(201).json(ad);
  } catch (e) {
    next(e);
  }
});

adsRouter.get("/ads", async (_req, res, next) => {
  try {
    const ads = await prisma.ad.findMany({
      orderBy: { createdAt: "desc" },
      include: { business: { select: { id: true, name: true } } },
    });
    res.json(ads);
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

adsRouter.patch("/ads/:id", async (req, res, next) => {
  try {
    const d = updateSchema.parse(req.body);
    const exists = await prisma.ad.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "ad_not_found");
    const ad = await prisma.ad.update({
      where: { id: req.params.id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl } : {}),
        ...(d.startsAt !== undefined ? { startsAt: new Date(d.startsAt) } : {}),
        ...(d.endsAt !== undefined ? { endsAt: new Date(d.endsAt) } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    res.json(ad);
  } catch (e) {
    next(e);
  }
});

adsRouter.delete("/ads/:id", async (req, res, next) => {
  try {
    const exists = await prisma.ad.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "ad_not_found");
    await prisma.ad.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

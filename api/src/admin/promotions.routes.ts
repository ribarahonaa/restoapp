import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { planLimitFor } from "./owner.service.js";

export const promotionsRouter = Router({ mergeParams: true });

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  active: z.boolean().optional(),
});
const updateSchema = createSchema.partial();

promotionsRouter.post("/", async (req, res, next) => {
  try {
    const branchId = (req.params as unknown as { branchId: string }).branchId;
    const { max, count } = await planLimitFor(branchId, "promos");
    if (max != null && count >= max) throw new HttpError(403, "plan_limit_promos");
    const d = createSchema.parse(req.body);
    const promo = await prisma.promotion.create({
      data: { branchId, title: d.title, description: d.description, imageUrl: d.imageUrl, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), active: d.active ?? true },
    });
    res.status(201).json(promo);
  } catch (e) {
    next(e);
  }
});

promotionsRouter.patch("/:promoId", async (req, res, next) => {
  try {
    const branchId = (req.params as unknown as { branchId: string }).branchId;
    const existing = await prisma.promotion.findUnique({ where: { id: req.params.promoId } });
    if (!existing || existing.branchId !== branchId) throw new HttpError(404, "promo_not_found");
    const d = updateSchema.parse(req.body);
    const promo = await prisma.promotion.update({
      where: { id: existing.id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl } : {}),
        ...(d.startsAt !== undefined ? { startsAt: new Date(d.startsAt) } : {}),
        ...(d.endsAt !== undefined ? { endsAt: new Date(d.endsAt) } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    res.json(promo);
  } catch (e) {
    next(e);
  }
});

promotionsRouter.delete("/:promoId", async (req, res, next) => {
  try {
    const branchId = (req.params as unknown as { branchId: string }).branchId;
    const existing = await prisma.promotion.findUnique({ where: { id: req.params.promoId } });
    if (!existing || existing.branchId !== branchId) throw new HttpError(404, "promo_not_found");
    await prisma.promotion.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

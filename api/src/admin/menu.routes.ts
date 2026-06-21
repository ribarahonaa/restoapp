import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { planLimitFor } from "./owner.service.js";

export const menuRouter = Router({ mergeParams: true });

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().nonnegative(),
  category: z.string().max(60).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});
const updateSchema = createSchema.partial();

menuRouter.post("/", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const { max, count } = await planLimitFor(branchId, "menu");
    if (max != null && count >= max) throw new HttpError(403, "plan_limit_menu");
    const data = createSchema.parse(req.body);
    const item = await prisma.menuItem.create({ data: { ...data, branchId } });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

menuRouter.patch("/:itemId", async (req, res, next) => {
  try {
    const branchId = (req.params as unknown as { branchId: string }).branchId;
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing || existing.branchId !== branchId) throw new HttpError(404, "item_not_found");
    const data = updateSchema.parse(req.body);
    const item = await prisma.menuItem.update({ where: { id: existing.id }, data });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

menuRouter.delete("/:itemId", async (req, res, next) => {
  try {
    const branchId = (req.params as unknown as { branchId: string }).branchId;
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing || existing.branchId !== branchId) throw new HttpError(404, "item_not_found");
    await prisma.menuItem.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

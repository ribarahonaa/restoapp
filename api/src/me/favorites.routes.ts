// api/src/me/favorites.routes.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

export const favoritesRouter = Router();

favoritesRouter.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.favoriteBranch.findMany({ where: { userId: req.user!.sub }, select: { branchId: true }, orderBy: { createdAt: "desc" } });
    res.json(rows.map((r) => r.branchId));
  } catch (e) { next(e); }
});

favoritesRouter.post("/merge", async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string()).max(500) }).parse(req.body);
    const valid = await prisma.branch.findMany({ where: { id: { in: ids } }, select: { id: true } });
    await prisma.favoriteBranch.createMany({
      data: valid.map((b) => ({ userId: req.user!.sub, branchId: b.id })), skipDuplicates: true,
    });
    const rows = await prisma.favoriteBranch.findMany({ where: { userId: req.user!.sub }, select: { branchId: true } });
    res.json(rows.map((r) => r.branchId));
  } catch (e) { next(e); }
});

favoritesRouter.post("/:branchId", async (req, res, next) => {
  try {
    await prisma.favoriteBranch.upsert({
      where: { userId_branchId: { userId: req.user!.sub, branchId: req.params.branchId } },
      update: {}, create: { userId: req.user!.sub, branchId: req.params.branchId },
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

favoritesRouter.delete("/:branchId", async (req, res, next) => {
  try {
    await prisma.favoriteBranch.deleteMany({ where: { userId: req.user!.sub, branchId: req.params.branchId } });
    res.status(204).end();
  } catch (e) { next(e); }
});

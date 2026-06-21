import { Router } from "express";
import { prisma } from "../prisma.js";

export const plansRouter = Router();

plansRouter.get("/", async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { maxBranches: "asc" },
      select: { id: true, name: true, maxPromos: true, maxMenuItems: true, maxBranches: true },
    });
    res.json(plans);
  } catch (e) {
    next(e);
  }
});

import { Router } from "express";
import { z } from "zod";
import { findNearby, getBranchDetail } from "./branches.service.js";

export const branchesRouter = Router();

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50000).default(5000),
  category: z.enum(["bar", "pub", "restaurant", "cafe"]).optional(),
  purpose: z.string().min(1).optional(),
  promo: z.coerce.boolean().optional(),
  open: z.coerce.boolean().optional(),
});

branchesRouter.get("/nearby", async (req, res, next) => {
  try {
    const f = nearbySchema.parse(req.query);
    res.json(await findNearby(f));
  } catch (e) {
    next(e);
  }
});

branchesRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await getBranchDetail(req.params.id));
  } catch (e) {
    next(e);
  }
});

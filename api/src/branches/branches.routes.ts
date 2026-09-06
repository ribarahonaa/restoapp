import { Router } from "express";
import { z } from "zod";
import { findNearby, getBranchDetail, addReview } from "./branches.service.js";

export const branchesRouter = Router();

const boolParam = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  // Radio opcional: sin él se muestran todos los locales, ordenados por cercanía.
  radius: z.coerce.number().positive().max(50000).optional(),
  category: z.enum(["bar", "pub", "restaurant", "cafe"]).optional(),
  purpose: z.string().min(1).optional(),
  promo: boolParam,
  open: boolParam,
  q: z.string().trim().min(1).max(80).optional(),
});

const reviewSchema = z.object({
  authorName: z.string().trim().min(1).max(60),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
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

branchesRouter.post("/:id/reviews", async (req, res, next) => {
  try {
    const body = reviewSchema.parse(req.body);
    res.status(201).json(await addReview(req.params.id, body));
  } catch (e) {
    next(e);
  }
});

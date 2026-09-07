import { Router } from "express";
import { z } from "zod";
import { findNearby, getBranchDetail, addReview } from "./branches.service.js";
import { checkIn, reviewEligibility } from "./presence.js";
import { authenticate } from "../middleware/authenticate.js";

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

const coordsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
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

branchesRouter.post("/:id/checkin", authenticate, async (req, res, next) => {
  try {
    const { lat, lng } = coordsSchema.parse(req.body);
    res.json(await checkIn(req.user!.sub, req.params.id, lat, lng));
  } catch (e) {
    next(e);
  }
});

branchesRouter.get("/:id/review-eligibility", authenticate, async (req, res, next) => {
  try {
    const { lat, lng } = coordsSchema.parse(req.query);
    res.json(await reviewEligibility(req.user!.sub, req.params.id, lat, lng));
  } catch (e) {
    next(e);
  }
});

branchesRouter.post("/:id/reviews", authenticate, async (req, res, next) => {
  try {
    const body = reviewSchema.parse(req.body);
    res.status(201).json(await addReview(req.params.id, req.user!.sub, body));
  } catch (e) {
    next(e);
  }
});

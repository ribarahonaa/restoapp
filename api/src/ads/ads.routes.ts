import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { buildAdsQuery } from "./ads.sql.js";

export const adsRouter = Router();

interface AdRow {
  id: string;
  businessId: string;
  branchId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  distance: number | null;
}

const geoSchema = z.object({ lat: z.coerce.number(), lng: z.coerce.number() });

adsRouter.get("/", async (req, res, next) => {
  try {
    const { lat, lng } = geoSchema.parse(req.query);
    const rows = await prisma.$queryRaw<AdRow[]>(buildAdsQuery(lat, lng, "section", 20));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

adsRouter.get("/popup", async (req, res, next) => {
  try {
    const { lat, lng } = geoSchema.parse(req.query);
    const rows = await prisma.$queryRaw<AdRow[]>(buildAdsQuery(lat, lng, "popup", env.MAX_POPUPS_PER_DAY));
    res.json({ ad: rows[0] ?? null });
  } catch (e) {
    next(e);
  }
});

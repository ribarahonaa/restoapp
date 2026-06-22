import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";
import { hashPassword } from "../../auth/password.js";

export const businessesRouter = Router();

const createSchema = z.object({
  businessName: z.string().min(1).max(120),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(120),
  ownerPassword: z.string().min(8).max(100),
  planId: z.string().optional(),
});

businessesRouter.post("/", async (req, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: d.ownerEmail } });
    if (existing) throw new HttpError(409, "email_taken");
    const result = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: { email: d.ownerEmail, name: d.ownerName, role: "admin_general", passwordHash: await hashPassword(d.ownerPassword) },
      });
      const business = await tx.business.create({
        data: { name: d.businessName, ownerUserId: owner.id, planId: d.planId ?? null },
      });
      return { business, owner };
    });
    res.status(201).json({
      business: result.business,
      owner: { id: result.owner.id, email: result.owner.email, name: result.owner.name, role: result.owner.role },
    });
  } catch (e) {
    next(e);
  }
});

businessesRouter.get("/", async (_req, res, next) => {
  try {
    const businesses = await prisma.business.findMany({
      orderBy: { name: "asc" },
      include: {
        plan: { select: { id: true, name: true, maxBranches: true, maxPromos: true, maxMenuItems: true } },
        owner: { select: { id: true, email: true, name: true } },
        branches: { select: { id: true, name: true, category: true, active: true }, orderBy: { name: "asc" } },
      },
    });
    res.json(businesses);
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({ name: z.string().min(1).max(120).optional(), planId: z.string().nullable().optional() });

businessesRouter.patch("/:id", async (req, res, next) => {
  try {
    const d = updateSchema.parse(req.body);
    const exists = await prisma.business.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "business_not_found");
    const business = await prisma.business.update({ where: { id: req.params.id }, data: d });
    res.json(business);
  } catch (e) {
    next(e);
  }
});

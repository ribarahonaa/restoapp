import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../middleware/error.js";
import { hashPassword } from "../../auth/password.js";

export const accountsRouter = Router();

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(100),
  role: z.enum(["admin_general", "admin_sucursal"]),
});

accountsRouter.post("/users", async (req, res, next) => {
  try {
    const d = userSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: d.email } });
    if (existing) throw new HttpError(409, "email_taken");
    const u = await prisma.user.create({
      data: { email: d.email, name: d.name, role: d.role, passwordHash: await hashPassword(d.password) },
    });
    res.status(201).json({ id: u.id, email: u.email, name: u.name, role: u.role });
  } catch (e) {
    next(e);
  }
});

const branchSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(["bar", "pub", "restaurant", "cafe"]),
  address: z.string().min(1).max(200),
  lat: z.number(),
  lng: z.number(),
  phone: z.string().max(40).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  planId: z.string().nullable().optional(),
});

accountsRouter.post("/businesses/:businessId/branches", async (req, res, next) => {
  try {
    const d = branchSchema.parse(req.body);
    const biz = await prisma.business.findUnique({ where: { id: req.params.businessId }, select: { id: true, planId: true } });
    if (!biz) throw new HttpError(404, "business_not_found");
    const branch = await prisma.branch.create({
      data: {
        businessId: biz.id,
        name: d.name, category: d.category, address: d.address, lat: d.lat, lng: d.lng,
        phone: d.phone ?? null, description: d.description ?? null, imageUrl: d.imageUrl ?? null,
        planId: d.planId ?? biz.planId,
      },
    });
    res.status(201).json(branch);
  } catch (e) {
    next(e);
  }
});

const linkSchema = z.object({ userId: z.string().min(1), branchId: z.string().min(1) });

accountsRouter.post("/branch-admins", async (req, res, next) => {
  try {
    const d = linkSchema.parse(req.body);
    const link = await prisma.branchAdmin.upsert({
      where: { userId_branchId: { userId: d.userId, branchId: d.branchId } },
      update: {},
      create: { userId: d.userId, branchId: d.branchId },
    });
    res.status(201).json(link);
  } catch (e) {
    next(e);
  }
});

const activeSchema = z.object({ active: z.boolean() });

accountsRouter.post("/branches/:id/active", async (req, res, next) => {
  try {
    const { active } = activeSchema.parse(req.body);
    const exists = await prisma.branch.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "branch_not_found");
    const branch = await prisma.branch.update({ where: { id: req.params.id }, data: { active } });
    res.json(branch);
  } catch (e) {
    next(e);
  }
});

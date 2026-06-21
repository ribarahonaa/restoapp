import { Router } from "express";
import { z } from "zod";
import { requireBranchAccess, requireBusinessAccess } from "../middleware/ownership.js";
import { listManagedBranches, getManagedBranch } from "./owner.service.js";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";

export const ownerBranchesRouter = Router();

const createBranchSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(120),
  category: z.enum(["bar", "pub", "restaurant", "cafe"]),
  address: z.string().min(1).max(200),
  lat: z.number(),
  lng: z.number(),
  phone: z.string().max(40).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

ownerBranchesRouter.post("/", requireBusinessAccess(), async (req, res, next) => {
  try {
    const d = createBranchSchema.parse(req.body);
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: d.businessId },
      include: { plan: true, _count: { select: { branches: true } } },
    });
    const max = business.plan?.maxBranches ?? null;
    if (max != null && business._count.branches >= max) throw new HttpError(403, "plan_limit_branches");
    const branch = await prisma.branch.create({
      data: {
        businessId: d.businessId,
        name: d.name,
        category: d.category,
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        phone: d.phone ?? null,
        description: d.description ?? null,
        imageUrl: d.imageUrl ?? null,
        planId: business.planId,
      },
    });
    res.status(201).json(branch);
  } catch (e) {
    next(e);
  }
});

ownerBranchesRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listManagedBranches(req.user!));
  } catch (e) {
    next(e);
  }
});

ownerBranchesRouter.get("/:branchId", requireBranchAccess(), async (req, res, next) => {
  try {
    res.json(await getManagedBranch(req.params.branchId));
  } catch (e) {
    next(e);
  }
});

const editBranchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  category: z.enum(["bar", "pub", "restaurant", "cafe"]).optional(),
  phone: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// PATCH /:branchId — edit branch (admin_general and admin_sucursal)
ownerBranchesRouter.patch("/:branchId", requireBranchAccess(), async (req, res, next) => {
  try {
    const data = editBranchSchema.parse(req.body);
    const updated = await prisma.branch.update({
      where: { id: req.params.branchId },
      data,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /:branchId/active — toggle active flag (admin_general / superadmin only)
ownerBranchesRouter.post("/:branchId/active", requireBranchAccess(), async (req, res, next) => {
  try {
    if (req.user!.role === "admin_sucursal") {
      throw new HttpError(403, "forbidden_role");
    }
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const updated = await prisma.branch.update({
      where: { id: req.params.branchId },
      data: { active },
      select: { id: true, active: true },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /:branchId/close — set closedUntil (both roles)
ownerBranchesRouter.post("/:branchId/close", requireBranchAccess(), async (req, res, next) => {
  try {
    const { until } = z.object({ until: z.string().datetime() }).parse(req.body);
    const updated = await prisma.branch.update({
      where: { id: req.params.branchId },
      data: { closedUntil: new Date(until) },
      select: { id: true, closedUntil: true },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /:branchId/reopen — clear closedUntil (both roles)
ownerBranchesRouter.post("/:branchId/reopen", requireBranchAccess(), async (req, res, next) => {
  try {
    const updated = await prisma.branch.update({
      where: { id: req.params.branchId },
      data: { closedUntil: null },
      select: { id: true, closedUntil: true },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

const hoursSchema = z.object({
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        openTime: z.string().regex(/^\d{2}:\d{2}$/),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .max(21),
});

ownerBranchesRouter.put("/:branchId/hours", requireBranchAccess(), async (req, res, next) => {
  try {
    const { hours } = hoursSchema.parse(req.body);
    const branchId = req.params.branchId;
    await prisma.$transaction([
      prisma.serviceHours.deleteMany({ where: { branchId } }),
      prisma.serviceHours.createMany({ data: hours.map((h) => ({ ...h, branchId })) }),
    ]);
    const fresh = await prisma.serviceHours.findMany({ where: { branchId }, orderBy: { weekday: "asc" } });
    res.json(fresh);
  } catch (e) {
    next(e);
  }
});

import { Router } from "express";
import { z } from "zod";
import { requireBranchAccess } from "../middleware/ownership.js";
import { listManagedBranches, getManagedBranch } from "./owner.service.js";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";

export const ownerBranchesRouter = Router();

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
    const { until } = z.object({ until: z.string() }).parse(req.body);
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

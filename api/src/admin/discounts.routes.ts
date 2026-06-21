import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";

export const discountsRouter = Router({ mergeParams: true });

async function businessIdOf(branchId: string): Promise<string> {
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });
  if (!b) throw new HttpError(404, "branch_not_found");
  return b.businessId;
}

const createSchema = z.object({
  code: z.string().min(1).max(40),
  type: z.enum(["percent", "amount"]),
  value: z.number().nonnegative(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  scope: z.enum(["branch", "chain"]),
});

const updateSchema = z.object({
  code: z.string().min(1).max(40).optional(),
  type: z.enum(["percent", "amount"]).optional(),
  value: z.number().nonnegative().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

discountsRouter.get("/", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const businessId = await businessIdOf(branchId);
    const codes = await prisma.discountCode.findMany({
      where: { businessId, OR: [{ branchId }, { branchId: null }] },
      orderBy: { createdAt: "desc" },
    });
    res.json(codes);
  } catch (e) {
    next(e);
  }
});

discountsRouter.post("/", async (req, res, next) => {
  try {
    const branchId = (req.params as { branchId: string }).branchId;
    const d = createSchema.parse(req.body);
    if (d.scope === "chain" && req.user!.role === "admin_sucursal") throw new HttpError(403, "forbidden_role");
    const businessId = await businessIdOf(branchId);
    const code = await prisma.discountCode.create({
      data: {
        businessId,
        branchId: d.scope === "chain" ? null : branchId,
        code: d.code,
        type: d.type,
        value: d.value,
        startsAt: new Date(d.startsAt),
        endsAt: new Date(d.endsAt),
      },
    });
    res.status(201).json(code);
  } catch (e) {
    next(e);
  }
});

async function loadOwnedCode(branchId: string, codeId: string, userRole: string) {
  const businessId = await businessIdOf(branchId);
  const code = await prisma.discountCode.findUnique({ where: { id: codeId } });
  if (!code || code.businessId !== businessId) throw new HttpError(404, "code_not_found");
  if (userRole === "admin_sucursal" && code.branchId !== branchId) throw new HttpError(403, "forbidden_role");
  return code;
}

discountsRouter.patch("/:codeId", async (req, res, next) => {
  try {
    const branchId = (req.params as unknown as { branchId: string }).branchId;
    const code = await loadOwnedCode(branchId, req.params.codeId, req.user!.role);
    const d = updateSchema.parse(req.body);
    const updated = await prisma.discountCode.update({
      where: { id: code.id },
      data: {
        ...(d.code !== undefined ? { code: d.code } : {}),
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.value !== undefined ? { value: d.value } : {}),
        ...(d.startsAt !== undefined ? { startsAt: new Date(d.startsAt) } : {}),
        ...(d.endsAt !== undefined ? { endsAt: new Date(d.endsAt) } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

discountsRouter.delete("/:codeId", async (req, res, next) => {
  try {
    const branchId = (req.params as unknown as { branchId: string }).branchId;
    const code = await loadOwnedCode(branchId, req.params.codeId, req.user!.role);
    await prisma.discountCode.delete({ where: { id: code.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

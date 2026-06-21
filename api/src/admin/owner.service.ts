import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";

interface SessionUser {
  sub: string;
  role: string;
}

// Sucursales que el usuario puede gestionar, con límites del plan de la empresa y conteos.
export async function listManagedBranches(user: SessionUser) {
  let where: Record<string, unknown>;
  if (user.role === "superadmin") {
    where = {};
  } else if (user.role === "admin_general") {
    where = { business: { ownerUserId: user.sub } };
  } else {
    where = { admins: { some: { userId: user.sub } } };
  }
  const branches = await prisma.branch.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      business: { select: { id: true, name: true, plan: true } },
      _count: { select: { menuItems: true, promotions: true } },
    },
  });
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    address: b.address,
    active: b.active,
    closedUntil: b.closedUntil,
    imageUrl: b.imageUrl,
    businessId: b.business.id,
    businessName: b.business.name,
    plan: b.business.plan
      ? { maxPromos: b.business.plan.maxPromos, maxMenuItems: b.business.plan.maxMenuItems, maxBranches: b.business.plan.maxBranches }
      : null,
    counts: { menuItems: b._count.menuItems, promotions: b._count.promotions },
  }));
}

// Detalle editable de una sucursal (datos + horarios + menú + promos + descuentos vigentes/no).
export async function getManagedBranch(branchId: string) {
  const b = await prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      hours: { orderBy: { weekday: "asc" } },
      menuItems: { orderBy: { updatedAt: "desc" } },
      promotions: { orderBy: { updatedAt: "desc" } },
      discountCodes: { orderBy: { createdAt: "desc" } },
      business: { select: { id: true, name: true, plan: true } },
    },
  });
  if (!b) throw new HttpError(404, "branch_not_found");
  return b;
}

// Límite del plan de la empresa para un recurso + conteo actual de la sucursal.
export async function planLimitFor(branchId: string, kind: "menu" | "promos") {
  const b = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      business: { select: { plan: { select: { maxMenuItems: true, maxPromos: true } } } },
      _count: { select: { menuItems: true, promotions: true } },
    },
  });
  if (!b) throw new HttpError(404, "branch_not_found");
  const plan = b.business.plan;
  if (kind === "menu") return { max: plan?.maxMenuItems ?? null, count: b._count.menuItems };
  return { max: plan?.maxPromos ?? null, count: b._count.promotions };
}

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma.js";
import { HttpError } from "./error.js";

// Permite continuar solo si el usuario puede gestionar el branch indicado en params.
export function requireBranchAccess(param = "branchId") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw new HttpError(401, "unauthenticated");
      const branchId = req.params[param];
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, business: { select: { ownerUserId: true } } },
      });
      if (!branch) throw new HttpError(404, "branch_not_found");

      if (user.role === "superadmin") return next();
      if (user.role === "admin_general" && branch.business.ownerUserId === user.sub) return next();
      if (user.role === "admin_sucursal") {
        const link = await prisma.branchAdmin.findUnique({
          where: { userId_branchId: { userId: user.sub, branchId } },
        });
        if (link) return next();
      }
      throw new HttpError(403, "forbidden");
    } catch (e) {
      next(e);
    }
  };
}

// Permite continuar solo si el usuario puede gestionar el business indicado (params o body).
export function requireBusinessAccess(param = "businessId") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw new HttpError(401, "unauthenticated");
      const businessId = req.params[param] ?? (req.body as Record<string, string>)?.[param];
      if (!businessId) throw new HttpError(400, "business_required");
      const business = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerUserId: true } });
      if (!business) throw new HttpError(404, "business_not_found");
      if (user.role === "superadmin") return next();
      if (user.role === "admin_general" && business.ownerUserId === user.sub) return next();
      throw new HttpError(403, "forbidden");
    } catch (e) {
      next(e);
    }
  };
}

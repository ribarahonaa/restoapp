import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { HttpError } from "./error.js";

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "unauthenticated"));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, "forbidden"));
    }
    next();
  };
}

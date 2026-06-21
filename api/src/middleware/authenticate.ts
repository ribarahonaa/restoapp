import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type TokenPayload } from "../auth/tokens.js";
import { HttpError } from "./error.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "missing_token"));
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(new HttpError(401, "invalid_token"));
  }
}

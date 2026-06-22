import { Router } from "express";
import { businessesRouter } from "./businesses.routes.js";

export const superadminRouter = Router();

superadminRouter.use("/businesses", businessesRouter);

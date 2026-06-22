import { Router } from "express";
import { businessesRouter } from "./businesses.routes.js";
import { accountsRouter } from "./accounts.routes.js";
import { upgradesRouter } from "./upgrades.routes.js";

export const superadminRouter = Router();

superadminRouter.use("/businesses", businessesRouter);
superadminRouter.use("/", accountsRouter);
superadminRouter.use("/", upgradesRouter);

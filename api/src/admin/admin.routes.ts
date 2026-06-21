import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { uploadsRouter } from "./uploads.routes.js";
import { ownerBranchesRouter } from "./branches.routes.js";
import { requireBranchAccess } from "../middleware/ownership.js";
import { menuRouter } from "./menu.routes.js";
import { promotionsRouter } from "./promotions.routes.js";
import { discountsRouter } from "./discounts.routes.js";
import { requestsRouter } from "./requests.routes.js";
import { plansRouter } from "./plans.routes.js";

export const adminRouter = Router();

// Todo el área admin requiere sesión y un rol administrativo.
adminRouter.use(authenticate);
adminRouter.use(authorize("superadmin", "admin_general", "admin_sucursal"));

adminRouter.use("/uploads", uploadsRouter);
adminRouter.use("/branches", ownerBranchesRouter);
adminRouter.use("/branches/:branchId/menu", requireBranchAccess(), menuRouter);
adminRouter.use("/branches/:branchId/promotions", requireBranchAccess(), promotionsRouter);
adminRouter.use("/branches/:branchId/discounts", requireBranchAccess(), discountsRouter);
adminRouter.use("/plans", plansRouter);
adminRouter.use("/", requestsRouter);

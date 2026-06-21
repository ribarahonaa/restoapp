import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { uploadsRouter } from "./uploads.routes.js";

export const adminRouter = Router();

// Todo el área admin requiere sesión y un rol administrativo.
adminRouter.use(authenticate);
adminRouter.use(authorize("superadmin", "admin_general", "admin_sucursal"));

adminRouter.use("/uploads", uploadsRouter);

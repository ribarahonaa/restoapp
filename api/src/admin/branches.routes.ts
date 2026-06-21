import { Router } from "express";
import { requireBranchAccess } from "../middleware/ownership.js";
import { listManagedBranches, getManagedBranch } from "./owner.service.js";

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

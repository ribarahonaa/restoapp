import type { Category } from "./types.js";

export interface SaPlan { id: string; name: string; maxBranches: number; maxPromos: number; maxMenuItems: number; }
export interface SaBusiness {
  id: string; name: string;
  plan: SaPlan | null;
  owner: { id: string; email: string; name: string };
  branches: { id: string; name: string; category: Category; active: boolean }[];
}
export interface CreateBusinessInput { businessName: string; ownerEmail: string; ownerName: string; ownerPassword: string; planId?: string; }
export interface CreateUserInput { email: string; name: string; password: string; role: "admin_general" | "admin_sucursal"; }
export interface SaBranchInput { name: string; category: Category; address: string; lat: number; lng: number; phone?: string | null; description?: string | null; imageUrl?: string | null; planId?: string | null; }

export interface SaUpgradeRequest {
  id: string; status: "pending" | "approved" | "rejected"; note: string | null; createdAt: string;
  business: { id: string; name: string };
  requestedPlan: { id: string; name: string; maxBranches: number };
}
export interface SaAdRequest {
  id: string; status: "pending" | "approved" | "rejected"; note: string | null; createdAt: string;
  businessId: string; branchId: string | null; desiredStartsAt: string; desiredEndsAt: string; wantsPopup: boolean;
  business: { id: string; name: string };
}
export interface SaAd {
  id: string; businessId: string; branchId: string | null; title: string; description: string | null;
  imageUrl: string | null; placement: "section" | "popup"; startsAt: string; endsAt: string; active: boolean;
  business?: { id: string; name: string };
}
export interface AdInput {
  businessId: string; branchId?: string | null; title: string; description?: string | null;
  imageUrl?: string | null; placement: "section" | "popup"; startsAt: string; endsAt: string; active?: boolean;
}

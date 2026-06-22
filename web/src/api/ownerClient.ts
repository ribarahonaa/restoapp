import { authedFetch } from "../auth/authClient.js";
import type {
  OwnerBranchSummary,
  OwnerBranchDetail,
  BranchUpdate,
  HourInput,
  PlanInfo,
  OwnerMenuItem,
  OwnerPromotion,
  OwnerDiscountCode,
  MenuItemInput,
  PromotionInput,
  DiscountInput,
  DiscountUpdate,
  CreateBranchInput,
  AdRequestInput,
} from "./ownerTypes.js";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
  return res.json() as Promise<T>;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// Error de límite de plan (la API responde 403 con error plan_limit_*).
export class LimitError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "LimitError";
  }
}

// Igual que jsonOrThrow pero mapea 403 plan_limit_* a LimitError (para mostrar "solicitar upgrade").
async function jsonOrLimit<T>(res: Response): Promise<T> {
  if (res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error && body.error.startsWith("plan_limit_")) throw new LimitError(body.error);
    throw new Error("forbidden");
  }
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
  return res.json() as Promise<T>;
}

export async function listBranches(): Promise<OwnerBranchSummary[]> {
  return jsonOrThrow(await authedFetch("/admin/branches"));
}

export async function getOwnerBranch(id: string): Promise<OwnerBranchDetail> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}`));
}

export async function updateBranch(id: string, data: BranchUpdate): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}`, jsonInit("PATCH", data)));
}

export async function setBranchActive(id: string, active: boolean): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}/active`, jsonInit("POST", { active })));
}

export async function closeBranch(id: string, untilISO: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}/close`, jsonInit("POST", { until: untilISO })));
}

export async function reopenBranch(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}/reopen`, { method: "POST" }));
}

export async function replaceHours(id: string, hours: HourInput[]): Promise<HourInput[]> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${id}/hours`, jsonInit("PUT", { hours })));
}

export async function listPlans(): Promise<PlanInfo[]> {
  return jsonOrThrow(await authedFetch("/admin/plans"));
}

// Sube un archivo al endpoint multipart de la API y devuelve la URL pública de MinIO.
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await authedFetch("/admin/uploads", { method: "POST", body: form });
  const { url } = await jsonOrThrow<{ url: string }>(res);
  return url;
}

export async function createMenuItem(branchId: string, input: MenuItemInput): Promise<OwnerMenuItem> {
  return jsonOrLimit(await authedFetch(`/admin/branches/${branchId}/menu`, jsonInit("POST", input)));
}
export async function updateMenuItem(branchId: string, itemId: string, input: Partial<MenuItemInput>): Promise<OwnerMenuItem> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${branchId}/menu/${itemId}`, jsonInit("PATCH", input)));
}
export async function deleteMenuItem(branchId: string, itemId: string): Promise<void> {
  const res = await authedFetch(`/admin/branches/${branchId}/menu/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
}

export async function createPromotion(branchId: string, input: PromotionInput): Promise<OwnerPromotion> {
  return jsonOrLimit(await authedFetch(`/admin/branches/${branchId}/promotions`, jsonInit("POST", input)));
}
export async function updatePromotion(branchId: string, promoId: string, input: Partial<PromotionInput>): Promise<OwnerPromotion> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${branchId}/promotions/${promoId}`, jsonInit("PATCH", input)));
}
export async function deletePromotion(branchId: string, promoId: string): Promise<void> {
  const res = await authedFetch(`/admin/branches/${branchId}/promotions/${promoId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
}

export async function listDiscounts(branchId: string): Promise<OwnerDiscountCode[]> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${branchId}/discounts`));
}
export async function createDiscount(branchId: string, input: DiscountInput): Promise<OwnerDiscountCode> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${branchId}/discounts`, jsonInit("POST", input)));
}
export async function updateDiscount(branchId: string, codeId: string, input: DiscountUpdate): Promise<OwnerDiscountCode> {
  return jsonOrThrow(await authedFetch(`/admin/branches/${branchId}/discounts/${codeId}`, jsonInit("PATCH", input)));
}
export async function deleteDiscount(branchId: string, codeId: string): Promise<void> {
  const res = await authedFetch(`/admin/branches/${branchId}/discounts/${codeId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
}

export async function createBranch(input: CreateBranchInput): Promise<{ id: string }> {
  return jsonOrLimit(await authedFetch("/admin/branches", jsonInit("POST", input)));
}

export async function requestUpgrade(businessId: string, requestedPlanId: string, note?: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch("/admin/upgrade-requests", jsonInit("POST", { businessId, requestedPlanId, note })));
}
export async function requestAd(input: AdRequestInput): Promise<unknown> {
  return jsonOrThrow(await authedFetch("/admin/ad-requests", jsonInit("POST", input)));
}

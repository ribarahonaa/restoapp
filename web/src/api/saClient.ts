import { authedFetch } from "../auth/authClient.js";
import type {
  SaBusiness, CreateBusinessInput, CreateUserInput, SaBranchInput,
  SaUpgradeRequest, SaAdRequest, SaAd, AdInput,
} from "./saTypes.js";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
  return res.json() as Promise<T>;
}
function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
const SA = "/admin/superadmin";

export async function listBusinesses(): Promise<SaBusiness[]> {
  return jsonOrThrow(await authedFetch(`${SA}/businesses`));
}
export async function createBusiness(input: CreateBusinessInput): Promise<{ business: { id: string }; owner: { id: string } }> {
  return jsonOrThrow(await authedFetch(`${SA}/businesses`, jsonInit("POST", input)));
}
export async function updateBusiness(id: string, input: { name?: string; planId?: string | null }): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/businesses/${id}`, jsonInit("PATCH", input)));
}
export async function createUser(input: CreateUserInput): Promise<{ id: string; email: string; name: string; role: string }> {
  return jsonOrThrow(await authedFetch(`${SA}/users`, jsonInit("POST", input)));
}
export async function createSaBranch(businessId: string, input: SaBranchInput): Promise<{ id: string }> {
  return jsonOrThrow(await authedFetch(`${SA}/businesses/${businessId}/branches`, jsonInit("POST", input)));
}
export async function assignBranchAdmin(userId: string, branchId: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/branch-admins`, jsonInit("POST", { userId, branchId })));
}
export async function setSaBranchActive(branchId: string, active: boolean): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/branches/${branchId}/active`, jsonInit("POST", { active })));
}
export async function listUpgradeRequests(status?: string): Promise<SaUpgradeRequest[]> {
  const q = status ? `?status=${status}` : "";
  return jsonOrThrow(await authedFetch(`${SA}/upgrade-requests${q}`));
}
export async function approveUpgrade(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/upgrade-requests/${id}/approve`, { method: "POST" }));
}
export async function rejectUpgrade(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/upgrade-requests/${id}/reject`, { method: "POST" }));
}
export async function listAds(): Promise<SaAd[]> {
  return jsonOrThrow(await authedFetch(`${SA}/ads`));
}
export async function createAd(input: AdInput): Promise<SaAd> {
  return jsonOrThrow(await authedFetch(`${SA}/ads`, jsonInit("POST", input)));
}
export async function updateAd(id: string, input: Partial<AdInput>): Promise<SaAd> {
  return jsonOrThrow(await authedFetch(`${SA}/ads/${id}`, jsonInit("PATCH", input)));
}
export async function deleteAd(id: string): Promise<void> {
  const res = await authedFetch(`${SA}/ads/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
}
export async function listAdRequests(status?: string): Promise<SaAdRequest[]> {
  const q = status ? `?status=${status}` : "";
  return jsonOrThrow(await authedFetch(`${SA}/ad-requests${q}`));
}
export async function approveAdRequest(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/ad-requests/${id}/approve`, { method: "POST" }));
}
export async function rejectAdRequest(id: string): Promise<unknown> {
  return jsonOrThrow(await authedFetch(`${SA}/ad-requests/${id}/reject`, { method: "POST" }));
}

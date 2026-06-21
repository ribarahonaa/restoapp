import { authedFetch } from "../auth/authClient.js";
import type {
  OwnerBranchSummary,
  OwnerBranchDetail,
  BranchUpdate,
  HourInput,
  PlanInfo,
} from "./ownerTypes.js";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request_failed_${res.status}`);
  return res.json() as Promise<T>;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
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

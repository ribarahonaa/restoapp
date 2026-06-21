import { API_URL } from "../env.js";
import type { NearbyBranch, BranchDetail, Purpose, NearbyFilters } from "./types.js";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function getNearby(f: NearbyFilters): Promise<NearbyBranch[]> {
  const p = new URLSearchParams();
  p.set("lat", String(f.lat));
  p.set("lng", String(f.lng));
  p.set("radius", String(f.radius));
  if (f.category) p.set("category", f.category);
  if (f.purpose) p.set("purpose", f.purpose);
  if (f.promo) p.set("promo", "true");
  if (f.open) p.set("open", "true");
  return getJson<NearbyBranch[]>(`${API_URL}/branches/nearby?${p.toString()}`);
}

export function getBranch(id: string): Promise<BranchDetail> {
  return getJson<BranchDetail>(`${API_URL}/branches/${id}`);
}

export function getPurposes(): Promise<Purpose[]> {
  return getJson<Purpose[]>(`${API_URL}/purposes`);
}

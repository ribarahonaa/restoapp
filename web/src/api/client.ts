import { API_URL } from "../env.js";
import type {
  NearbyBranch,
  BranchDetail,
  Purpose,
  NearbyFilters,
  Review,
  ReviewInput,
  PublicAd,
} from "./types.js";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function getNearby(f: NearbyFilters): Promise<NearbyBranch[]> {
  const p = new URLSearchParams();
  p.set("lat", String(f.lat));
  p.set("lng", String(f.lng));
  // radius opcional: sin él, la API devuelve todos ordenados por cercanía.
  if (f.radius != null) p.set("radius", String(f.radius));
  if (f.category) p.set("category", f.category);
  if (f.purpose) p.set("purpose", f.purpose);
  if (f.promo) p.set("promo", "true");
  if (f.open) p.set("open", "true");
  if (f.q) p.set("q", f.q);
  return getJson<NearbyBranch[]>(`${API_URL}/branches/nearby?${p.toString()}`);
}

export function getBranch(id: string): Promise<BranchDetail> {
  return getJson<BranchDetail>(`${API_URL}/branches/${id}`);
}

export function getPurposes(): Promise<Purpose[]> {
  return getJson<Purpose[]>(`${API_URL}/purposes`);
}

export interface ReviewResult {
  review: Review;
  ratingAvg: number;
  ratingCount: number;
}

export async function addReview(id: string, input: ReviewInput): Promise<ReviewResult> {
  const res = await fetch(`${API_URL}/branches/${id}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(res.status === 409 ? "duplicate_review" : `HTTP ${res.status}`);
  return res.json() as Promise<ReviewResult>;
}

export function getAds(lat: number, lng: number): Promise<PublicAd[]> {
  return getJson<PublicAd[]>(`${API_URL}/ads?lat=${lat}&lng=${lng}`);
}
export async function getPopupAd(lat: number, lng: number): Promise<PublicAd | null> {
  const { ad } = await getJson<{ ad: PublicAd | null }>(`${API_URL}/ads/popup?lat=${lat}&lng=${lng}`);
  return ad;
}

import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { HttpError } from "../middleware/error.js";

interface LatLng { lat: number; lng: number; }

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function branchOrThrow(branchId: string) {
  const b = await prisma.branch.findFirst({ where: { id: branchId, active: true } });
  if (!b) throw new HttpError(404, "branch_not_found");
  return b;
}

export async function checkIn(userId: string, branchId: string, lat: number, lng: number) {
  const b = await branchOrThrow(branchId);
  if (distanceMeters({ lat, lng }, { lat: b.lat, lng: b.lng }) > env.PRESENCE_RADIUS_M) throw new HttpError(403, "too_far");
  const now = new Date();
  const visit = await prisma.visit.upsert({
    where: { userId_branchId: { userId, branchId } },
    update: { lastSeenAt: now },
    create: { userId, branchId, startedAt: now, lastSeenAt: now },
  });
  const canReviewAt = new Date(visit.startedAt.getTime() + env.REVIEW_MIN_DWELL_MINUTES * 60000);
  return { startedAt: visit.startedAt, canReviewAt };
}

export async function reviewEligibility(userId: string, branchId: string, lat: number, lng: number):
  Promise<{ eligible: boolean; reason?: string; canReviewAt?: Date }> {
  const b = await branchOrThrow(branchId);
  if (distanceMeters({ lat, lng }, { lat: b.lat, lng: b.lng }) > env.PRESENCE_RADIUS_M) return { eligible: false, reason: "too_far" };
  const visit = await prisma.visit.findUnique({ where: { userId_branchId: { userId, branchId } } });
  if (!visit) return { eligible: false, reason: "no_checkin" };
  const canReviewAt = new Date(visit.startedAt.getTime() + env.REVIEW_MIN_DWELL_MINUTES * 60000);
  if (canReviewAt > new Date()) return { eligible: false, reason: "too_soon", canReviewAt };
  return { eligible: true, canReviewAt };
}

export async function assertCanReview(userId: string, branchId: string, lat: number, lng: number) {
  const r = await reviewEligibility(userId, branchId, lat, lng);
  if (!r.eligible) throw new HttpError(403, r.reason!);
}

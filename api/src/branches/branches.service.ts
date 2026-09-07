import { prisma } from "../prisma.js";
import { buildNearbyQuery, type NearbyParams } from "./nearby.sql.js";
import { HttpError } from "../middleware/error.js";
import { assertCanReview } from "./presence.js";

export interface NearbyFilters {
  lat: number;
  lng: number;
  radius?: number;
  category?: string;
  purpose?: string;
  promo?: boolean;
  open?: boolean;
  q?: string;
}

export interface NearbyRow {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  description: string | null;
  imageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  openNow: boolean;
  distance: number;
}

// weekday (0=domingo) y HH:MM en hora de Chile (America/Santiago), base del
// cálculo "abierto ahora" en todo el backend.
function chileNowParts(now: Date): { weekday: number; hhmm: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return { weekday: weekdayMap[parts.weekday as string] ?? 0, hhmm: `${parts.hour}:${parts.minute}` };
}

// "Abierto ahora" a partir de los horarios (misma lógica que openNowSql en SQL,
// incluido el cruce de medianoche). Mantener ambas en sync.
function isOpenNow(
  hours: { weekday: number; openTime: string; closeTime: string }[],
  closedUntil: Date | null,
  now: Date
): boolean {
  if (closedUntil && closedUntil > now) return false;
  const { weekday, hhmm } = chileNowParts(now);
  return hours.some((h) => {
    if (h.weekday !== weekday) return false;
    if (h.closeTime >= h.openTime) return hhmm >= h.openTime && hhmm <= h.closeTime;
    return hhmm >= h.openTime || hhmm <= h.closeTime; // cruza medianoche
  });
}

export async function findNearby(f: NearbyFilters): Promise<NearbyRow[]> {
  const now = new Date();
  const { weekday, hhmm } = chileNowParts(now);
  const query = buildNearbyQuery({ ...f, now, weekday, hhmm } as NearbyParams);
  return prisma.$queryRaw<NearbyRow[]>(query);
}

export async function getBranchDetail(id: string) {
  const now = new Date();
  const branch = await prisma.branch.findFirst({
    where: { id, active: true },
    include: {
      hours: { orderBy: { weekday: "asc" } },
      menuItems: true,
      promotions: {
        where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
      },
      purposes: { include: { tag: true } },
      // Sólo las últimas reseñas para no cargar todo en memoria; el promedio y
      // el total se calculan aparte con un aggregate sobre la tabla completa.
      reviews: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!branch) throw new HttpError(404, "branch_not_found");
  const ratingAgg = await prisma.review.aggregate({
    where: { branchId: id },
    _avg: { rating: true },
    _count: true,
  });
  const ratingCount = ratingAgg._count;
  const ratingAvg = ratingAgg._avg.rating ?? 0;
  const openNow = isOpenNow(branch.hours, branch.closedUntil, now);
  const discountCodes = await prisma.discountCode.findMany({
    where: {
      businessId: branch.businessId,
      active: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [{ branchId: branch.id }, { branchId: null }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, type: true, value: true, startsAt: true, endsAt: true, branchId: true },
  });
  return { ...branch, ratingAvg, ratingCount, openNow, discountCodes };
}

export async function addReview(
  branchId: string,
  userId: string,
  input: { rating: number; comment?: string; lat: number; lng: number }
) {
  await assertCanReview(userId, branchId, input.lat, input.lng);
  const branch = await prisma.branch.findFirst({ where: { id: branchId, active: true } });
  if (!branch) throw new HttpError(404, "branch_not_found");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "invalid_token");

  const existing = await prisma.review.findFirst({ where: { branchId, userId } });
  if (existing) throw new HttpError(409, "already_reviewed");

  const review = await prisma.review.create({
    data: { branchId, userId, authorName: user.name, rating: input.rating, comment: input.comment ?? null, verified: true },
  });
  const agg = await prisma.review.aggregate({ where: { branchId }, _avg: { rating: true }, _count: true });
  return { review, ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count };
}

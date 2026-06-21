import { prisma } from "../prisma.js";
import { buildNearbyQuery, type NearbyParams } from "./nearby.sql.js";
import { HttpError } from "../middleware/error.js";

export interface NearbyFilters {
  lat: number;
  lng: number;
  radius: number;
  category?: string;
  purpose?: string;
  promo?: boolean;
  open?: boolean;
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
  distance: number;
}

export async function findNearby(f: NearbyFilters): Promise<NearbyRow[]> {
  const now = new Date();
  // weekday/hhmm en hora de Chile (America/Santiago) para "abierto ahora"
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
  const weekday = weekdayMap[parts.weekday as string] ?? 0;
  const hhmm = `${parts.hour}:${parts.minute}`;

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
    },
  });
  if (!branch) throw new HttpError(404, "branch_not_found");
  return branch;
}

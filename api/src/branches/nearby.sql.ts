import { Prisma } from "@prisma/client";

export interface NearbyParams {
  lat: number;
  lng: number;
  radius?: number; // metros — opcional: si falta, no se acota por distancia
  now: Date;
  weekday: number; // 0=domingo..6=sábado
  hhmm: string; // "HH:MM"
  category?: string;
  purpose?: string; // slug
  promo?: boolean;
  open?: boolean;
  q?: string; // búsqueda por nombre (parcial, case-insensitive)
}

export function buildNearbyQuery(p: NearbyParams): Prisma.Sql {
  const origin = Prisma.sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography`;

  const filters: Prisma.Sql[] = [Prisma.sql`b."active" = true`];
  // Radio opcional: por defecto se muestran todos los locales, ordenados por cercanía.
  if (p.radius != null) {
    filters.push(Prisma.sql`ST_DWithin(b."geog", ${origin}, ${p.radius})`);
  }

  if (p.category) {
    filters.push(Prisma.sql`b."category" = ${p.category}::"Category"`);
  }
  if (p.q) {
    // Escapa comodines LIKE del usuario para que \ % _ sean literales.
    const pattern = `%${p.q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(Prisma.sql`b."name" ILIKE ${pattern}`);
  }
  if (p.purpose) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "BranchPurpose" bp
      JOIN "PurposeTag" pt ON pt."id" = bp."tagId"
      WHERE bp."branchId" = b."id" AND pt."slug" = ${p.purpose}
    )`);
  }
  if (p.promo) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "Promotion" pr
      WHERE pr."branchId" = b."id" AND pr."active" = true
        AND ${p.now} BETWEEN pr."startsAt" AND pr."endsAt"
    )`);
  }
  if (p.open) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "ServiceHours" sh
      WHERE sh."branchId" = b."id" AND sh."weekday" = ${p.weekday}
        AND (
          (sh."closeTime" >= sh."openTime" AND ${p.hhmm} >= sh."openTime" AND ${p.hhmm} <= sh."closeTime")
          OR
          (sh."closeTime" < sh."openTime" AND (${p.hhmm} >= sh."openTime" OR ${p.hhmm} <= sh."closeTime"))
        )
    )`);
    filters.push(Prisma.sql`(b."closedUntil" IS NULL OR b."closedUntil" <= now())`);
  }

  const where = Prisma.join(filters, " AND ");

  return Prisma.sql`
    SELECT b."id", b."name", b."category", b."address", b."lat", b."lng",
           b."phone", b."description", b."imageUrl",
           COALESCE(r."avg", 0)::float8 AS "ratingAvg",
           COALESCE(r."cnt", 0)::int    AS "ratingCount",
           ST_Distance(b."geog", ${origin}) AS distance
    FROM "Branch" b
    LEFT JOIN (
      SELECT "branchId", AVG("rating") AS "avg", COUNT(*) AS "cnt"
      FROM "Review" GROUP BY "branchId"
    ) r ON r."branchId" = b."id"
    WHERE ${where}
    ORDER BY distance ASC
    LIMIT 100
  `;
}

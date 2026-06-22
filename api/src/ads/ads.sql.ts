import { Prisma } from "@prisma/client";

// Anuncios vigentes de un placement, ordenados por distancia del usuario a la sucursal del
// anuncio (o a la sucursal más cercana del business si branchId es null). Usa la columna PostGIS geog.
export function buildAdsQuery(lat: number, lng: number, placement: "section" | "popup", limit: number): Prisma.Sql {
  const origin = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
  return Prisma.sql`
    SELECT a."id", a."businessId", a."branchId", a."title", a."description", a."imageUrl",
           a."startsAt", a."endsAt",
           COALESCE(
             ST_Distance(b."geog", ${origin}),
             (SELECT MIN(ST_Distance(bb."geog", ${origin})) FROM "Branch" bb WHERE bb."businessId" = a."businessId")
           ) AS distance
    FROM "Ad" a
    LEFT JOIN "Branch" b ON b."id" = a."branchId"
    WHERE a."active" = true
      AND a."placement" = ${placement}::"AdPlacement"
      AND a."startsAt" <= now()
      AND a."endsAt" >= now()
    ORDER BY distance ASC NULLS LAST
    LIMIT ${limit}
  `;
}

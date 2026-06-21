-- Asegura la extensión PostGIS (presente en la imagen postgis/postgis; necesaria
-- también en la shadow database que Prisma usa para validar migraciones).
CREATE EXTENSION IF NOT EXISTS postgis;

-- Columna geography generada desde lng/lat (WGS84) + índice GiST para ST_DWithin
ALTER TABLE "Branch"
  ADD COLUMN "geog" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED;

CREATE INDEX "Branch_geog_idx" ON "Branch" USING GIST ("geog");

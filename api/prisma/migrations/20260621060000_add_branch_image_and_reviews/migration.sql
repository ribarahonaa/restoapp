-- Imagen del local
ALTER TABLE "Branch" ADD COLUMN "imageUrl" TEXT;

-- Reseñas públicas (calificación + comentario, autor por nombre)
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Review_branchId_idx" ON "Review"("branchId");

ALTER TABLE "Review" ADD CONSTRAINT "Review_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

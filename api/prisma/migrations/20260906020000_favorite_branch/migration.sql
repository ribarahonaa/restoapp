CREATE TABLE "FavoriteBranch" (
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FavoriteBranch_pkey" PRIMARY KEY ("userId","branchId")
);
CREATE INDEX "FavoriteBranch_userId_idx" ON "FavoriteBranch"("userId");
ALTER TABLE "FavoriteBranch" ADD CONSTRAINT "FavoriteBranch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriteBranch" ADD CONSTRAINT "FavoriteBranch_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" ADD COLUMN "userId" TEXT;
ALTER TABLE "Review" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Review_userId_idx" ON "Review"("userId");
CREATE UNIQUE INDEX "Review_userId_branchId_key"
  ON "Review"("userId", "branchId") WHERE "userId" IS NOT NULL;

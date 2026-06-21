ALTER TABLE "Business" ADD COLUMN "planId" TEXT;
CREATE INDEX "Business_planId_idx" ON "Business"("planId");
ALTER TABLE "Business" ADD CONSTRAINT "Business_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

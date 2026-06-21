-- Enums
CREATE TYPE "DiscountType" AS ENUM ('percent', 'amount');
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "AdPlacement" AS ENUM ('section', 'popup');

-- Plan / Branch
ALTER TABLE "Plan" ADD COLUMN "maxBranches" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Branch" ADD COLUMN "closedUntil" TIMESTAMP(3);

-- DiscountCode
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DiscountCode_businessId_idx" ON "DiscountCode"("businessId");
CREATE INDEX "DiscountCode_branchId_idx" ON "DiscountCode"("branchId");
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PlanUpgradeRequest
CREATE TABLE "PlanUpgradeRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestedPlanId" TEXT NOT NULL,
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "createdBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanUpgradeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlanUpgradeRequest_businessId_idx" ON "PlanUpgradeRequest"("businessId");
CREATE INDEX "PlanUpgradeRequest_status_idx" ON "PlanUpgradeRequest"("status");
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_requestedPlanId_fkey" FOREIGN KEY ("requestedPlanId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AdRequest
CREATE TABLE "AdRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "desiredStartsAt" TIMESTAMP(3) NOT NULL,
    "desiredEndsAt" TIMESTAMP(3) NOT NULL,
    "wantsPopup" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "createdBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdRequest_businessId_idx" ON "AdRequest"("businessId");
CREATE INDEX "AdRequest_status_idx" ON "AdRequest"("status");
ALTER TABLE "AdRequest" ADD CONSTRAINT "AdRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ad
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "placement" "AdPlacement" NOT NULL DEFAULT 'section',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Ad_businessId_idx" ON "Ad"("businessId");
CREATE INDEX "Ad_active_startsAt_endsAt_idx" ON "Ad"("active", "startsAt", "endsAt");
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

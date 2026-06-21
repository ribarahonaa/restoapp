/*
  Warnings:

  - Added the required column `updatedAt` to the `Branch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Business` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MenuItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PlaceSuggestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Promotion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PlaceSuggestion" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Branch_businessId_idx" ON "Branch"("businessId");

-- CreateIndex
CREATE INDEX "Branch_planId_idx" ON "Branch"("planId");

-- CreateIndex
CREATE INDEX "BranchAdmin_branchId_idx" ON "BranchAdmin"("branchId");

-- CreateIndex
CREATE INDEX "BranchPurpose_tagId_idx" ON "BranchPurpose"("tagId");

-- CreateIndex
CREATE INDEX "Business_ownerUserId_idx" ON "Business"("ownerUserId");

-- CreateIndex
CREATE INDEX "MenuItem_branchId_idx" ON "MenuItem"("branchId");

-- CreateIndex
CREATE INDEX "PlaceSuggestion_suggestedBy_idx" ON "PlaceSuggestion"("suggestedBy");

-- CreateIndex
CREATE INDEX "PlaceSuggestion_reviewedBy_idx" ON "PlaceSuggestion"("reviewedBy");

-- CreateIndex
CREATE INDEX "PlaceSuggestion_status_idx" ON "PlaceSuggestion"("status");

-- CreateIndex
CREATE INDEX "Promotion_branchId_idx" ON "Promotion"("branchId");

-- CreateIndex
CREATE INDEX "ServiceHours_branchId_idx" ON "ServiceHours"("branchId");

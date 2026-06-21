import { prisma } from "../prisma.js";

export async function resetDb() {
  // orden respeta FKs
  await prisma.placeSuggestion.deleteMany();
  await prisma.branchPurpose.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.serviceHours.deleteMany();
  await prisma.branchAdmin.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.business.deleteMany();
  await prisma.purposeTag.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.user.deleteMany();
}

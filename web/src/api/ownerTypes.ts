import type { Category } from "./types.js";

// Re-exportar Category para que las pantallas del panel lo importen desde un solo módulo.
export type { Category };

export interface PlanInfo {
  id: string;
  name: string;
  maxPromos: number;
  maxMenuItems: number;
  maxBranches: number;
}

export interface OwnerBranchSummary {
  id: string;
  name: string;
  category: Category;
  address: string;
  active: boolean;
  closedUntil: string | null;
  imageUrl: string | null;
  businessId: string;
  businessName: string;
  plan: { maxPromos: number; maxMenuItems: number; maxBranches: number } | null;
  counts: { menuItems: number; promotions: number };
}

export interface OwnerHour {
  id: string;
  weekday: number;
  openTime: string;
  closeTime: string;
}
export interface OwnerMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  imageUrl: string | null;
}
export interface OwnerPromotion {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
}
export interface OwnerDiscountCode {
  id: string;
  code: string;
  type: "percent" | "amount";
  value: string;
  startsAt: string;
  endsAt: string;
  branchId: string | null;
  active: boolean;
}

export interface OwnerBranchDetail {
  id: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  description: string | null;
  imageUrl: string | null;
  closedUntil: string | null;
  active: boolean;
  businessId: string;
  business: { id: string; name: string; plan: PlanInfo | null };
  hours: OwnerHour[];
  menuItems: OwnerMenuItem[];
  promotions: OwnerPromotion[];
  discountCodes: OwnerDiscountCode[];
}

export interface BranchUpdate {
  name?: string;
  category?: Category;
  address?: string;
  lat?: number;
  lng?: number;
  phone?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

export interface HourInput {
  weekday: number;
  openTime: string;
  closeTime: string;
}

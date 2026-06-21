export type Category = "bar" | "pub" | "restaurant" | "cafe";

export interface NearbyBranch {
  id: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  description: string | null;
  imageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  distance: number; // metros
}

export interface Purpose {
  slug: string;
  labelEs: string;
  labelEn: string;
  labelPt: string;
}

export interface ServiceHour {
  id: string;
  weekday: number;
  openTime: string;
  closeTime: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  imageUrl: string | null;
}

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface BranchPurposeTag {
  tag: Purpose;
}

export interface BranchDetail {
  id: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  description: string | null;
  imageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  hours: ServiceHour[];
  menuItems: MenuItem[];
  promotions: Promotion[];
  purposes: BranchPurposeTag[];
  reviews: Review[];
}

export interface NearbyFilters {
  lat: number;
  lng: number;
  radius?: number;
  category?: Category;
  purpose?: string;
  promo?: boolean;
  open?: boolean;
}

export interface ReviewInput {
  authorName: string;
  rating: number;
  comment?: string;
}

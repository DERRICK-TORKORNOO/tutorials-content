export const BRAND = "kudi";
export const STORE_NAME = "Kudi Store";
export type Product = {
  slug: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  stock: number;
  badge?: string;
  description: string;
  images: string[];
  colors: string[];
  featured: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ProductSummary = Omit<Product, "description" | "colors">;
export type Category = { slug: string; name: string; count: number };
export type Order = {
  orderRef: string;
  receivedAt: string;
  createdAt: string;
  total: number;
  placedOffline: boolean;
  items: { slug: string; name: string; qty: number; unitPrice: number }[];
};
export type RequestEntry = {
  id: number;
  time: string;
  method: string;
  path: string;
  ms: number;
  device: string;
};
export type StatsData = {
  total: number;
  byPath: Record<string, number>;
  recent: RequestEntry[];
};
export const money = (n: number) =>
  `GH₵ ${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
};
export type ProductSummary = Omit<Product, "description" | "colors">;
export type Category = { slug: string; name: string; count: number };
export const money = (n: number) =>
  `GH₵ ${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const BRAND = "kudi";
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
};
const rows: [string, string, number, string, string?][] = [
  ["Everyday Runner", "Sneakers", 680, "sneaker", "BESTSELLER"],
  ["Studio Wireless", "Headphones", 1250, "headphones", "NEW"],
  ["The Weekender", "Bags", 890, "bag"],
  ["Classic Chrono", "Watches", 1450, "watch", "POPULAR"],
  ["Court Low", "Sneakers", 540, "sneaker"],
  ["Sound Studio Pro", "Headphones", 1680, "headphones"],
  ["City Carryall", "Bags", 720, "bag", "NEW"],
  ["Everyday Timepiece", "Watches", 980, "watch"],
  ["Trail Runner", "Sneakers", 820, "sneaker"],
  ["Daily Audio", "Headphones", 780, "headphones"],
  ["Daily Crossbody", "Bags", 460, "bag"],
  ["Minimal Dial", "Watches", 1150, "watch"],
];
export const products: Product[] = rows.map(
  ([name, category, price, img, badge], i) => ({
    slug: name.toLowerCase().replaceAll(" ", "-"),
    name,
    category,
    price,
    currency: "GHS",
    rating: 4.8 - (i % 3) * 0.1,
    reviewCount: 124 + i * 17,
    stock: 18 + i,
    badge,
    description: `Meet your new everyday favourite. ${name} brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.`,
    images: [`/img/products/${img}.webp`, `/img/products/${img}-detail.webp`],
    colors: ["#e6dfd2", "#333b32", "#b27b57"],
  }),
);
export const money = (n: number) =>
  `GH₵ ${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

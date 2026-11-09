import products from "../../../../public/data/products.json";
export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}
export const dynamicParams = false;
import { Shop } from "@/components/shop";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <Shop view="detail" slug={slug} />;
}

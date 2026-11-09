"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product, ProductSummary, Category } from "@/lib/products";
export function useCatalog(slug?: string) {
  const catalog = useQuery({
    queryKey: ["products", {}],
    queryFn: () => api<ProductSummary[]>("products"),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("categories"),
  });
  const detail = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api<Product>(`products/${slug}`),
    enabled: !!slug,
    // Summary data paints the page instantly; fetch the full description and colours.
    placeholderData: () => {
      const summary = catalog.data?.find((p) => p.slug === slug);
      return summary ? { ...summary, description: "", colors: [] } : undefined;
    },
  });
  return { catalog, detail, categories };
}

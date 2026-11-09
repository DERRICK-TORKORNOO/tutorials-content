"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product } from "@/lib/products";
export function useCatalog(slug?: string) {
  const catalog = useQuery({
    queryKey: ["products", {}],
    queryFn: () => api<Product[]>("products"),
  });
  const detail = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api<Product>(`products/${slug}`),
    enabled: !!slug,
    initialData: () => catalog.data?.find((product) => product.slug === slug),
  });
  return { catalog, detail };
}

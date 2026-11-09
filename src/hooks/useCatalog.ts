"use client";
import { useEffect, useState, useCallback } from "react";
import { loadJson, ApiError } from "@/lib/api";
import type { Product, Category } from "@/lib/products";
function useFetch<T>(
  url: string,
  select: (data: unknown) => T,
  enabled = true,
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError(null);
    loadJson<unknown>(url)
      .then((value) => {
        const result = select(value);
        if (active) setData(result);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error
              : new Error("Connect once to save the shop."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url, select, enabled, retry]);
  return {
    data,
    error: error ?? new Error("Please reconnect and try again."),
    isPending: loading,
    isError: !!error,
    refetch: () => setRetry((n) => n + 1),
  };
}
const productList = (value: unknown) => value as Product[];
const categoryList = (value: unknown) => value as Category[];
export function useCatalog(slug?: string) {
  const catalog = useFetch("/data/products.json", productList);
  const categories = useFetch("/data/categories.json", categoryList);
  // Details come from the same saved JSON, including products not previously opened.
  const selectDetail = useCallback(
    (value: unknown) => {
      const product = (value as Product[]).find((p) => p.slug === slug);
      if (!product)
        throw new ApiError(
          "This product is not in this tutorial catalog.",
          404,
        );
      return product;
    },
    [slug],
  );
  const detail = useFetch("/data/products.json", selectDetail, !!slug);
  return { catalog, detail, categories };
}

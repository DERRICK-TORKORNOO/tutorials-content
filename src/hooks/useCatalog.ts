"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/products";
// Step 1 deliberately has no catalog cache. Every mount makes a request.
function useFetch<T>(path: string, enabled = true) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setPending] = useState(enabled);
  const [dataUpdatedAt, setUpdated] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setPending(true);
    setError(null);
    api<T>(path)
      .then((value) => {
        if (active) {
          setData(value);
          setUpdated(Date.now());
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason : new Error("Request failed"),
          );
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [path, enabled, revision]);
  return {
    data,
    error: error ?? new Error("Request failed"),
    isPending,
    isError: !!error,
    isFetching: isPending,
    isFetchedAfterMount: !!dataUpdatedAt,
    dataUpdatedAt,
    refetch: () => setRevision((r) => r + 1),
  };
}
export function useCatalog(slug?: string) {
  const catalog = useFetch<Product[]>("products");
  const detail = useFetch<Product>(`products/${slug}`, !!slug);
  return { catalog, detail };
}

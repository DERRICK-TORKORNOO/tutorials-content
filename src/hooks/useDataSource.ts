"use client";
import { useEffect, useState } from "react";
import {
  hashKey,
  type QueryKey,
  type UseQueryResult,
} from "@tanstack/react-query";
import { restoredQueries } from "@/lib/persist";
// Consume the restored marker once. Later visits use the in-memory query cache.
export function useDataSource(
  query: Pick<
    UseQueryResult,
    "dataUpdatedAt" | "isFetchedAfterMount" | "isFetching"
  >,
  key: QueryKey,
) {
  const [source, setSource] = useState("from cache");
  const hash = hashKey(key);
  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    if (query.isFetchedAfterMount) {
      setSource("from network");
      restoredQueries.delete(hash);
    } else if (restoredQueries.has(hash)) {
      setSource("from saved cache");
      restoredQueries.delete(hash);
    }
  }, [query.dataUpdatedAt, query.isFetchedAfterMount, hash]);
  return source;
}

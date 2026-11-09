"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { onlineManager } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/queryClient";
import { persister, restoredQueries } from "@/lib/persist";
import { api } from "@/lib/api";
const Devtools =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () =>
          import("@tanstack/react-query-devtools").then(
            (m) => m.ReactQueryDevtools,
          ),
        { ssr: false },
      )
    : () => null;
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(createQueryClient);
  useEffect(() => {
    onlineManager.setOnline(navigator.onLine);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js");
    let checking = false;
    async function check() {
      if (!navigator.onLine || checking) return;
      checking = true;
      try {
        const { catalogVersion } = await api<{ catalogVersion: number }>(
          "meta/version",
        );
        const old = Number(localStorage.getItem("catalogVersion") ?? 0);
        // The local memory store can restart at version 1; reconcile that reset too.
        if (catalogVersion !== old) {
          await client.invalidateQueries({
            predicate: (q) =>
              ["products", "product", "categories"].includes(
                String(q.queryKey[0]),
              ),
          });
          localStorage.setItem("catalogVersion", String(catalogVersion));
        }
      } catch {
      } finally {
        checking = false;
      }
    }
    void check();
    const headerVersion = (event: Event) => {
      const version = (event as CustomEvent<number>).detail;
      if (version > Number(localStorage.getItem("catalogVersion") ?? 0)) {
        localStorage.setItem("catalogVersion", String(version));
        void client.invalidateQueries({
          predicate: (q) =>
            ["products", "product", "categories"].includes(
              String(q.queryKey[0]),
            ),
        });
      }
    };
    window.addEventListener("catalog-version", headerVersion);
    const visibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", visibility);
    const unsub = onlineManager.subscribe((online) => {
      if (online) void check();
    });
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("catalog-version", headerVersion);
      unsub();
    };
  }, [client]);
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 86400000,
        buster: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === "success",
        },
      }}
      onSuccess={() => {
        client
          .getQueryCache()
          .getAll()
          .forEach((query) => restoredQueries.add(query.queryHash));
        void client.resumePausedMutations();
      }}
    >
      {children}
      <Devtools />
    </PersistQueryClientProvider>
  );
}

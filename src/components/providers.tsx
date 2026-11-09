"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createQueryClient } from "@/lib/queryClient";
import { persister, restoredQueries } from "@/lib/persist";
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
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js");
  }, []);
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
      }}
    >
      {children}
      <Devtools />
    </PersistQueryClientProvider>
  );
}

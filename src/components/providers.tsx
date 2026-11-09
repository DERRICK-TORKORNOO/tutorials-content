"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/queryClient";
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
  return (
    <QueryClientProvider client={client}>
      {children}
      <Devtools />
    </QueryClientProvider>
  );
}

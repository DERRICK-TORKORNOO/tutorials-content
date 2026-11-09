import { QueryClient } from "@tanstack/react-query";
import { placeOrder } from "./api";
export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Version checks own freshness; avoid unnecessary catalog downloads.
        staleTime: Infinity,
        gcTime: 86400000,
        retry: 1,
        refetchOnReconnect: true,
      },
    },
  });
  client.setMutationDefaults(["placeOrder"], {
    mutationFn: placeOrder,
    retry: 1,
    onError: (error: Error) =>
      window.dispatchEvent(
        new CustomEvent("order-failed", { detail: error.message }),
      ),
    onSuccess: (data: { orderRef: string }) => {
      localStorage.removeItem("kudi-cart");
      localStorage.setItem("kudi-receipt", data.orderRef);
      window.dispatchEvent(
        new CustomEvent("order-received", { detail: data.orderRef }),
      );
    },
  });
  return client;
}

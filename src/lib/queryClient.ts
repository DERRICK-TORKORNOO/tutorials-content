import { QueryClient } from "@tanstack/react-query";
import { placeOrder } from "./api";
export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Reuse fresh data for a minute so revisiting does not hit the API.
        staleTime: 60_000,
        // Keep visited data in memory for one day.
        gcTime: 86400000,
        // Retry once without trapping the demo in a long retry loop.
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

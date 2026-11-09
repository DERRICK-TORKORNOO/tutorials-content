export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(`/api/v1/${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (typeof window !== "undefined") {
    const version = Number(r.headers.get("X-Catalog-Version"));
    if (version > Number(localStorage.getItem("catalogVersion") ?? 0))
      window.dispatchEvent(
        new CustomEvent("catalog-version", { detail: version }),
      );
  }
  const body = await r.json();
  if (!r.ok) throw Error(body.error?.message ?? "Something went wrong.");
  return body;
}
export type CartItem = { slug: string; qty: number };
export const placeOrder = (input: { items: CartItem[]; requestId: string }) =>
  api<{ orderRef: string; total: number }>("cart", {
    method: "POST",
    body: JSON.stringify(input),
  });

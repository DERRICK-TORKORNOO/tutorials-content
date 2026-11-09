export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const form =
    typeof FormData !== "undefined" && options?.body instanceof FormData;
  const r = await fetch(`/api/v1/${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(form ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  if (typeof window !== "undefined" && !path.startsWith("admin/")) {
    const version = Number(r.headers.get("X-Catalog-Version"));
    if (version > Number(localStorage.getItem("catalogVersion") ?? 0))
      window.dispatchEvent(
        new CustomEvent("catalog-version", { detail: version }),
      );
  }
  const body = await r.json().catch(() => null);
  if (!body)
    throw new ApiError(
      r.status === 413
        ? "This image is too large for the hosting upload limit. Choose a smaller image."
        : "The server returned an unexpected response. Please retry.",
      r.status,
      "INVALID_RESPONSE",
    );
  if (!r.ok)
    throw new ApiError(
      body.error?.message ?? "Something went wrong.",
      r.status,
      body.error?.code ?? "SERVER_ERROR",
      body.error?.fields,
    );
  return body;
}
export type CartItem = { slug: string; qty: number };
export type OrderInput = {
  items: CartItem[];
  requestId: string;
  createdAt: string;
};
export const placeOrder = (input: OrderInput) =>
  api<import("./products").Order>("cart", {
    method: "POST",
    body: JSON.stringify(input),
  });

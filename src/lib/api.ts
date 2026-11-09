export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export type CartItem = { slug: string; qty: number };
// fetch still runs on every page visit. The service worker, not React, owns caching.
export async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok)
    throw new ApiError(
      "This page is not available in the saved catalog.",
      response.status,
    );
  return response.json();
}

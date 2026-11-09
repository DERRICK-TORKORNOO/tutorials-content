import { AppError } from "./errors";
const BUCKET = "product-images";
export function createStorage() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new AppError(
      "STORAGE_NOT_CONFIGURED",
      "Image storage is not configured yet.",
      503,
    );
  const headers = { Authorization: `Bearer ${key}`, apikey: key };
  async function request(path: string, init?: RequestInit) {
    let response: Response;
    try {
      response = await fetch(`${url}/storage/v1/${path}`, {
        ...init,
        headers: { ...headers, ...init?.headers },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new AppError(
        "STORAGE_UNAVAILABLE",
        "Image storage could not be reached. Please retry.",
        503,
      );
    }
    if (!response.ok)
      throw new AppError(
        response.status === 404 ? "NOT_FOUND" : "STORAGE_UNAVAILABLE",
        response.status === 404
          ? "Image not found."
          : "Image storage request failed. Check the private bucket and server credentials.",
        response.status === 404 ? 404 : 503,
      );
    return response;
  }
  return {
    async upload(key: string, bytes: Uint8Array) {
      await request(`object/${BUCKET}/${key}`, {
        method: "POST",
        headers: { "Content-Type": "image/webp", "x-upsert": "false" },
        body: new Uint8Array(bytes),
      });
    },
    download: (key: string) => request(`object/authenticated/${BUCKET}/${key}`),
    async remove(keys: string[]) {
      if (keys.length)
        await request(`object/${BUCKET}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: keys }),
        });
    },
  };
}
export type ImageStorage = ReturnType<typeof createStorage>;

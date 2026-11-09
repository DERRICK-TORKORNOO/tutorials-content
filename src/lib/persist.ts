import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
export const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => (await get(key)) ?? null,
    setItem: async (key, value) => {
      await set(key, value);
    },
    removeItem: async (key) => {
      await del(key);
    },
  },
});

export const restoredQueries = new Set<string>();

import { Redis } from "@upstash/redis";
import { products, Product } from "./products";
export type Order = {
  orderRef: string;
  receivedAt: string;
  total: number;
  items: { slug: string; qty: number }[];
};
type State = {
  products: Product[];
  catalogVersion: number;
  slow: number;
  orders: Order[];
  total: number;
  byPath: Record<string, number>;
  recent: {
    time: string;
    method: string;
    path: string;
    ms: number;
    device: string;
  }[];
};
const initial = (): State => ({
  products: structuredClone(products),
  catalogVersion: 1,
  slow: 0,
  orders: [],
  total: 0,
  byPath: {},
  recent: [],
});
const globalStore = globalThis as typeof globalThis & {
  shopState?: State;
  shopLock?: Promise<void>;
};
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;
export async function readStore(): Promise<State> {
  return redis
    ? ((await redis.get<State>("kudi:state")) ?? initial())
    : (globalStore.shopState ??= initial());
}
// Serialize local mutations. Redis uses an optimistic compare-and-set for serverless instances.
export async function updateStore<T>(fn: (s: State) => T): Promise<T> {
  if (redis) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const raw = await redis.get<State>("kudi:state");
      const state = raw ?? initial();
      const result = fn(state);
      const ok = await redis.eval(
        "local old=redis.call('GET',KEYS[1]); if old == ARGV[1] or (not old and ARGV[1] == 'null') then redis.call('SET',KEYS[1],ARGV[2]); return 1 end; return 0",
        ["kudi:state"],
        [JSON.stringify(raw), JSON.stringify(state)],
      );
      if (ok) return result;
    }
    throw Error("Store busy. Please retry.");
  }
  const previous = globalStore.shopLock ?? Promise.resolve();
  let release!: () => void;
  globalStore.shopLock = new Promise<void>((r) => {
    release = r;
  });
  await previous;
  try {
    return fn((globalStore.shopState ??= initial()));
  } finally {
    release();
  }
}

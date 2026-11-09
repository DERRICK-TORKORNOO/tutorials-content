"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Product, money } from "@/lib/products";
import type { Order } from "@/lib/store";
type StatsData = {
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
export function Stats() {
  const [key, setKey] = useState("");
  const [slug, setSlug] = useState("everyday-runner");
  const [price, setPrice] = useState("680");
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  useEffect(() => setKey(sessionStorage.getItem("admin-key") ?? ""), []);
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => api<StatsData>("stats"),
    refetchInterval: 1000,
  });
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<Order[]>("orders"),
    refetchInterval: 1000,
  });
  const products = useQuery({
    queryKey: ["products", {}],
    queryFn: () => api<Product[]>("products"),
  });
  async function admin(path: string, body: unknown) {
    try {
      await api(`admin/${path}`, {
        method: "POST",
        headers: { "x-admin-key": key },
        body: JSON.stringify(body),
      });
      setMessage("Saved successfully");
      void client.invalidateQueries();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    }
  }
  return (
    <main className="stats-page">
      <Link className="text-link" href="/">
        ← Kudi Store
      </Link>
      <div className="eyebrow" style={{ marginTop: 35 }}>
        THE OFFLINE LAB / LIVE DASHBOARD
      </div>
      <h1>
        <strong>{stats.data?.total ?? "—"}</strong> catalog requests
      </h1>
      <p>Watch real requests arrive. Polls every second.</p>
      {stats.isError && (
        <button className="button" onClick={() => stats.refetch()}>
          Retry stats
        </button>
      )}
      <div className="stats-grid">
        <section className="stats-panel">
          <h2>Admin controls</h2>
          <label>
            Admin key
            <input
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                sessionStorage.setItem("admin-key", e.target.value);
              }}
            />
          </label>
          <label>
            Product
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              {products.data?.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            New price (GHS)
            <input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <button
            className="button"
            onClick={() => admin(`products/${slug}`, { price: Number(price) })}
          >
            Update price
          </button>
          <label>
            Slow mode
            <select
              defaultValue="0"
              onChange={(e) =>
                admin("slow-mode", { ms: Number(e.target.value) })
              }
            >
              <option value="0">Off</option>
              <option value="800">800 ms</option>
              <option value="2000">2000 ms</option>
            </select>
          </label>
          <button
            className="button"
            onClick={() => {
              if (confirm("Reset catalog, orders and request counters?"))
                void admin("reset", {});
            }}
          >
            Reset demo
          </button>
          <p role="status">{message}</p>
        </section>
        <section className="stats-panel">
          <h2>Requests by endpoint</h2>
          <pre>{JSON.stringify(stats.data?.byPath ?? {}, null, 2)}</pre>
          <h2 style={{ marginTop: 30 }}>Orders received</h2>
          {orders.data?.length ? (
            orders.data.map((o) => (
              <p
                key={o.orderRef}
                style={{
                  fontSize: 12,
                  marginBottom: 15,
                  overflowWrap: "anywhere",
                }}
              >
                {o.orderRef}
                <br />
                {money(o.total)} · {new Date(o.receivedAt).toLocaleTimeString()}
              </p>
            ))
          ) : (
            <p>No orders yet.</p>
          )}
        </section>
        <section className="stats-panel" style={{ gridColumn: "1 / -1" }}>
          <h2>Live request log</h2>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Path</th>
                <th>Duration</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {stats.data?.recent.map((r, i) => (
                <tr key={`${r.time}-${i}`}>
                  <td>{new Date(r.time).toLocaleTimeString()}</td>
                  <td>{r.path}</td>
                  <td>{r.ms} ms</td>
                  <td>{r.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

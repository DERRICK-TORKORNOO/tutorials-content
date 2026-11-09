"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  SlidersHorizontal,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  Monitor,
  Smartphone,
  Activity,
  Check,
  X,
  LockKeyhole,
  Leaf,
  ArchiveRestore,
  Pencil,
  Archive,
  ChevronRight,
  Radio,
  RotateCcw,
  Database,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  BRAND,
  STORE_NAME,
  money,
  type Product,
  type Category,
  type Order,
  type StatsData,
} from "@/lib/products";
import { QueryState, OrderTable, ConfirmDialog } from "./shared";
import { ProductForm } from "./product-form";
type Section = "overview" | "products" | "orders" | "settings";
type Overview = { stats: StatsData; orders: Order[]; catalogVersion: number };
const sections = [
  { id: "overview", path: "/admin", name: "Overview", icon: LayoutDashboard },
  { id: "products", path: "/admin/products", name: "Products", icon: Package },
  { id: "orders", path: "/admin/orders", name: "Orders", icon: ShoppingBag },
  {
    id: "settings",
    path: "/admin/settings",
    name: "Settings",
    icon: SlidersHorizontal,
  },
];
export function AdminDashboard({
  section = "overview",
}: {
  section?: Section;
}) {
  const [key, setKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [toast, setToast] = useState("");
  const [latestVersion, setLatestVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<Product | null | undefined>();
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    path: string;
    method?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const client = useQueryClient();
  useEffect(() => {
    setKey(sessionStorage.getItem("kudi-admin-key") ?? "");
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const auth = { "x-admin-key": key ?? "" };
  const enabled = !!key;
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api<Overview>("admin/overview", { headers: auth }),
    enabled: enabled && section === "overview",
    refetchInterval: 1000,
    staleTime: 0,
    retry: 1,
  });
  const products = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => api<Product[]>("admin/products", { headers: auth }),
    enabled: enabled && section === "products",
    staleTime: 0,
    retry: 1,
  });
  const categories = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => api<Category[]>("admin/categories", { headers: auth }),
    enabled: enabled && section === "products",
    staleTime: 0,
    retry: 1,
  });
  const orders = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => api<Order[]>("admin/orders", { headers: auth }),
    enabled: enabled && section === "orders",
    refetchInterval: 1000,
    staleTime: 0,
    retry: 1,
  });
  const settings = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () =>
      api<{ catalogVersion: number; slowMode: number; cleanupPending: number }>(
        "admin/settings",
        { headers: auth },
      ),
    enabled: enabled && section === "settings",
    staleTime: 0,
    retry: 1,
  });
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    setSignInError("");
    try {
      await api("admin/session", { headers: { "x-admin-key": input } });
      sessionStorage.setItem("kudi-admin-key", input);
      setKey(input);
      setInput("");
    } catch (error) {
      setSignInError(
        error instanceof Error ? error.message : "Could not sign in.",
      );
    } finally {
      setSigningIn(false);
    }
  }
  async function signOut() {
    await client.cancelQueries({ queryKey: ["admin"] });
    client.removeQueries({ queryKey: ["admin"] });
    sessionStorage.removeItem("kudi-admin-key");
    setKey("");
  }
  async function saved(version?: number, message?: string) {
    setToast(
      message ??
        (version ? `Saved. Catalog version ${version}` : "Changes saved."),
    );
    await client.invalidateQueries({ queryKey: ["admin"] });
    if (version) {
      setLatestVersion(version);
      localStorage.setItem("catalogVersion", String(version));
      await client.invalidateQueries({
        predicate: (q) =>
          ["products", "product", "categories"].includes(String(q.queryKey[0])),
      });
    }
  }
  async function action(path: string, body?: unknown, method = "POST") {
    if (busy) return false;
    setBusy(true);
    try {
      const data = await api<{
        catalogVersion?: number;
        cleanupPending?: boolean;
        message?: string;
      }>(path, {
        method,
        headers: auth,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      setConfirm(null);
      await saved(
        data.catalogVersion,
        data.cleanupPending ? data.message : undefined,
      );
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const current = sections.find((s) => s.id === section)!;
  const version = Math.max(
    latestVersion,
    overview.data?.catalogVersion ?? 0,
    settings.data?.catalogVersion ?? 0,
  );
  if (key === null)
    return (
      <div className="admin-auth-loading">
        <div className="skeleton" />
      </div>
    );
  if (!key)
    return (
      <div className="admin-signin">
        <section className="signin-story">
          <Link className="logo" href="/">
            {BRAND}
            <span>store</span>
            <i />
          </Link>
          <div className="signin-story-copy">
            <div className="eyebrow">
              <Leaf size={16} /> YOUR COLLECTION, THOUGHTFULLY MANAGED
            </div>
            <h1>
              Good things.
              <br />
              <em>Well managed.</em>
            </h1>
            <p>
              Your collection. Your customers. Your everyday.
              <br />A little space to keep it all in rhythm.
            </p>
            <div className="signin-feature">
              <span>
                <Package size={19} /> A considered collection
              </span>
              <span>
                <Radio size={19} /> A live view of the shop
              </span>
              <span>
                <ShoppingBag size={19} /> Every order, in one place
              </span>
            </div>
          </div>
          <span className="signin-footer">
            {STORE_NAME} · The everyday, upgraded.
          </span>
          <div className="signin-mark">k.</div>
        </section>
        <section className="signin-form-area">
          <Link className="signin-back" href="/">
            Back to the shop <ArrowUpRight size={17} />
          </Link>
          <form onSubmit={signIn}>
            <div className="signin-lock">
              <LockKeyhole size={25} />
            </div>
            <div className="eyebrow">YOUR STORE, AT A GLANCE</div>
            <h2>
              Welcome behind
              <br />
              the counter.
            </h2>
            <p>Sign in with your store admin key to get started.</p>
            <label htmlFor="admin-key">Admin key</label>
            <input
              id="admin-key"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your admin key"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {signInError && (
              <span className="field-error" role="alert">
                {signInError}
              </span>
            )}
            <button className="button" disabled={signingIn}>
              {signingIn ? "Checking key…" : "Open your dashboard"}
              <ArrowRight size={18} />
            </button>
            <span className="signin-note">
              <LockKeyhole size={13} /> Your key stays in this browser tab’s
              session.
            </span>
          </form>
          <span className="signin-copyright">
            Thoughtfully built for your everyday.
          </span>
        </section>
      </div>
    );
  const visibleProducts = (products.data ?? []).filter(
    (p) =>
      (status === "all" ||
        (status === "archived" ? !!p.archivedAt : !p.archivedAt)) &&
      `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  const recent = overview.data?.stats.recent ?? [];
  const buckets = Array.from(
    { length: 24 },
    (_, i) =>
      recent.filter((r) => {
        const age = (now - Date.parse(r.time)) / 1000;
        return age >= (23 - i) * 5 && age < (24 - i) * 5;
      }).length,
  );
  const peak = Math.max(1, ...buckets);
  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link href="/" className="logo">
          {BRAND}
          <span>store</span>
          <i />
        </Link>
        <div className="sidebar-label">THE CONTROL ROOM</div>
        <nav aria-label="Admin navigation">
          {sections.map((item) => (
            <Link
              key={item.id}
              href={item.path}
              className={section === item.id ? "selected" : ""}
            >
              <item.icon size={19} />
              {item.name}
              {section === item.id && <span />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <Leaf size={24} />
            <strong>
              Good finds.
              <br />
              Better days.
            </strong>
            <p>A little care behind every everyday essential.</p>
          </div>
          <Link href="/" target="_blank" rel="noreferrer">
            View storefront <ArrowUpRight size={17} />
          </Link>
          <button onClick={signOut}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{current.name}</strong>
          </div>
          <div>
            <span className="live-indicator">
              <i /> Store dashboard
            </span>
            <div className="admin-avatar">K</div>
          </div>
        </header>
        <main className="admin-main">
          <div className="admin-page-heading">
            <div>
              <div className="eyebrow">
                {section === "overview"
                  ? "A LITTLE PERSPECTIVE"
                  : section === "products"
                    ? "THE EVERYDAY EDIT"
                    : section === "orders"
                      ? "GOOD FINDS, ON THEIR WAY"
                      : "KEEP THINGS IN RHYTHM"}
              </div>
              <h1>
                {section === "overview"
                  ? "Your store, in motion."
                  : section === "products"
                    ? "The collection."
                    : section === "orders"
                      ? "Every order matters."
                      : "The little controls."}
              </h1>
              <p>
                {section === "overview"
                  ? "A live look at the good things happening in your shop."
                  : section === "products"
                    ? "Thoughtfully picked. Easily managed."
                    : section === "orders"
                      ? "From the first tap to a place in their everyday."
                      : "Manage network behaviour and sample data."}
              </p>
            </div>
            {section === "products" ? (
              <button
                className="button"
                onClick={() => setEditor(null)}
                disabled={!categories.data?.length}
              >
                <Plus size={18} /> Add product
              </button>
            ) : (
              <span className="admin-date">
                {now
                  ? new Date(now).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
              </span>
            )}
          </div>
          {section === "overview" && (
            <QueryState
              pending={overview.isPending}
              error={overview.error}
              retry={() => overview.refetch()}
            >
              <div className="overview-metrics">
                <section className="metric-main">
                  <div>
                    <span>CATALOG REQUESTS</span>
                    <Activity size={21} />
                  </div>
                  <strong>
                    {overview.data?.stats.total.toLocaleString() ?? 0}
                  </strong>
                  <div>
                    <span className="live-light">
                      <i /> Live
                    </span>
                    <span>Real requests. Updated every second.</span>
                  </div>
                  <div
                    className="metric-sparkline"
                    aria-label="Requests in five-second buckets over the last two minutes"
                  >
                    {buckets.map((n, i) => (
                      <span
                        key={i}
                        style={{ height: `${8 + (n / peak) * 54}px` }}
                      />
                    ))}
                  </div>
                </section>
                <section className="metric-card">
                  <span className="metric-icon">
                    <Database size={21} />
                  </span>
                  <span>CATALOG VERSION</span>
                  <strong>
                    {overview.data?.catalogVersion ?? "—"}
                    <small>v</small>
                  </strong>
                  <p>A shared source of truth.</p>
                </section>
                <section className="metric-card">
                  <span className="metric-icon">
                    <ShoppingBag size={21} />
                  </span>
                  <span>RECENT ORDERS</span>
                  <strong>
                    {overview.data?.orders.length ?? 0}
                    <small>latest 5</small>
                  </strong>
                  <p>Good finds, finding their people.</p>
                </section>
              </div>
              <div className="admin-overview-grid">
                <section className="admin-panel endpoint-panel">
                  <div className="admin-panel-title">
                    <h2>Where the action is</h2>
                    <ArrowUpRight size={19} />
                  </div>
                  <p>Catalog requests by endpoint</p>
                  {Object.entries(overview.data?.stats.byPath ?? {}).length ? (
                    Object.entries(overview.data!.stats.byPath).map(
                      ([path, total]) => (
                        <div className="endpoint" key={path}>
                          <div>
                            <code>{path}</code>
                            <strong>{total}</strong>
                          </div>
                          <div className="endpoint-track">
                            <span
                              style={{
                                width: `${(total / Math.max(1, overview.data!.stats.total)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="admin-small-empty">
                      Visit the shop to start seeing requests.
                    </div>
                  )}
                </section>
                <section className="admin-panel request-panel">
                  <div className="admin-panel-title">
                    <h2>The live feed</h2>
                    <span className="poll-label">
                      <i /> Refreshing every second
                    </span>
                  </div>
                  <div className="request-feed">
                    {recent.length ? (
                      recent.map((row) => (
                        <div
                          key={row.id}
                          className={`request-row ${now - Date.parse(row.time) < 5000 ? "fresh" : ""}`}
                        >
                          <span className="device-icon">
                            {row.device === "phone" ? (
                              <Smartphone size={17} />
                            ) : (
                              <Monitor size={17} />
                            )}
                          </span>
                          <div>
                            <code>{row.path}</code>
                            <span>
                              {new Date(row.time).toLocaleTimeString("en-GB")} ·{" "}
                              {row.ms} ms
                            </span>
                          </div>
                          <span className={`device-tag ${row.device}`}>
                            {row.device}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="admin-small-empty">
                        Nothing to report yet. Your first request will appear
                        here.
                      </div>
                    )}
                  </div>
                </section>
                <section className="admin-panel overview-orders">
                  <div className="admin-panel-title">
                    <h2>The latest good news</h2>
                    <Link href="/admin/orders">
                      All orders <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  {overview.data?.orders.length ? (
                    <OrderTable orders={overview.data.orders} />
                  ) : (
                    <div className="admin-small-empty">
                      No orders yet. Try placing a demo order from the shop.
                    </div>
                  )}
                </section>
              </div>
            </QueryState>
          )}
          {section === "products" && (
            <>
              <div className="admin-product-toolbar">
                <div className="admin-search">
                  <Search size={18} />
                  <input
                    placeholder="Search the collection…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="admin-tabs">
                  {["all", "live", "archived"].map((item) => (
                    <button
                      className={status === item ? "selected" : ""}
                      key={item}
                      onClick={() => setStatus(item)}
                    >
                      {item[0].toUpperCase() + item.slice(1)}
                    </button>
                  ))}
                </div>
                <span>{visibleProducts.length} products</span>
              </div>
              <QueryState
                pending={products.isPending || categories.isPending}
                error={products.error ?? categories.error}
                retry={() => {
                  void products.refetch();
                  void categories.refetch();
                }}
                empty={!visibleProducts.length}
              >
                <section className="admin-panel product-table-panel">
                  <div className="admin-table-wrap">
                    <table className="admin-table products-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Price (GHS)</th>
                          <th>Stock</th>
                          <th>Status</th>
                          <th>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleProducts.map((product) => (
                          <tr key={product.slug}>
                            <td>
                              <div className="admin-product-name">
                                <img src={product.images[0]} alt="" />
                                <div>
                                  <strong>{product.name}</strong>
                                  <span>
                                    {product.featured
                                      ? "Featured in the everyday edit"
                                      : product.slug}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>{product.category}</td>
                            <td>
                              <InlineNumber
                                value={product.price}
                                label={`Price for ${product.name}`}
                                min={0.01}
                                step={0.01}
                                onSave={(value) =>
                                  action(
                                    `admin/products/${product.slug}`,
                                    { price: value },
                                    "PATCH",
                                  )
                                }
                              />
                            </td>
                            <td>
                              <InlineNumber
                                value={product.stock}
                                label={`Stock for ${product.name}`}
                                min={0}
                                step={1}
                                onSave={(value) =>
                                  action(
                                    `admin/products/${product.slug}`,
                                    { stock: value },
                                    "PATCH",
                                  )
                                }
                              />
                            </td>
                            <td>
                              <span
                                className={`status ${product.archivedAt ? "archived" : "live"}`}
                              >
                                <i />
                                {product.archivedAt ? "Archived" : "Live"}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                <button
                                  title="Edit product"
                                  aria-label={`Edit ${product.name}`}
                                  onClick={() => setEditor(product)}
                                >
                                  <Pencil size={16} />
                                </button>
                                {product.archivedAt ? (
                                  <button
                                    disabled={busy}
                                    aria-label={`Restore ${product.name}`}
                                    onClick={() =>
                                      action(
                                        `admin/products/${product.slug}/restore`,
                                      )
                                    }
                                  >
                                    <ArchiveRestore size={17} />
                                  </button>
                                ) : (
                                  <button
                                    aria-label={`Archive ${product.name}`}
                                    onClick={() =>
                                      setConfirm({
                                        title: `Archive ${product.name}?`,
                                        description:
                                          "It will disappear from the shop after the next version check. You can restore it here at any time.",
                                        path: `admin/products/${product.slug}`,
                                        method: "DELETE",
                                      })
                                    }
                                  >
                                    <Archive size={17} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="admin-table-footer">
                    <span>
                      Click a price or stock value, then press Enter to save.
                    </span>
                    <span>
                      {products.data?.filter((p) => p.featured && !p.archivedAt)
                        .length ?? 0}{" "}
                      featured finds
                    </span>
                  </div>
                </section>
              </QueryState>
            </>
          )}
          {section === "orders" && (
            <QueryState
              pending={orders.isPending}
              error={orders.error}
              retry={() => orders.refetch()}
              empty={!orders.data?.length}
            >
              <section className="admin-panel">
                <div className="admin-panel-title">
                  <h2>Received with care</h2>
                  <span className="poll-label">
                    <i /> Last 20 orders · live
                  </span>
                </div>
                <OrderTable orders={orders.data ?? []} />
                <div className="admin-table-footer">
                  “Placed offline” means the order reached the server more than
                  10 seconds after it was created.
                </div>
              </section>
            </QueryState>
          )}
          {section === "settings" && (
            <QueryState
              pending={settings.isPending}
              error={settings.error}
              retry={() => settings.refetch()}
            >
              <div className="settings-grid">
                <section className="admin-panel settings-panel">
                  <span className="metric-icon">
                    <Radio size={22} />
                  </span>
                  <h2>Give the network a pace.</h2>
                  <p>
                    Simulate a slow connection to compare network requests with
                    cached responses.
                  </p>
                  <div className="slow-options">
                    {[0, 800, 2000].map((ms) => (
                      <button
                        disabled={busy}
                        className={
                          settings.data?.slowMode === ms ? "selected" : ""
                        }
                        key={ms}
                        onClick={() => action("admin/slow-mode", { ms })}
                      >
                        <strong>{ms === 0 ? "Off" : `${ms} ms`}</strong>
                        <span>
                          {ms === 0
                            ? "Full speed"
                            : ms === 800
                              ? "A little wait"
                              : "Take it slow"}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="admin-panel settings-panel">
                  <span className="metric-icon">
                    <Activity size={22} />
                  </span>
                  <h2>A fresh view of the activity.</h2>
                  <p>
                    Clear the request counter and live feed. Products and orders
                    stay as they are.
                  </p>
                  <button
                    className="admin-secondary"
                    disabled={busy}
                    onClick={() =>
                      setConfirm({
                        title: "Clear the request stats?",
                        description:
                          "The hit counter and request log will start again from zero.",
                        path: "admin/stats/clear",
                      })
                    }
                  >
                    Clear stats <RotateCcw size={17} />
                  </button>
                </section>
                <section className="admin-panel settings-panel reset-panel">
                  <span className="metric-icon">
                    <RotateCcw size={22} />
                  </span>
                  <h2>Restore the sample collection?</h2>
                  <p>
                    Restore the 12 seed products and 4 categories, clear orders
                    and stats, and delete uploaded images. The catalog version
                    increases.
                  </p>
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={() =>
                      setConfirm({
                        title: "Reset the demo data?",
                        description:
                          "This permanently removes custom products, orders and uploaded images, restores the seed collection, and clears the request log. This action cannot be undone.",
                        path: "admin/reset",
                      })
                    }
                  >
                    Reset demo data <RotateCcw size={17} />
                  </button>
                </section>
                {!!settings.data?.cleanupPending && (
                  <section className="admin-panel settings-panel">
                    <h2>Image cleanup is waiting.</h2>
                    <p>
                      The catalog is reset. {settings.data.cleanupPending} old
                      uploads still need to be removed from Storage.
                    </p>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => action("admin/images/cleanup")}
                    >
                      Retry image cleanup
                    </button>
                  </section>
                )}
              </div>
            </QueryState>
          )}
          <div className="admin-workspace-footer">
            <span>{STORE_NAME} / behind the everyday</span>
            <span>
              {version ? `Catalog v${version} · ` : ""}Small details. Good
              things.
            </span>
          </div>
        </main>
      </div>
      {editor !== undefined && (
        <ProductForm
          key={editor?.slug ?? "new"}
          product={editor}
          categories={categories.data ?? []}
          adminKey={key}
          onClose={() => setEditor(undefined)}
          onCatalogChanged={(version) => void saved(version)}
          onSaved={(version) => {
            setEditor(undefined);
            void saved(version);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          {...confirm}
          pending={busy}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          onConfirm={() => action(confirm.path, undefined, confirm.method)}
        />
      )}{" "}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function InlineNumber({
  value,
  label,
  min,
  step,
  onSave,
}: {
  value: number;
  label: string;
  min: number;
  step: number;
  onSave: (n: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    const n = Number(draft);
    if (
      !Number.isFinite(n) ||
      n < min ||
      (step === 1 && !Number.isInteger(n))
    ) {
      setError(
        step === 1 ? "Enter a whole number ≥ 0." : "Enter a positive price.",
      );
      return;
    }
    setSaving(true);
    const ok = await onSave(n);
    setSaving(false);
    if (ok) setEditing(false);
    else setError("Could not save. Please retry.");
  }
  return editing ? (
    <div className="inline-number">
      <input
        autoFocus
        aria-label={label}
        type="number"
        min={min}
        step={step}
        value={draft}
        disabled={saving}
        onChange={(e) => {
          setDraft(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button disabled={saving} aria-label={`Save ${label}`} onClick={save}>
        <Check size={15} />
      </button>
      {error && <span className="field-error">{error}</span>}
    </div>
  ) : (
    <button
      className="inline-edit"
      aria-label={label}
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    >
      {step === 1 ? value : money(value)}
      <Pencil size={12} />
    </button>
  );
}

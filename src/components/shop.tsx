"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  useMutation,
  useMutationState,
  onlineManager,
} from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowRight,
  ShoppingBag,
  Search,
  Plus,
  Minus,
  X,
  Star,
  Truck,
  ShieldCheck,
  RotateCcw,
  Check,
  WifiOff,
  Headphones,
  Watch,
  Footprints,
  Heart,
  ArrowDown,
  Menu,
} from "lucide-react";
import { CartItem } from "@/lib/api";
import { useCatalog } from "@/hooks/useCatalog";
import { useDataSource } from "@/hooks/useDataSource";
import { Product, money, BRAND } from "@/lib/products";
const categories = [
  "All essentials",
  "Sneakers",
  "Headphones",
  "Watches",
  "Bags",
];
const icons = [null, Footprints, Headphones, Watch, ShoppingBag];
const subscribe = (cb: () => void) => onlineManager.subscribe(cb);
function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => onlineManager.isOnline(),
    () => true,
  );
}
function Card({ p, onAdd }: { p: Product; onAdd: (p: Product) => void }) {
  const [liked, setLiked] = useState(false);
  return (
    <article className="product-card">
      <div className={`product-image ${p.category.toLowerCase()}`}>
        <Link href={`/products/${p.slug}`} aria-label={`View ${p.name}`}>
          <img src={p.images[0]} alt={p.name} loading="lazy" />
        </Link>
        {p.badge && <span className="badge">{p.badge}</span>}
        <button
          className={`favorite ${liked ? "liked" : ""}`}
          aria-label={liked ? "Remove favourite" : "Save favourite"}
          onClick={() => setLiked(!liked)}
        >
          <Heart size={17} fill={liked ? "currentColor" : "none"} />
        </button>
        <button
          className="quick-add"
          disabled={p.stock === 0}
          onClick={() => onAdd(p)}
          aria-label={`Add ${p.name} to bag`}
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="product-meta">
        <span>{p.category}</span>
        <span className="rating">
          <Star size={13} fill="currentColor" />
          {p.rating.toFixed(1)}
        </span>
      </div>
      <Link className="product-name" href={`/products/${p.slug}`}>
        {p.name}
      </Link>
      <p className="price">{money(p.price)}</p>
    </article>
  );
}
export function Shop({
  view: initialView = "home",
  slug: initialSlug,
}: {
  view?: "home" | "products" | "detail" | "cart";
  slug?: string;
}) {
  const [routeView, setRouteView] = useState(initialView);
  const [routeSlug, setRouteSlug] = useState(initialSlug);
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/products/")) {
      setRouteView("detail");
      setRouteSlug(path.split("/")[2]);
    } else if (path === "/products") setRouteView("products");
    else if (path === "/cart") setRouteView("cart");
    else setRouteView("home");
    navigator.serviceWorker?.ready.then((reg) =>
      reg.active?.postMessage({ type: "CACHE_PAGE", path: location.pathname }),
    );
  }, [initialView, initialSlug]);
  const view = routeView,
    slug = routeSlug;
  const [category, setCategory] = useState("All essentials");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [color, setColor] = useState(0);
  const [debug, setDebug] = useState(false);
  const [install, setInstall] = useState<
    (Event & { prompt?: () => Promise<void> }) | null
  >(null);
  const [ios, setIos] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const online = useOnline();
  const { catalog, detail } = useCatalog(slug);
  const source = useDataSource(
    view === "detail" ? detail : catalog,
    view === "detail" ? ["product", slug] : ["products", {}],
  );
  const [backOnline, setBackOnline] = useState(false);
  useEffect(() => {
    const show = () => {
      setBackOnline(true);
      setTimeout(() => setBackOnline(false), 2000);
    };
    window.addEventListener("online", show);
    return () => window.removeEventListener("online", show);
  }, []);
  const order = useMutation<
    { orderRef: string; total: number },
    Error,
    { items: CartItem[]; requestId: string }
  >({ mutationKey: ["placeOrder"], onError: (e) => setToast(e.message) });
  const pendingOrders = useMutationState({
    filters: { mutationKey: ["placeOrder"], status: "pending" },
    select: (mutation) => mutation.state.isPaused,
  });
  const hasPendingOrder = pendingOrders.length > 0;
  const hasPausedOrder = pendingOrders.some(Boolean);
  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem("kudi-cart") ?? "[]"));
    } catch {}
    setReady(true);
    if (location.search.includes("debug=1"))
      sessionStorage.setItem("kudi-debug", "1");
    setDebug(sessionStorage.getItem("kudi-debug") === "1");
    setIos(/iPhone|iPad/.test(navigator.userAgent));
    const receipt = (event: Event) => {
      setCart([]);
      setToast(
        `Order ${(event as CustomEvent<string>).detail} received. Thank you!`,
      );
    };
    window.addEventListener("order-received", receipt);
    const orderFailed = (event: Event) =>
      setToast((event as CustomEvent<string>).detail);
    window.addEventListener("order-failed", orderFailed);
    const offlineNav = (event: MouseEvent) => {
      if (!navigator.onLine) {
        const a = (event.target as HTMLElement).closest("a");
        if (
          a &&
          a.origin === location.origin &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          event.preventDefault();
          event.stopPropagation();
          location.assign(a.href);
        }
      }
    };
    document.addEventListener("click", offlineNav, true);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", prompt);
      document.removeEventListener("click", offlineNav, true);
      window.removeEventListener("order-received", receipt);
      window.removeEventListener("order-failed", orderFailed);
    };
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("kudi-cart", JSON.stringify(cart));
  }, [cart, ready]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const add = (p: Product) => {
    if (hasPendingOrder) {
      setToast(
        "Your order is saved. Wait for it to finish before adding more.",
      );
      return;
    }
    setCart((old) => {
      const found = old.find((i) => i.slug === p.slug);
      return found
        ? old.map((i) =>
            i.slug === p.slug
              ? { ...i, qty: Math.min(p.stock, i.qty + qty) }
              : i,
          )
        : [...old, { slug: p.slug, qty: Math.min(qty, p.stock) }];
    });
    setToast(`${p.name} added to your bag`);
  };
  const count = cart.reduce((n, i) => n + i.qty, 0);
  const data = catalog.data ?? [];
  const [newOnly, setNewOnly] = useState(false);
  useEffect(() => {
    setNewOnly(new URLSearchParams(location.search).has("new"));
  }, []);
  const filtered = data.filter(
    (p) =>
      (!newOnly || p.badge === "NEW") &&
      (category === "All essentials" || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const product = detail.data;
  const subtotal = cart.reduce(
    (sum, item) =>
      sum + (data.find((p) => p.slug === item.slug)?.price ?? 0) * item.qty,
    0,
  );
  const change = (slug: string, delta: number) =>
    !hasPendingOrder &&
    setCart((old) =>
      old
        .map((i) =>
          i.slug === slug ? { ...i, qty: Math.min(99, i.qty + delta) } : i,
        )
        .filter((i) => i.qty > 0),
    );
  return (
    <>
      <div className="announcement">
        <span>Good taste. Great finds. Delivered to your door.</span>
        <span className="announcement-right">
          Free delivery on orders over GH₵ 1,000 <ArrowUpRight size={13} />
        </span>
      </div>
      <header>
        <div className="nav container">
          <Link href="/" className="logo">
            {BRAND}
            <span>store</span>
            <i />
          </Link>
          <nav>
            <Link className={view === "home" ? "active" : ""} href="/">
              Home
            </Link>
            <Link
              className={view === "products" ? "active" : ""}
              href="/products"
              onClick={() => setNewOnly(false)}
            >
              Shop all
            </Link>
            <Link href="/products?new=1" onClick={() => setNewOnly(true)}>
              New arrivals <span className="new-dot" />
            </Link>
          </nav>
          <div className="nav-actions">
            <button
              aria-label="Search products"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search size={21} />
            </button>
            <Link
              className="bag-link"
              aria-label={`Shopping bag, ${count} items`}
              href="/cart"
            >
              <ShoppingBag size={21} />
              <span className="bag-label">My bag</span>
              <b>{count}</b>
            </Link>
            <Link
              className="mobile-menu"
              href="/products"
              aria-label="Shop menu"
            >
              <Menu size={22} />
            </Link>
          </div>
        </div>
      </header>
      {backOnline && (
        <div className="offline online">
          <Check size={16} /> Back online. All caught up.
        </div>
      )}
      {!online && (
        <div className="offline">
          <WifiOff size={16} /> You’re offline. Showing saved products.
        </div>
      )}
      {searchOpen && (
        <div className="container search-bar">
          <Search size={20} />
          <input
            autoFocus
            placeholder="Find your next favourite…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setSearchOpen(false)}
            aria-label="Close search"
          >
            <X size={20} />
          </button>
        </div>
      )}
      <main>
        {view === "home" && (
          <>
            <section className="hero container">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span />
                  THE EVERYDAY, UPGRADED
                </div>
                <h1>
                  Good things.
                  <br /> <em>Everyday.</em>
                </h1>
                <p>
                  A little style. A lot of you.
                  <br />
                  Discover thoughtfully picked essentials
                  <br className="desktop" /> for whatever your day has in store.
                </p>
                <Link className="button" href="/products">
                  Find your everyday <ArrowUpRight size={20} />
                </Link>
                <div className="social-proof">
                  <div className="avatars">
                    <span>AA</span>
                    <span>JK</span>
                    <span>EO</span>
                    <span>KA</span>
                  </div>
                  <div>
                    <div className="stars">★★★★★</div>
                    <span>Loved by 2,000+ everyday people</span>
                  </div>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-circle" />
                <span className="hero-caption">THE GOOD FINDS EDIT / 001</span>
                <img
                  className="hero-shoe"
                  src="/img/products/sneaker.webp"
                  alt="Red everyday sneakers"
                  fetchPriority="high"
                />
                <div className="hero-tag">
                  <span>A STEP ABOVE THE EVERYDAY</span>
                  <strong>Everyday Runner</strong>
                  <span>
                    Made to go places. <ArrowUpRight size={17} />
                  </span>
                </div>
                <div className="round-label">
                  LESS ORDINARY.
                  <br />
                  <Star size={25} />
                  <br />
                  MORE YOU.
                </div>
                <span className="visual-number">01 — 04</span>
              </div>
            </section>
            <div className="value-strip container">
              <span>
                <Truck /> Free delivery <small>on orders GH₵ 1,000+</small>
              </span>
              <span>
                <ShieldCheck /> Safe & secure{" "}
                <small>shop with confidence</small>
              </span>
              <span>
                <RotateCcw /> Easy returns <small>no second thoughts</small>
              </span>
              <span className="made-for">
                Good finds. Better days. <ArrowDown size={16} />
              </span>
            </div>
          </>
        )}
        {(view === "home" || view === "products") && (
          <section className="catalog container" id="collection">
            <div className="section-top">
              <div>
                <div className="eyebrow">YOUR NEXT FAVOURITES</div>
                <h2>
                  {view === "home" ? "Everyday essentials." : "The good finds."}
                  <span> Anything but ordinary.</span>
                </h2>
              </div>
              <Link
                className="text-link"
                href={view === "home" ? "/products" : "/"}
              >
                {view === "home" ? "Explore the collection" : "Back to home"}{" "}
                <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="catalog-toolbar">
              <div className="chips">
                {categories.map((c, i) => {
                  const Icon = icons[i];
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={category === c ? "selected" : ""}
                    >
                      {Icon && <Icon size={17} />} {c}
                    </button>
                  );
                })}
              </div>
              <span className="item-count">
                {view === "home"
                  ? "Picked for you"
                  : `${filtered.length} good finds`}
              </span>
            </div>
            {view === "products" && (
              <div className="search-bar inline-search">
                <Search size={19} />
                <input
                  placeholder="Search essentials…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
            {catalog.isPending ? (
              <div className="product-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div className="skeleton" key={i} />
                ))}
              </div>
            ) : catalog.isError ? (
              <div className="empty">
                <h3>Let’s try that again.</h3>
                <p>{catalog.error.message}</p>
                <button className="button" onClick={() => catalog.refetch()}>
                  Retry <RotateCcw size={18} />
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <h3>No finds just yet.</h3>
                <p>Try another search or category.</p>
              </div>
            ) : (
              <div className="product-grid">
                {(view === "home" ? filtered.slice(0, 4) : filtered).map(
                  (p) => (
                    <Card key={p.slug} p={p} onAdd={add} />
                  ),
                )}
              </div>
            )}
            <div className="catalog-bottom">
              <span>Thoughtfully selected. Happily worn.</span>
              <span>
                Updated{" "}
                {catalog.dataUpdatedAt
                  ? Math.max(
                      0,
                      Math.floor((now - catalog.dataUpdatedAt) / 60000),
                    )
                  : 0}{" "}
                min ago
              </span>
            </div>
          </section>
        )}
        {view === "detail" && (
          <section className="container detail">
            <Link className="text-link" href="/products">
              ← Back to the good finds
            </Link>
            {detail.isPending ? (
              <div className="skeleton" />
            ) : detail.isError ? (
              <div className="empty">
                <h2>Product unavailable</h2>
                <p>{detail.error.message}</p>
                <button className="button" onClick={() => detail.refetch()}>
                  Retry
                </button>
              </div>
            ) : (
              product && (
                <>
                  <div className="detail-grid">
                    <div>
                      <div
                        className="detail-photo"
                        onTouchStart={(e) =>
                          setTouchStart(e.touches[0].clientX)
                        }
                        onTouchEnd={(e) => {
                          const delta =
                            e.changedTouches[0].clientX - touchStart;
                          if (Math.abs(delta) > 40)
                            setPhoto(
                              (i) =>
                                (i +
                                  (delta < 0 ? 1 : -1) +
                                  product.images.length) %
                                product.images.length,
                            );
                        }}
                      >
                        <img src={product.images[photo]} alt={product.name} />
                      </div>
                      <div className="thumbnails">
                        {product.images.map((img, i) => (
                          <button
                            className={photo === i ? "chosen" : ""}
                            key={img}
                            onClick={() => setPhoto(i)}
                          >
                            <img src={img} alt={`View ${i + 1}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="detail-copy">
                      <div className="eyebrow">
                        {product.category} / THE EVERYDAY EDIT
                      </div>
                      <h1>{product.name}</h1>
                      <div className="rating">
                        <Star fill="currentColor" size={16} /> {product.rating}{" "}
                        <span>({product.reviewCount} reviews)</span>
                      </div>
                      <h2>{money(product.price)}</h2>
                      <p>{product.description}</p>
                      <div className="stock">
                        <span />{" "}
                        {product.stock > 0
                          ? `In stock · ${product.stock} ready to go`
                          : "Out of stock"}
                      </div>
                      <h4>
                        Colour — {["Sand", "Forest", "Terracotta"][color]}
                      </h4>
                      <div className="color-options">
                        {product.colors.map((c, i) => (
                          <button
                            key={c}
                            aria-label={`Choose colour ${i + 1}`}
                            className={color === i ? "chosen" : ""}
                            style={{ background: c }}
                            onClick={() => setColor(i)}
                          />
                        ))}
                      </div>
                      <div className="add-row">
                        <div className="stepper">
                          <button
                            onClick={() => setQty(Math.max(1, qty - 1))}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={16} />
                          </button>
                          {qty}
                          <button
                            onClick={() =>
                              setQty(Math.min(product.stock, qty + 1))
                            }
                            aria-label="Increase quantity"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <button
                          className="button"
                          disabled={product.stock === 0}
                          onClick={() => add(product)}
                        >
                          Add to bag <ShoppingBag size={18} />
                        </button>
                      </div>
                      <p className="detail-delivery">
                        <Truck size={18} /> Free delivery on orders over GH₵
                        1,000
                      </p>
                      <small>
                        Updated{" "}
                        {Math.max(
                          0,
                          Math.floor((now - detail.dataUpdatedAt) / 60000),
                        )}{" "}
                        min ago
                      </small>
                    </div>
                  </div>
                  <h2>You may also like</h2>
                  <div className="product-grid">
                    {data
                      .filter((p) => p.slug !== slug)
                      .slice(0, 4)
                      .map((p) => (
                        <Card key={p.slug} p={p} onAdd={add} />
                      ))}
                  </div>
                </>
              )
            )}
          </section>
        )}
        {view === "cart" && (
          <section className="container cart-page">
            <div className="eyebrow">YOUR GOOD FINDS</div>
            <h1>
              In the bag<span>.</span>
            </h1>
            {!cart.length ? (
              <div className="empty">
                <ShoppingBag size={45} />
                <h2>A little room for something good.</h2>
                <p>Your bag is waiting for its first favourite.</p>
                <Link href="/products" className="button">
                  Explore the collection <ArrowRight size={18} />
                </Link>
              </div>
            ) : catalog.isPending ? (
              <div className="skeleton" />
            ) : catalog.isError ? (
              <div className="empty">
                <p>Connect once to load the prices for your bag.</p>
                <button className="button" onClick={() => catalog.refetch()}>
                  Retry
                </button>
              </div>
            ) : (
              <div className="cart-layout">
                <div>
                  {cart.map((item) => {
                    const p = data.find((p) => p.slug === item.slug);
                    return p ? (
                      <div className="cart-item" key={item.slug}>
                        <img src={p.images[0]} alt={p.name} />
                        <div>
                          <span className="eyebrow">{p.category}</span>
                          <h3>{p.name}</h3>
                          <p>{money(p.price)}</p>
                          <div className="stepper">
                            <button
                              aria-label="Remove one"
                              onClick={() => change(item.slug, -1)}
                            >
                              <Minus size={15} />
                            </button>
                            {item.qty}
                            <button
                              aria-label="Add one"
                              onClick={() => change(item.slug, 1)}
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        </div>
                        <button
                          className="remove"
                          disabled={hasPendingOrder}
                          aria-label={`Remove ${p.name}`}
                          onClick={() =>
                            setCart((c) =>
                              c.filter((i) => i.slug !== item.slug),
                            )
                          }
                        >
                          <X size={19} />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
                <aside className="order-summary">
                  <h2>The good total</h2>
                  <p>
                    <span>Subtotal</span>
                    <strong>{money(subtotal)}</strong>
                  </p>
                  <p>
                    <span>Delivery</span>
                    <strong>On us</strong>
                  </p>
                  <hr />
                  <p>
                    <strong>Total</strong>
                    <strong>{money(subtotal)}</strong>
                  </p>
                  <button
                    className="button"
                    disabled={hasPendingOrder}
                    onClick={() =>
                      order.mutate({
                        items: cart,
                        requestId: `KD-${crypto.randomUUID()}`,
                      })
                    }
                  >
                    {hasPausedOrder
                      ? "Saved for when you’re online"
                      : hasPendingOrder
                        ? "Placing order…"
                        : "Place demo order"}
                    <ArrowUpRight size={18} />
                  </button>
                  {hasPausedOrder && (
                    <p className="paused">
                      Order saved. It will be sent when you’re back online.
                    </p>
                  )}
                  <small>Demo checkout · no payment required</small>
                </aside>
              </div>
            )}
          </section>
        )}
        {view === "home" && (
          <section className="editorial container">
            <div>
              <div className="eyebrow">LESS SCROLLING. MORE LIVING.</div>
              <h2>
                Life’s in the little things.
                <br />
                <em>Make them good.</em>
              </h2>
              <p>
                Not everything. Just the things you’ll reach for, again and
                again.
              </p>
              <Link href="/products" className="text-link">
                Meet your everyday essentials <ArrowUpRight size={19} />
              </Link>
            </div>
            <div className="editorial-mark">
              k<span>.</span>
            </div>
          </section>
        )}
      </main>
      <footer className="container">
        <div className="footer-top">
          <Link href="/" className="logo">
            {BRAND}
            <span>store</span>
            <i />
          </Link>
          <p>Good things for your everyday.</p>
          <Link href="/products">
            Find your favourite <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Kudi Store. Made for your rhythm.
          </span>
          <span>Designed for life. Even offline.</span>
          {install && (
            <button onClick={() => install.prompt?.()}>
              Install app <ArrowDown size={14} />
            </button>
          )}
          {ios && (
            <button
              onClick={() =>
                setToast("In Safari, tap Share, then Add to Home Screen.")
              }
            >
              Install app
            </button>
          )}
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      {debug && (view === "products" || view === "detail") && (
        <div className="debug">
          {source} · fetched{" "}
          {Math.max(0, Math.floor((now - catalog.dataUpdatedAt) / 60000))} min
          ago
        </div>
      )}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { api, rupees, statusLabel, when } from "../lib";
import { useAdmin } from "../AdminApp";
import { ErrorBox, Loading, useLoad } from "./ui";
import { Icon, type IconName } from "./icons";

type Period = "week" | "month" | "year" | "all";
interface Stat { now: number; before: number }
interface Dash {
  period: Period; compare: boolean;
  stats: { sales: Stat; orders: Stat; sold: Stat; customers: Stat };
  series: { unit: "day" | "month"; days: number | null; points: { b: string; sales: number; orders: number }[] };
  bestProducts: { name: string; qty: number; sales: number }[];
  bestCategories: { name: string; qty: number; sales: number }[];
  ordersByStatus: Record<string, number>;
  products: { total: number; active: number; out_of_stock: number; low_stock: number };
  recentOrders: { id: number; number: string; customer_name: string; total: number; status: string; payment_status: string; source: string; created_at: string }[];
  lowStock: { id: number; name: string; stock: number }[];
  enquiriesNew: number; utrToCheck: number;
}

const PERIODS: { v: Period; label: string; prev: string }[] = [
  { v: "week", label: "Week", prev: "previous 7 days" },
  { v: "month", label: "Month", prev: "previous 30 days" },
  { v: "year", label: "Year", prev: "previous 12 months" },
  { v: "all", label: "All time", prev: "" },
];

export function Dashboard() {
  const { user } = useAdmin();
  const [period, setPeriod] = useState<Period>("month");
  const { data, error, reload } = useLoad(() => api<Dash>(`dashboard?period=${period}`), [period]);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{hello}, {(user.name || "there").split(" ")[0]} 👋</h1>
          <p className="adm-muted">Here&apos;s how Insi House is doing.</p>
        </div>
        <div className="adm-head-actions">
          <div className="adm-seg" role="tablist" aria-label="Time period">
            {PERIODS.map((p) => <button key={p.v} role="tab" aria-selected={period === p.v} onClick={() => setPeriod(p.v)}>{p.label}</button>)}
          </div>
        </div>
      </div>
      {error ? <ErrorBox text={error} retry={reload} /> : !data ? <Loading /> : <Body d={data} prev={PERIODS.find((p) => p.v === period)!.prev} />}
    </>
  );
}

function Trend({ s, compare, prev }: { s: Stat; compare: boolean; prev: string }) {
  if (!compare) return <span className="adm-trend flat">All time</span>;
  if (s.before === 0 && s.now === 0) return <span className="adm-trend flat">No change · {prev}</span>;
  if (s.before === 0) return <span className="adm-trend up"><Icon name="arrowUp" size={14} /> New · {prev} had none</span>;
  const pct = Math.round(((s.now - s.before) / s.before) * 100);
  const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return <span className={`adm-trend ${dir}`}>{dir !== "flat" && <Icon name={dir === "up" ? "arrowUp" : "arrowDown"} size={14} />}{Math.abs(pct)}% vs {prev}</span>;
}

function Body({ d, prev }: { d: Dash; prev: string }) {
  const cards: { label: string; value: string; s: Stat; icon: IconName; tone: string; href: string }[] = [
    { label: "Total sales", value: rupees(d.stats.sales.now), s: d.stats.sales, icon: "rupee", tone: "rani", href: "#/orders" },
    { label: "Orders", value: String(d.stats.orders.now), s: d.stats.orders, icon: "cart", tone: "lilac", href: "#/orders" },
    { label: "Products sold", value: String(d.stats.sold.now), s: d.stats.sold, icon: "box", tone: "marigold", href: "#/products" },
    { label: "New customers", value: String(d.stats.customers.now), s: d.stats.customers, icon: "users", tone: "peacock", href: "#/customers" },
  ];
  const open = (d.ordersByStatus.new ?? 0) + (d.ordersByStatus.confirmed ?? 0) + (d.ordersByStatus.packed ?? 0);
  const todo = [
    { n: d.ordersByStatus.new ?? 0, label: "new orders to confirm", href: "#/orders?status=new", icon: "cart" as IconName },
    { n: d.utrToCheck, label: "UPI payments to check in your bank", href: "#/orders?pay=check", icon: "rupee" as IconName },
    { n: open, label: "orders to pack & ship", href: "#/orders", icon: "truck" as IconName },
    { n: d.enquiriesNew, label: "event enquiries to reply", href: "#/enquiries", icon: "sparkle" as IconName },
    { n: d.products.out_of_stock ?? 0, label: "products out of stock", href: "#/products", icon: "box" as IconName },
  ].filter((t) => t.n > 0);

  return (
    <>
      <div className="adm-kpis">
        {cards.map((c) => (
          <a key={c.label} href={c.href} className="adm-kpi">
            <span className="adm-kpi-top"><span>{c.label}</span><span className={`adm-kpi-ic t2-${c.tone}`}><Icon name={c.icon} /></span></span>
            <b>{c.value}</b>
            <Trend s={c.s} compare={d.compare} prev={prev} />
          </a>
        ))}
      </div>

      {todo.length > 0 && (
        <section className="adm-card adm-todo">
          <h2>To do today</h2>
          <div className="adm-todo-list">
            {todo.map((t) => <a key={t.label} href={t.href}><Icon name={t.icon} size={18} /><b>{t.n}</b> {t.label} →</a>)}
          </div>
        </section>
      )}

      <div className="adm-cols wide-first">
        <section className="adm-card">
          <div className="adm-card-head"><h2>Sales</h2><span className="adm-muted">{d.series.unit === "day" ? "per day" : "per month"} · cancelled orders not counted</span></div>
          <SalesChart d={d} />
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><h2>Best categories</h2></div>
          <Ranked rows={d.bestCategories} empty="No sales in this period yet." />
        </section>
      </div>

      <div className="adm-cols">
        <section className="adm-card">
          <div className="adm-card-head"><h2>Best-selling products</h2><a href="#/products">Products →</a></div>
          <Ranked rows={d.bestProducts} empty="No sales in this period yet." />
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><h2>Latest orders</h2><a href="#/orders">See all →</a></div>
          {d.recentOrders.length === 0 ? (
            <p className="adm-muted">No orders yet. Website orders appear here automatically. WhatsApp orders can be added with <a href="#/orders/new">+ New order</a>.</p>
          ) : (
            <ul className="adm-list">
              {d.recentOrders.map((o) => {
                const s = statusLabel(o.status);
                return (
                  <li key={o.id}>
                    <a href={`#/orders/${o.id}`}>
                      <span><b>{o.number}</b> · {o.customer_name}<small>{when(o.created_at)}{o.source === "website" ? " · website" : ""}</small></span>
                      <span className="adm-right"><b>{rupees(o.total)}</b><span className="adm-status" style={{ background: s.color }}>{s.label}</span></span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="adm-cols">
        <section className="adm-card">
          <div className="adm-card-head"><h2>Orders by status</h2></div>
          <div className="adm-status-grid">
            {(["new", "confirmed", "packed", "shipped", "delivered", "cancelled"] as const).map((k) => {
              const s = statusLabel(k);
              return <a key={k} href={`#/orders?status=${k}`} style={{ ["--c" as string]: s.color }}><b>{d.ordersByStatus[k] ?? 0}</b><span>{s.label}</span></a>;
            })}
          </div>
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><h2>Stock alerts</h2><a href="#/products">Products →</a></div>
          {d.lowStock.length === 0 ? (
            <p className="adm-muted">All good. No products are out of stock or running low.</p>
          ) : (
            <ul className="adm-list">
              {d.lowStock.map((p) => (
                <li key={p.id}><a href={`#/products/${p.id}`}><span>{p.name}</span><span className={`adm-stock ${p.stock <= 0 ? "out" : "low"}`}>{p.stock <= 0 ? "Out of stock" : `${p.stock} left`}</span></a></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Ranked({ rows, empty }: { rows: { name: string; qty: number; sales: number }[]; empty: string }) {
  if (!rows.length) return <div className="adm-chart-empty"><Icon name="dashboard" size={28} /><span>{empty}</span></div>;
  const max = Math.max(...rows.map((r) => r.sales), 1);
  return (
    <ol className="adm-ranked">
      {rows.map((r, i) => (
        <li key={r.name}>
          <span className="adm-rank">{i + 1}</span>
          <span className="adm-ranked-main">
            <span className="adm-ranked-top"><b>{r.name}</b><b>{rupees(r.sales)}</b></span>
            <span className="adm-ranked-bar"><span style={{ inlineSize: `${Math.max(4, (r.sales / max) * 100)}%` }} /></span>
            <small>{r.qty} sold</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Daily (or monthly) sales as bars. One series, so no legend; hover or tap a bar for the numbers. */
function SalesChart({ d }: { d: Dash }) {
  const [hover, setHover] = useState<number | null>(null);
  const bars = useMemo(() => {
    const by = new Map(d.series.points.map((p) => [p.b, p]));
    const out: { key: string; label: string; sales: number; orders: number }[] = [];
    const ist = (ms: number) => new Date(ms + 330 * 60_000);
    if (d.series.unit === "day" && d.series.days) {
      for (let i = d.series.days - 1; i >= 0; i--) {
        const dt = ist(Date.now() - i * 86400_000);
        const key = dt.toISOString().slice(0, 10);
        const p = by.get(key);
        out.push({ key, label: dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), sales: p?.sales ?? 0, orders: p?.orders ?? 0 });
      }
    } else if (d.series.days) {
      const now = ist(Date.now());
      for (let i = 11; i >= 0; i--) {
        const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const key = dt.toISOString().slice(0, 7);
        const p = by.get(key);
        out.push({ key, label: dt.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), sales: p?.sales ?? 0, orders: p?.orders ?? 0 });
      }
    } else {
      for (const p of d.series.points) {
        const dt = new Date(`${p.b}-01T00:00:00Z`);
        out.push({ key: p.b, label: dt.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), sales: p.sales, orders: p.orders });
      }
    }
    return out;
  }, [d]);

  const total = bars.reduce((s, b) => s + b.sales, 0);
  if (!bars.length || total === 0) return <div className="adm-chart-empty"><Icon name="dashboard" size={28} /><span>No sales in this period yet. The chart fills in as orders come in.</span></div>;

  const max = Math.max(...bars.map((b) => b.sales));
  const nice = (() => { const p = 10 ** Math.floor(Math.log10(max)); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
  const W = 640, H = 220, L = 52, B = 26, T = 10;
  const iw = W - L - 8, ih = H - B - T;
  const bw = iw / bars.length;
  const gap = Math.min(6, Math.max(2, bw * 0.25));
  const every = Math.ceil(bars.length / 7);
  const h = hover !== null ? bars[hover] : null;

  return (
    <div className="adm-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sales chart, total ${rupees(total)}`} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => {
          const y = T + ih - f * ih;
          return (
            <g key={f}>
              <line x1={L} x2={W - 8} y1={y} y2={y} className="adm-grid-line" />
              <text x={L - 8} y={y + 4} textAnchor="end" className="adm-axis">{f === 0 ? "₹0" : rupees(nice * f).replace("₹", "₹")}</text>
            </g>
          );
        })}
        {bars.map((b, i) => {
          const bh = b.sales ? Math.max(3, (b.sales / nice) * ih) : 0;
          const x = L + i * bw + gap / 2;
          const w = Math.max(2, bw - gap);
          const y = T + ih - bh;
          const r = Math.min(4, w / 2, bh);
          return (
            <g key={b.key} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} tabIndex={0} aria-label={`${b.label}: ${rupees(b.sales)}, ${b.orders} orders`}>
              <rect x={L + i * bw} y={T} width={bw} height={ih} fill="transparent" />
              {bh > 0 && <path d={`M${x},${T + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${T + ih} Z`} className={`adm-bar${hover === i ? " on" : ""}`} />}
              {i % every === 0 && <text x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle" className="adm-axis">{b.label}</text>}
            </g>
          );
        })}
        {h && hover !== null && (() => {
          const cx = L + hover * bw + bw / 2;
          const tx = Math.min(Math.max(cx, L + 70), W - 78);
          return (
            <g className="adm-tip" pointerEvents="none">
              <rect x={tx - 70} y={T} width={140} height={44} rx={10} />
              <text x={tx} y={T + 18} textAnchor="middle" className="t1">{rupees(h.sales)}</text>
              <text x={tx} y={T + 35} textAnchor="middle" className="t2">{h.label} · {h.orders} order{h.orders === 1 ? "" : "s"}</text>
            </g>
          );
        })()}
      </svg>
      <details className="adm-chart-table">
        <summary>Show as a table</summary>
        <table className="adm-table compact"><thead><tr><th>{d.series.unit === "day" ? "Day" : "Month"}</th><th>Orders</th><th>Sales</th></tr></thead>
          <tbody>{bars.filter((b) => b.sales || b.orders).map((b) => <tr key={b.key}><td>{b.label}</td><td>{b.orders}</td><td>{rupees(b.sales)}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

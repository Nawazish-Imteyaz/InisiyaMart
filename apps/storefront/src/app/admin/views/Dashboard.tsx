"use client";

import { api, rupees, statusLabel, when } from "../lib";
import { useAdmin } from "../AdminApp";
import { ErrorBox, Loading, PageHead, useLoad } from "./ui";

interface Dash {
  products: { total: number; active: number; out_of_stock: number; low_stock: number };
  categories: number;
  ordersByStatus: Record<string, number>;
  ordersToday: number;
  month: { sales: number; n: number };
  recentOrders: { id: number; number: string; customer_name: string; total: number; status: string; payment_status: string; created_at: string }[];
  lowStock: { id: number; name: string; stock: number }[];
}

export function Dashboard() {
  const { user } = useAdmin();
  const { data, error, reload } = useLoad(() => api<Dash>("dashboard"));
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;
  const open = (data.ordersByStatus.new ?? 0) + (data.ordersByStatus.confirmed ?? 0) + (data.ordersByStatus.packed ?? 0);

  const stats = [
    { label: "New orders", value: data.ordersByStatus.new ?? 0, href: "#/orders?status=new", tone: "rani" },
    { label: "Orders to ship", value: open, href: "#/orders", tone: "marigold" },
    { label: "Sales this month", value: rupees(data.month.sales), sub: `${data.month.n} orders`, href: "#/orders", tone: "peacock" },
    { label: "Out of stock", value: data.products.out_of_stock ?? 0, sub: `${data.products.low_stock ?? 0} running low`, href: "#/products", tone: "plum" },
  ];

  return (
    <>
      <PageHead
        title={`Hello, ${(user.name || "there").split(" ")[0]} 👋`}
        sub={`${data.ordersToday} order${data.ordersToday === 1 ? "" : "s"} today · ${data.products.active ?? 0} products live · ${data.categories} categories`}
        actions={<>
          <a className="adm-btn primary" href="#/products/new">+ Add product</a>
          <a className="adm-btn" href="#/orders/new">+ Add order</a>
        </>}
      />
      <div className="adm-stats">
        {stats.map((s) => (
          <a key={s.label} href={s.href} className={`adm-stat t-${s.tone}`}>
            <span>{s.label}</span>
            <b>{s.value}</b>
            {s.sub && <small>{s.sub}</small>}
          </a>
        ))}
      </div>

      <div className="adm-cols">
        <section className="adm-card">
          <div className="adm-card-head"><h2>Latest orders</h2><a href="#/orders">See all →</a></div>
          {data.recentOrders.length === 0 ? (
            <p className="adm-muted">No orders yet. When someone orders on WhatsApp, add it with <a href="#/orders/new">+ Add order</a> so you can track it here.</p>
          ) : (
            <ul className="adm-list">
              {data.recentOrders.map((o) => {
                const s = statusLabel(o.status);
                return (
                  <li key={o.id}>
                    <a href={`#/orders/${o.id}`}>
                      <span><b>{o.number}</b> · {o.customer_name}<small>{when(o.created_at)}</small></span>
                      <span className="adm-right"><b>{rupees(o.total)}</b><span className="adm-status" style={{ background: s.color }}>{s.label}</span></span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><h2>Stock alerts</h2><a href="#/products">Products →</a></div>
          {data.lowStock.length === 0 ? (
            <p className="adm-muted">All good. No products are out of stock or running low.</p>
          ) : (
            <ul className="adm-list">
              {data.lowStock.map((p) => (
                <li key={p.id}>
                  <a href={`#/products/${p.id}`}>
                    <span>{p.name}</span>
                    <span className={`adm-stock ${p.stock <= 0 ? "out" : "low"}`}>{p.stock <= 0 ? "Out of stock" : `${p.stock} left`}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { api, COURIERS, ORDER_STATUS, PAY_STATUS, rupees, statusLabel, when } from "../lib";
import { go, useAdmin } from "../AdminApp";
import { Empty, ErrorBox, Field, Loading, PageHead, useLoad } from "./ui";

interface OrderRow {
  id: number; number: string; customer_name: string; phone: string; city: string; pincode: string; total: number;
  status: string; payment_status: string; courier: string; awb: string; created_at: string; source: string; payment_ref?: string;
}
interface Item { productId: number | null; name: string; qty: number; priceInr: number }
interface Order extends Omit<OrderRow, "items"> {
  email: string; address: string; state: string; items: Item[]; subtotal: number; shipping: number; discount: number;
  payment_ref: string; tracking_url: string; notes: string; source: string; updated_at: string; gift_message: string;
}
interface Event { id: number; status: string; note: string; user_name: string; created_at: string }

function hashQuery(): URLSearchParams {
  const h = window.location.hash;
  const i = h.indexOf("?");
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : "");
}

const payLabel = (v: string) => PAY_STATUS.find((p) => p.value === v)?.label ?? v;

// ============================ List ============================
export function OrderList() {
  const [status, setStatus] = useState(() => (typeof window === "undefined" ? "" : hashQuery().get("status") ?? ""));
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);
  const { data, error, reload } = useLoad(
    () => api<{ orders: OrderRow[] }>(`orders?status=${encodeURIComponent(status)}&q=${encodeURIComponent(search)}`),
    [status, search],
  );

  return (
    <>
      <PageHead
        title="Orders"
        sub="Every order from WhatsApp, phone or the website. Update the status as you pack and ship."
        actions={<a className="adm-btn primary" href="#/orders/new">+ Add order</a>}
      />
      <div className="adm-tabs" role="tablist">
        <button role="tab" aria-selected={status === ""} onClick={() => setStatus("")}>All</button>
        {ORDER_STATUS.map((s) => (
          <button key={s.value} role="tab" aria-selected={status === s.value} onClick={() => setStatus(s.value)}>{s.label}</button>
        ))}
      </div>
      <div className="adm-filters">
        <input type="search" placeholder="Search order no., name, phone or PIN…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
      </div>
      {error ? <ErrorBox text={error} retry={reload} /> : !data ? <Loading /> : data.orders.length === 0 ? (
        <Empty>No orders here yet. <a href="#/orders/new">Add an order</a> when someone orders on WhatsApp.</Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
            <tbody>
              {data.orders.map((o) => {
                const s = statusLabel(o.status);
                return (
                  <tr key={o.id} className="adm-click" onClick={() => go(`/orders/${o.id}`)}>
                    <td><a href={`#/orders/${o.id}`}><b>{o.number}</b></a>{o.source === "website" && <span className="adm-tag">Website</span>}<small className="adm-block adm-muted">{when(o.created_at)}</small></td>
                    <td>{o.customer_name}<small className="adm-block adm-muted">{[o.city, o.pincode].filter(Boolean).join(" · ") || o.phone}</small></td>
                    <td><b>{rupees(o.total)}</b></td>
                    <td><span className={`adm-pay p-${o.payment_status}`}>{payLabel(o.payment_status)}</span>{o.payment_status === "pending" && o.payment_ref && <small className="adm-block adm-pay p-pending">UTR sent: check bank</small>}</td>
                    <td><span className="adm-status" style={{ background: s.color }}>{s.label}</span>{o.awb && <small className="adm-block adm-muted">{o.courier} {o.awb}</small>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ============================ Detail ============================
const FLOW = ["new", "confirmed", "packed", "shipped", "delivered"];

export function OrderView({ id }: { id: number }) {
  const { toast, fail, user } = useAdmin();
  const { data, error, reload } = useLoad(() => api<{ order: Order; events: Event[] }>(`orders/${id}`), [id]);
  const [edit, setEdit] = useState<Partial<Order>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => setEdit({}), [data]);
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;
  const o = { ...data.order, ...edit };
  const dirty = Object.keys(edit).length > 0;
  const set = <K extends keyof Order>(k: K, v: Order[K]) => setEdit((e) => ({ ...e, [k]: v }));

  async function save(extra: Record<string, unknown> = {}, msg = "Order updated") {
    setBusy(true);
    try {
      await api(`orders/${id}`, { method: "PUT", body: { ...edit, ...extra, ...(note ? { event_note: note } : {}) } });
      setNote("");
      toast(msg);
      reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Delete order ${data!.order.number} for ever? Stock will be given back.`)) return;
    try {
      await api(`orders/${id}`, { method: "DELETE" });
      toast("Order deleted");
      go("/orders");
    } catch (e) { fail(e); }
  }

  const s = statusLabel(data.order.status);
  const step = FLOW.indexOf(data.order.status);
  const nextStatus = step >= 0 && step < FLOW.length - 1 ? FLOW[step + 1] : null;
  const phone = data.order.phone.replace(/^\+/, "");
  const waNumber = phone.length === 10 ? `91${phone}` : phone;
  const track = data.order.awb ? ` Courier: ${data.order.courier} · Tracking no. ${data.order.awb}${data.order.tracking_url ? ` · Track: ${data.order.tracking_url}` : ""}.` : "";
  const waText = `Hello ${data.order.customer_name}! Your Insi House order ${data.order.number} is now: ${s.label}.${track} Thank you for shopping with us ✦`;

  return (
    <>
      <PageHead
        title={`Order ${data.order.number}`}
        sub={`Created ${when(data.order.created_at)} · from ${data.order.source}`}
        actions={<>
          <a className="adm-btn" href="#/orders">← Orders</a>
          {phone && <a className="adm-btn" href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">Send update on WhatsApp</a>}
        </>}
      />

      <section className="adm-card">
        <div className="adm-flow" aria-label="Order progress">
          {FLOW.map((f, i) => (
            <span key={f} className={`adm-flow-step${i <= step ? " done" : ""}${f === data.order.status ? " now" : ""}`}>{statusLabel(f).label}</span>
          ))}
        </div>
        <div className="adm-row wrap">
          <span className="adm-status big" style={{ background: s.color }}>{s.label}</span>
          {nextStatus && (
            <button className="adm-btn primary" disabled={busy} onClick={() => save({ status: nextStatus }, `Marked as ${statusLabel(nextStatus).label}`)}>
              Mark as {statusLabel(nextStatus).label} →
            </button>
          )}
          <select aria-label="Change status" value={data.order.status} disabled={busy} onChange={(e) => save({ status: e.target.value }, `Status: ${statusLabel(e.target.value).label}`)}>
            {ORDER_STATUS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </div>
      </section>

      <div className="adm-edit">
        <div className="adm-edit-main">
          <section className="adm-card">
            <h2>Items</h2>
            <table className="adm-table compact">
              <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th className="adm-right">Total</th></tr></thead>
              <tbody>
                {data.order.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.productId ? <a href={`#/products/${it.productId}`}>{it.name}</a> : it.name}</td>
                    <td>{it.qty}</td><td>{rupees(it.priceInr)}</td><td className="adm-right">{rupees(it.qty * it.priceInr)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>Subtotal</td><td className="adm-right">{rupees(data.order.subtotal)}</td></tr>
                {data.order.shipping > 0 && <tr><td colSpan={3}>Delivery</td><td className="adm-right">{rupees(data.order.shipping)}</td></tr>}
                {data.order.discount > 0 && <tr><td colSpan={3}>Discount</td><td className="adm-right">−{rupees(data.order.discount)}</td></tr>}
                <tr className="total"><td colSpan={3}>Total</td><td className="adm-right">{rupees(data.order.total)}</td></tr>
              </tfoot>
            </table>
          </section>

          <section className="adm-card">
            <h2>Delivery & tracking</h2>
            <div className="adm-grid">
              <Field label="Courier">
                <select value={o.courier} onChange={(e) => set("courier", e.target.value)}>
                  {[...new Set([...COURIERS, o.courier])].map((c) => <option key={c} value={c}>{c || "— Choose —"}</option>)}
                </select>
              </Field>
              <Field label="Tracking / AWB number"><input maxLength={60} value={o.awb} onChange={(e) => set("awb", e.target.value)} /></Field>
              <Field label="Tracking link (optional)" wide hint="Paste the courier's tracking page link, starting with https://">
                <input type="url" maxLength={300} value={o.tracking_url} onChange={(e) => set("tracking_url", e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="adm-card">
            <h2>Customer</h2>
            <div className="adm-grid">
              <Field label="Name"><input maxLength={100} value={o.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></Field>
              <Field label="Mobile"><input inputMode="tel" maxLength={20} value={o.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Address" wide><textarea rows={2} maxLength={400} value={o.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="City"><input maxLength={60} value={o.city} onChange={(e) => set("city", e.target.value)} /></Field>
              <Field label="State"><input maxLength={60} value={o.state} onChange={(e) => set("state", e.target.value)} /></Field>
              <Field label="PIN code"><input inputMode="numeric" maxLength={6} value={o.pincode} onChange={(e) => set("pincode", e.target.value.replace(/[^0-9]/g, ""))} /></Field>
              <Field label="Email"><input type="email" maxLength={120} value={o.email} onChange={(e) => set("email", e.target.value)} /></Field>
            </div>
          </section>
        </div>

        <div className="adm-edit-side">
          <section className="adm-card">
            <h2>Payment</h2>
            <div className="adm-grid">
              <Field label="Payment status" wide>
                <select value={o.payment_status} onChange={(e) => set("payment_status", e.target.value)}>
                  {PAY_STATUS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="UPI reference (UTR)" wide hint="The 12-digit number from the customer's payment screenshot.">
                <input maxLength={80} value={o.payment_ref} onChange={(e) => set("payment_ref", e.target.value)} />
              </Field>
            </div>
          </section>
          {data.order.gift_message && (
            <section className="adm-card gift-card">
              <h2>Gift message for the card</h2>
              <p style={{ margin: 0, whiteSpace: "pre-line", fontSize: 16 }}>{data.order.gift_message}</p>
            </section>
          )}
          <section className="adm-card">
            <h2>Notes</h2>
            <Field label="Private notes (only for your team)" wide>
              <textarea rows={3} maxLength={1000} value={o.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            <Field label="Add to history (optional)" wide>
              <input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer asked for red gift wrap" />
            </Field>
          </section>
          <button className="adm-btn primary block" disabled={busy || (!dirty && !note)} onClick={() => save()}>{busy ? "Saving…" : "Save changes"}</button>

          <section className="adm-card">
            <h2>History</h2>
            <ol className="adm-timeline">
              {data.events.map((e) => (
                <li key={e.id}><b>{e.note || statusLabel(e.status).label}</b><small>{when(e.created_at)} · {e.user_name}</small></li>
              ))}
            </ol>
          </section>
          {user.role === "owner" && (
            <section className="adm-card danger-zone">
              <button className="adm-btn danger" onClick={remove}>Delete order</button>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

// ============================ New order ============================
interface ProductOpt { id: number; name: string; price_inr: number | null; stock: number; track_stock: number; status: string }

export function OrderNew() {
  const { toast, fail } = useAdmin();
  const { data: prods } = useLoad(() => api<{ products: ProductOpt[] }>("products"));
  const [c, setC] = useState({ customer_name: "", phone: "", email: "", address: "", city: "", state: "Uttar Pradesh", pincode: "", notes: "", payment_status: "pending", payment_ref: "", source: "whatsapp" });
  const [items, setItems] = useState<Item[]>([]);
  const [shipping, setShipping] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const setF = (k: keyof typeof c, v: string) => setC((x) => ({ ...x, [k]: v }));

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.qty * i.priceInr, 0), [items]);
  const total = Math.max(0, subtotal + (Number(shipping) || 0) - (Number(discount) || 0));

  function addProduct(idStr: string) {
    setPick("");
    if (idStr === "custom") { setItems((x) => [...x, { productId: null, name: "", qty: 1, priceInr: 0 }]); return; }
    const p = prods?.products.find((x) => String(x.id) === idStr);
    if (!p) return;
    if (p.track_stock && p.stock <= 0) toast(`${p.name} is out of stock. Added anyway, check before confirming.`, "err");
    setItems((x) => [...x, { productId: p.id, name: p.name, qty: 1, priceInr: p.price_inr ?? 0 }]);
  }
  const setItem = (i: number, patch: Partial<Item>) => setItems((x) => x.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { toast("Add at least one item", "err"); return; }
    setBusy(true);
    try {
      const r = await api<{ id: number; number: string }>("orders", { body: { ...c, items, shipping, discount } });
      toast(`Order ${r.number} created`);
      go(`/orders/${r.id}`);
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <PageHead title="Add order" sub="Record an order you received on WhatsApp, by phone or in person. Stock goes down automatically." actions={<a className="adm-btn" href="#/orders">← Orders</a>} />
      <div className="adm-edit">
        <div className="adm-edit-main">
          <section className="adm-card">
            <h2>Items</h2>
            {items.length > 0 && (
              <div className="adm-items">
                {items.map((it, i) => (
                  <div key={i} className="adm-item">
                    <input aria-label="Item name" required placeholder="Item name" value={it.name} readOnly={!!it.productId} onChange={(e) => setItem(i, { name: e.target.value })} />
                    <label>Qty <input inputMode="numeric" value={it.qty} onChange={(e) => setItem(i, { qty: Math.max(1, Number(e.target.value.replace(/[^0-9]/g, "")) || 1) })} /></label>
                    <label>₹ <input inputMode="numeric" value={it.priceInr} onChange={(e) => setItem(i, { priceInr: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} /></label>
                    <b>{rupees(it.qty * it.priceInr)}</b>
                    <button type="button" className="adm-btn small danger" aria-label="Remove item" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <select value={pick} onChange={(e) => addProduct(e.target.value)} aria-label="Add item">
              <option value="">+ Add a product…</option>
              {prods?.products.filter((p) => p.status !== "draft").map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.price_inr !== null ? ` · ${rupees(p.price_inr)}` : ""}{p.track_stock ? ` · ${p.stock} in stock` : ""}</option>
              ))}
              <option value="custom">+ Something else (type the name)</option>
            </select>
            <div className="adm-grid" style={{ marginBlockStart: 16 }}>
              <Field label="Delivery charge (₹)"><input inputMode="numeric" value={shipping} onChange={(e) => setShipping(e.target.value.replace(/[^0-9]/g, ""))} /></Field>
              <Field label="Discount (₹)"><input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^0-9]/g, ""))} /></Field>
            </div>
            <p className="adm-total">Total: <b>{rupees(total)}</b></p>
          </section>
          <section className="adm-card">
            <h2>Customer</h2>
            <div className="adm-grid">
              <Field label="Name *"><input required maxLength={100} value={c.customer_name} onChange={(e) => setF("customer_name", e.target.value)} /></Field>
              <Field label="Mobile" hint="10-digit number"><input inputMode="tel" maxLength={14} value={c.phone} onChange={(e) => setF("phone", e.target.value)} /></Field>
              <Field label="Address" wide><textarea rows={2} maxLength={400} value={c.address} onChange={(e) => setF("address", e.target.value)} /></Field>
              <Field label="City"><input maxLength={60} value={c.city} onChange={(e) => setF("city", e.target.value)} /></Field>
              <Field label="State"><input maxLength={60} value={c.state} onChange={(e) => setF("state", e.target.value)} /></Field>
              <Field label="PIN code"><input inputMode="numeric" maxLength={6} value={c.pincode} onChange={(e) => setF("pincode", e.target.value.replace(/[^0-9]/g, ""))} /></Field>
              <Field label="Email (optional)"><input type="email" maxLength={120} value={c.email} onChange={(e) => setF("email", e.target.value)} /></Field>
            </div>
          </section>
        </div>
        <div className="adm-edit-side">
          <section className="adm-card">
            <h2>Payment</h2>
            <div className="adm-grid">
              <Field label="Payment status" wide>
                <select value={c.payment_status} onChange={(e) => setF("payment_status", e.target.value)}>
                  {PAY_STATUS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="UPI reference (UTR)" wide><input maxLength={80} value={c.payment_ref} onChange={(e) => setF("payment_ref", e.target.value)} /></Field>
              <Field label="Order came from" wide>
                <select value={c.source} onChange={(e) => setF("source", e.target.value)}>
                  <option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="instagram">Instagram</option><option value="in-person">In person</option><option value="other">Other</option>
                </select>
              </Field>
              <Field label="Notes" wide><textarea rows={3} maxLength={1000} value={c.notes} onChange={(e) => setF("notes", e.target.value)} placeholder="Gift message, wrap colour, delivery date…" /></Field>
            </div>
          </section>
          <button className="adm-btn primary block" disabled={busy}>{busy ? "Saving…" : "Create order"}</button>
        </div>
      </div>
    </form>
  );
}

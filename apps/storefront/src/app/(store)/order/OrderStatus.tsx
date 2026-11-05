"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatInr } from "@/data/catalog";
import { readLastOrder, upiLink } from "@/lib/cart";
import { whatsappLink } from "@/lib/site";

interface Tracked {
  number: string; status: string; payment_status: string; payment_method?: string; payment_reported: boolean; coupon_code?: string;
  items: { name: string; qty: number; priceInr: number }[]; subtotal: number; shipping: number; discount: number; total: number;
  courier: string; awb: string; tracking_url: string; city: string; pincode: string; created_at: string;
  steps: { status: string; at: string }[];
}

const FLOW = [
  { v: "new", label: "Order placed" },
  { v: "confirmed", label: "Confirmed" },
  { v: "packed", label: "Packed" },
  { v: "shipped", label: "Shipped" },
  { v: "delivered", label: "Delivered" },
];

function when(s: string) {
  const d = new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** /order/?n=IH1004 right after checkout, and /track/ for any order (number + mobile). */
export function OrderStatus({ mode }: { mode: "placed" | "track" }) {
  const [n, setN] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Tracked | null>(null);
  const [upi, setUpi] = useState("");
  const [shipPending, setShipPending] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [utr, setUtr] = useState("");
  const [utrMsg, setUtrMsg] = useState("");

  async function load(num: string, ph: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/order/track?n=${encodeURIComponent(num)}${ph ? `&phone=${encodeURIComponent(ph)}` : ""}`, { cache: "no-store", credentials: "same-origin" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not find the order");
      setOrder(d.order);
      if (d.phone) setPhone(d.phone);
      setUpi(d.upi_id || "");
      setShipPending(!!d.shipping_pending);
    } catch (e) {
      setOrder(null);
      setError(e instanceof Error ? e.message : "Could not load the order");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const last = readLastOrder();
    const num = (q.get("n") ?? (mode === "placed" ? last?.number : "") ?? "").toUpperCase();
    const ph = q.get("phone") ?? (last && last.number === num ? last.phone : "");
    setN(num);
    setPhone(ph);
    // Logged-in customers can open their own orders with just the number.
    if (num) load(num, ph).then(() => { if (!ph) setError(""); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendUtr(e: React.FormEvent) {
    e.preventDefault();
    setUtrMsg("");
    const r = await fetch("/api/order/payment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n: order?.number, phone, utr }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setUtrMsg(d.error || "Could not send. Please try again."); return; }
    setUtrMsg("Thank you! We'll check the payment and confirm your order on WhatsApp.");
    if (order) setOrder({ ...order, payment_reported: true });
  }

  const step = order ? FLOW.findIndex((f) => f.v === order.status) : -1;
  const closed = order && (order.status === "cancelled" || order.status === "returned");

  return (
    <div className="order-wrap">
      {mode === "placed" && order && (
        <div className="order-hero">
          <span className="order-tick" aria-hidden="true">✓</span>
          <h1 className="display">Thank you! Your order is placed</h1>
          <p>Order number <b>{order.number}</b>. Keep it to track your gift.</p>
        </div>
      )}
      {(mode === "track" || (!order && !busy)) && (
        <form className="form-card track-form" onSubmit={(e) => { e.preventDefault(); load(n.trim(), phone); }}>
          <h1 className="display" style={{ fontSize: "clamp(32px, 4.5vw, 44px)" }}>Track your order</h1>
          <div className="form-grid">
            <label className="form-field">Order number<input required placeholder="e.g. IH1004" value={n} onChange={(e) => setN(e.target.value.toUpperCase())} /></label>
            <label className="form-field">Mobile number used for the order<input required type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          </div>
          <button className="btn btn-glow" disabled={busy}>{busy ? "Finding…" : "Track order"}</button>
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {busy && !order && <div className="cart-empty"><span className="spinner" aria-label="Loading" /></div>}

      {order && (
        <div className="cart-layout">
          <section className="checkout-main">
            {order.payment_status === "cod" && !closed && (
              <div className="form-card pay-card">
                <h2>Cash on delivery · {formatInr(order.total)}</h2>
                <p className="muted" style={{ margin: 0 }}>Please keep {formatInr(order.total)} ready for the delivery person. We&apos;ll confirm your order on WhatsApp before we pack it.</p>
              </div>
            )}
            {order.payment_status === "pending" && !closed && (
              <div className="form-card pay-card">
                <h2>Pay {formatInr(order.total)} by UPI</h2>
                {upi ? (
                  <>
                    <a className="btn btn-glow upi-btn" href={upiLink(upi, order.total, order.number)}>Pay with GPay / PhonePe / Paytm</a>
                    <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                      On a computer? Pay from any UPI app to <b className="upi-id">{upi}</b>, amount {formatInr(order.total)}, note <b>{order.number}</b>.
                    </p>
                    {shipPending && <p className="muted" style={{ margin: 0, fontSize: 13 }}>If a delivery charge applies, we&apos;ll tell you on WhatsApp before you pay.</p>}
                    {order.payment_reported ? (
                      <p className="ok-note">✓ We received your payment reference. We&apos;ll confirm on WhatsApp.</p>
                    ) : (
                      <form className="utr-form" onSubmit={sendUtr}>
                        <label className="form-field">Paid? Enter the 12-digit UPI reference (UTR)
                          <div className="field-row">
                            <input inputMode="numeric" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 431298765012" />
                            <button className="btn" style={{ minBlockSize: 48 }}>Send</button>
                          </div>
                        </label>
                        {utrMsg && <span role="status" className="muted">{utrMsg}</span>}
                      </form>
                    )}
                  </>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>We&apos;ll send you a UPI payment link on WhatsApp shortly. Tap below to get it faster.</p>
                )}
                <a className="btn btn-outline" href={whatsappLink(`Hello Insi House! I placed order ${order.number} (${formatInr(order.total)}). Please confirm.`)} target="_blank" rel="noopener noreferrer">
                  Message us on WhatsApp about {order.number}
                </a>
              </div>
            )}

            <div className="form-card">
              <h2>Order {order.number}</h2>
              <p className="muted" style={{ margin: 0 }}>Placed {when(order.created_at)} · delivering to {order.city} {order.pincode}</p>
              {closed ? (
                <p className="stock-out" style={{ alignSelf: "flex-start" }}>This order was {order.status}</p>
              ) : (
                <ol className="track-steps">
                  {FLOW.map((f, i) => {
                    const at = order.steps.find((s) => s.status === f.v)?.at;
                    return (
                      <li key={f.v} className={i <= step ? "done" : ""}>
                        <b>{f.label}</b>
                        {at && <small>{when(at)}</small>}
                      </li>
                    );
                  })}
                </ol>
              )}
              {order.awb && (
                <div className="infobox">
                  <b>{order.courier || "Courier"} · tracking number {order.awb}</b>
                  {order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">Track with the courier →</a>}
                </div>
              )}
            </div>
          </section>

          <aside className="cart-summary">
            <h2>Items</h2>
            <ul className="sum-items">
              {order.items.map((i, k) => <li key={k}><span>{i.name} × {i.qty}</span><b>{formatInr(i.qty * i.priceInr)}</b></li>)}
            </ul>
            <div className="sum-row"><span>Subtotal</span><b>{formatInr(order.subtotal)}</b></div>
            <div className="sum-row"><span>Delivery</span><b>{order.shipping ? formatInr(order.shipping) : shipPending ? "Confirmed on WhatsApp" : "Free"}</b></div>
            {order.discount > 0 && <div className="sum-row save"><span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span><b>−{formatInr(order.discount)}</b></div>}
            <div className="sum-row total"><span>Total</span><b>{formatInr(order.total)}</b></div>
            <div className="sum-row"><span>Payment</span><b>{order.payment_status === "paid" ? "Paid ✓" : order.payment_status === "cod" ? "Cash on delivery" : order.payment_status === "refunded" ? "Refunded" : "Waiting"}</b></div>
            <Link href="/shop/" className="link-more" style={{ textAlign: "center" }}>Continue shopping →</Link>
          </aside>
        </div>
      )}
    </div>
  );
}

"use client";

// Printable bill + packing slip. Opened at #/print/<id>,<id>?what=both|bill|slip&auto=1
import { useEffect, useState } from "react";
import { api, rupees } from "../lib";

interface Item { name: string; qty: number; priceInr: number }
interface O {
  id: number; number: string; created_at: string; customer_name: string; phone: string; email: string; address: string; city: string; state: string; pincode: string;
  items: Item[]; subtotal: number; shipping: number; discount: number; total: number; coupon_code?: string; payment_status: string; payment_method?: string;
  gift_message: string; occasion?: string; notes: string; courier: string; awb: string;
}
type What = "both" | "bill" | "slip";

function dateIN(s: string) {
  const d = new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}
const payText = (o: O) => o.payment_status === "paid" ? "Paid" : o.payment_status === "cod" ? "Cash on delivery: collect " + rupees(o.total) : o.payment_status === "refunded" ? "Refunded" : "Payment pending";

export function PrintView({ ids, what: initial, auto }: { ids: number[]; what: What; auto: boolean }) {
  const [orders, setOrders] = useState<O[] | null>(null);
  const [biz, setBiz] = useState<Record<string, string>>({});
  const [what, setWhat] = useState<What>(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      Promise.all(ids.map((id) => api<{ order: O }>(`orders/${id}`).then((r) => r.order))),
      api<{ settings: Record<string, string> }>("settings").then((r) => r.settings).catch(() => ({} as Record<string, string>)),
    ]).then(([o, s]) => { setOrders(o); setBiz(s); }).catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, [ids]);

  useEffect(() => {
    if (!orders || !auto) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [orders, auto]);

  if (error) return <div className="adm-print-root"><p className="adm-error">{error}</p></div>;
  if (!orders) return <div className="adm-print-root"><div className="adm-center"><span className="adm-spinner" aria-label="Loading" /></div></div>;

  const name = biz.business_name || "Insi House";
  const tax = !!biz.gstin;

  return (
    <div className="adm-print-root">
      <div className="adm-print-toolbar">
        <a className="adm-btn" href="#/orders">← Orders</a>
        <div className="adm-seg" role="tablist" aria-label="What to print">
          {(["both", "bill", "slip"] as const).map((w) => <button key={w} role="tab" aria-selected={what === w} onClick={() => setWhat(w)}>{w === "both" ? "Bill + packing slip" : w === "bill" ? "Bill only" : "Packing slip only"}</button>)}
        </div>
        <button className="adm-btn primary" onClick={() => window.print()}>🖨 Print {orders.length > 1 ? `${orders.length} orders` : ""}</button>
        {!biz.business_address && <span className="adm-tag warn">Add your address in Store settings → Details printed on bills</span>}
      </div>

      {orders.map((o) => (
        <div key={o.id} className="adm-print-order">
          {what !== "slip" && (
            <section className="pr-page pr-bill">
              <header className="pr-head">
                <div>
                  <b className="pr-brand">{name}</b>
                  {biz.business_address && <span className="pr-pre">{biz.business_address}</span>}
                  {biz.business_phone && <span>Phone: {biz.business_phone}</span>}
                  {tax && <span>GSTIN: {biz.gstin}</span>}
                </div>
                <div className="pr-title">
                  <b>{tax ? "TAX INVOICE" : "BILL"}</b>
                  <span>No. <b>{o.number}</b></span>
                  <span>Date: {dateIN(o.created_at)}</span>
                </div>
              </header>
              <div className="pr-parties">
                <div><small>Bill to / Ship to</small><b>{o.customer_name}</b><span className="pr-pre">{o.address}</span><span>{o.city}, {o.state} {o.pincode}</span><span>Mobile: {o.phone}</span>{o.email && <span>{o.email}</span>}</div>
                <div><small>Payment</small><b>{payText(o)}</b>{o.payment_method && <span>Method: {o.payment_method === "cod" ? "Cash on delivery" : o.payment_method === "razorpay" ? "Online (Razorpay)" : "UPI"}</span>}{o.courier && <span>Delivery: {o.courier}{o.awb ? ` · ${o.awb}` : ""}</span>}</div>
              </div>
              <table className="pr-table">
                <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
                <tbody>{o.items.map((i, k) => <tr key={k}><td>{k + 1}</td><td>{i.name}</td><td>{i.qty}</td><td>{rupees(i.priceInr)}</td><td>{rupees(i.qty * i.priceInr)}</td></tr>)}</tbody>
                <tfoot>
                  <tr><td colSpan={4}>Subtotal</td><td>{rupees(o.subtotal)}</td></tr>
                  <tr><td colSpan={4}>Delivery</td><td>{o.shipping ? rupees(o.shipping) : "Free"}</td></tr>
                  {o.discount > 0 && <tr><td colSpan={4}>Discount{o.coupon_code ? ` (${o.coupon_code})` : ""}</td><td>−{rupees(o.discount)}</td></tr>}
                  <tr className="pr-total"><td colSpan={4}>Total</td><td>{rupees(o.total)}</td></tr>
                </tfoot>
              </table>
              <p className="pr-small">{tax ? "All prices include GST. " : ""}Handmade in Azamgarh · small variations are natural and make each piece unique.</p>
              {biz.invoice_note && <p className="pr-note">{biz.invoice_note}</p>}
            </section>
          )}
          {what !== "bill" && (
            <section className="pr-page pr-slip">
              <header className="pr-slip-head"><b>PACKING SLIP</b><span className="pr-big">{o.number}</span></header>
              <div className="pr-shipto">
                <small>SHIP TO</small>
                <b>{o.customer_name}</b>
                <span className="pr-pre">{o.address}</span>
                <span>{o.city}, {o.state}</span>
                <span className="pr-pin">PIN {o.pincode}</span>
                <span>📞 {o.phone}</span>
              </div>
              <div className="pr-from"><small>FROM</small><b>{name}</b>{biz.business_address && <span className="pr-pre">{biz.business_address}</span>}{biz.business_phone && <span>{biz.business_phone}</span>}</div>
              <table className="pr-table pr-check">
                <thead><tr><th>✓</th><th>Item</th><th>Qty</th></tr></thead>
                <tbody>{o.items.map((i, k) => <tr key={k}><td><span className="pr-box" /></td><td>{i.name}</td><td><b>{i.qty}</b></td></tr>)}</tbody>
              </table>
              <div className="pr-flags">
                {o.payment_status === "cod" && <span className="pr-flag">💵 COLLECT {rupees(o.total)} CASH</span>}
                {o.payment_status === "pending" && <span className="pr-flag warn">⚠ NOT PAID YET: check before sending</span>}
                {o.occasion && <span className="pr-flag">🎉 {o.occasion}</span>}
                <span className="pr-flag">🎁 Gift wrap</span>
              </div>
              {o.gift_message && <div className="pr-card"><small>WRITE ON THE GIFT CARD</small><p>{o.gift_message}</p></div>}
              {o.notes && <div className="pr-notes"><small>NOTES</small><p className="pr-pre">{o.notes}</p></div>}
            </section>
          )}
        </div>
      ))}
    </div>
  );
}

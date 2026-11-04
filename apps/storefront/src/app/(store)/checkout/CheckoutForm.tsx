"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatInr, type Product, type Settings } from "@/data/catalog";
import { cart, saveLastOrder, useCart } from "@/lib/cart";
import { shippingFor, useLiveCatalog } from "@/lib/live";

const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
const SAVED = "ih-checkout-details";

export function CheckoutForm(props: { products: Product[]; settings: Settings }) {
  const router = useRouter();
  const { lines, ready } = useCart();
  const { products, settings } = useLiveCatalog(props);
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "", gift_message: "", notes: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Remember the address on this device for next time (never the gift message).
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVED) ?? "null");
      if (s) setF((x) => ({ ...x, ...s, gift_message: "", notes: "" }));
    } catch { /* ignore */ }
  }, []);

  const rows = lines
    .map((l) => ({ line: l, p: products.find((x) => x.slug === l.slug) }))
    .filter((r): r is { line: typeof r.line; p: Product } => !!r.p && r.p.priceInr !== null);
  const subtotal = rows.reduce((s, r) => s + r.line.qty * (r.p.priceInr ?? 0), 0);
  const shipping = shippingFor(settings, subtotal);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  if (ready && rows.length === 0) {
    return (
      <div className="cart-empty">
        <h1 className="display">Nothing to check out</h1>
        <p className="muted">Your cart is empty.</p>
        <Link href="/shop/" className="btn btn-glow">Shop gifts</Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[6-9][0-9]{9}$/.test(f.phone.replace(/\D/g, "").slice(-10))) { setError("Please enter a valid 10-digit mobile number."); return; }
    if (!/^[1-9][0-9]{5}$/.test(f.pincode)) { setError("Please enter a valid 6-digit PIN code."); return; }
    if (!consent) { setError("Please accept the privacy policy to continue."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: rows.map((r) => ({ slug: r.p.slug, qty: r.line.qty })),
          customer: { name: f.name, phone: f.phone, email: f.email, address: f.address, city: f.city, state: f.state, pincode: f.pincode },
          gift_message: f.gift_message,
          notes: f.notes,
          consent: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not place the order. Please try again.");
      try {
        const { name, phone, email, address, city, state, pincode } = f;
        localStorage.setItem(SAVED, JSON.stringify({ name, phone, email, address, city, state, pincode }));
      } catch { /* ignore */ }
      saveLastOrder({ number: data.number, phone: f.phone.replace(/\D/g, "").slice(-10), total: data.total, shipping: data.shipping, upi_id: data.upi_id ?? "" });
      cart.clear();
      router.push(`/order/?n=${encodeURIComponent(data.number)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the order. Please check your internet and try again.");
      setBusy(false);
    }
  }

  return (
    <form className="cart-layout" onSubmit={submit} noValidate>
      <section className="checkout-main">
        <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 48px)" }}>Checkout</h1>

        <fieldset className="form-card">
          <legend>Who should we deliver to?</legend>
          <div className="form-grid">
            <label className="form-field">Full name *<input required autoComplete="name" maxLength={100} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="form-field">Mobile number *<input required type="tel" inputMode="tel" autoComplete="tel-national" maxLength={14} placeholder="10-digit number" value={f.phone} onChange={(e) => set("phone", e.target.value)} /><small>We send order updates on WhatsApp.</small></label>
            <label className="form-field wide">Address *<textarea required rows={2} autoComplete="street-address" maxLength={400} placeholder="House no., street, area, landmark" value={f.address} onChange={(e) => set("address", e.target.value)} /></label>
            <label className="form-field">City / town *<input required autoComplete="address-level2" maxLength={60} value={f.city} onChange={(e) => set("city", e.target.value)} /></label>
            <label className="form-field">PIN code *<input required inputMode="numeric" autoComplete="postal-code" maxLength={6} value={f.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} /></label>
            <label className="form-field">State *
              <select required autoComplete="address-level1" value={f.state} onChange={(e) => set("state", e.target.value)}>
                <option value="">Choose…</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="form-field">Email (optional)<input type="email" autoComplete="email" maxLength={120} value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
          </div>
        </fieldset>

        <fieldset className="form-card">
          <legend>Make it a gift (optional)</legend>
          <div className="form-grid">
            <label className="form-field wide">Message for the card<textarea rows={2} maxLength={300} placeholder="e.g. Happy birthday Ammi, with love from Sana" value={f.gift_message} onChange={(e) => set("gift_message", e.target.value)} /><small>Handwritten on our card, in English, Hindi or Urdu.</small></label>
            <label className="form-field wide">Anything else?<input maxLength={500} placeholder="Name to personalise, delivery date, wrap colour…" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
          </div>
        </fieldset>
      </section>

      <aside className="cart-summary">
        <h2>Your order</h2>
        <ul className="sum-items">
          {rows.map(({ line, p }) => (
            <li key={p.slug}><span>{p.name} × {line.qty}</span><b>{formatInr(line.qty * (p.priceInr ?? 0))}</b></li>
          ))}
        </ul>
        <div className="sum-row"><span>Subtotal</span><b>{formatInr(subtotal)}</b></div>
        <div className="sum-row"><span>Delivery</span><b>{shipping === null ? "Confirmed on WhatsApp" : shipping === 0 ? "Free" : formatInr(shipping)}</b></div>
        <div className="sum-row total"><span>Total</span><b>{formatInr(subtotal + (shipping ?? 0))}</b></div>
        <div className="pay-note">
          <b>How you pay</b>
          <span>After you place the order, pay by <b>UPI</b> (GPay, PhonePe, Paytm) on the next screen{settings.upi_id ? "" : " or with the link we send on WhatsApp"}. We pack your gift once payment is confirmed.</span>
        </div>
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I agree that Insi House uses my details to deliver this order, as in the <Link href="/policies/privacy/" target="_blank">privacy policy</Link>.</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-glow" disabled={busy || !ready}>{busy ? "Placing order…" : `Place order · ${formatInr(subtotal + (shipping ?? 0))}`}</button>
        <Link href="/cart/" className="link-more" style={{ textAlign: "center" }}>← Back to cart</Link>
      </aside>
    </form>
  );
}

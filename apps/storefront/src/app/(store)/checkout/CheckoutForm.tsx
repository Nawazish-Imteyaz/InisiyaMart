"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatInr, type Occasion, type Product, type Settings } from "@/data/catalog";
import { cart, saveLastOrder, useCart } from "@/lib/cart";
import { shippingFor, useLiveCatalog } from "@/lib/live";
import { accountApi, firstName, logout, useAccount } from "@/lib/account";
import { LoginBox } from "@/components/LoginBox";
import { AddressFields, addrProblem, emptyAddr, type Addr, type SavedAddress } from "@/components/AddressFields";

const SAVED = "ih-checkout-details";

export function CheckoutForm(props: { products: Product[]; settings: Settings; occasions: Occasion[] }) {
  const router = useRouter();
  const { lines, ready } = useCart();
  const { products, settings } = useLiveCatalog(props);
  const { me, ready: accReady } = useAccount();
  const [guest, setGuest] = useState(false);
  const [addr, setAddr] = useState<Addr>(emptyAddr);
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState<SavedAddress[] | null>(null);
  const [pick, setPick] = useState<number | "new">("new");
  const [saveAddr, setSaveAddr] = useState(true);
  const [gift, setGift] = useState({ occasion: "", gift_message: "", notes: "" });
  const [pay, setPay] = useState<"upi" | "cod">("upi");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const mustLogin = settings.require_login === "1";
  const codOn = settings.cod_enabled === "1";
  const codFee = Number(settings.cod_fee || 0);

  // Guests: remember the address on this device (never the gift message).
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVED) ?? "null");
      if (s) { setAddr((x) => ({ ...x, ...s })); if (s.email) setEmail(s.email); }
    } catch { /* ignore */ }
  }, []);
  // Logged in: load the address book and pick the default address.
  useEffect(() => {
    if (!me) { setSaved(null); return; }
    if (me.email) setEmail((e) => e || me.email);
    accountApi<{ addresses: SavedAddress[] }>("addresses").then((r) => {
      setSaved(r.addresses);
      const d = r.addresses.find((a) => a.is_default) ?? r.addresses[0];
      if (d) setPick(d.id);
      else setAddr((x) => ({ ...x, name: x.name || me.name, phone: x.phone || me.phone }));
    }).catch(() => setSaved([]));
  }, [me]);

  const rows = lines
    .map((l) => ({ line: l, p: products.find((x) => x.slug === l.slug) }))
    .filter((r): r is { line: typeof r.line; p: Product } => !!r.p && r.p.priceInr !== null);
  const subtotal = rows.reduce((s, r) => s + r.line.qty * (r.p.priceInr ?? 0), 0);
  const shipping = shippingFor(settings, subtotal);
  const fee = pay === "cod" ? codFee : 0;
  const discount = applied?.discount ?? 0;
  const total = Math.max(0, subtotal + (shipping ?? 0) + fee - discount);
  const items = rows.map((r) => ({ slug: r.p.slug, qty: r.line.qty }));

  // Re-check the coupon when the cart changes.
  useEffect(() => { if (applied) setApplied(null); setCouponMsg(""); }, [subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ready && rows.length === 0) {
    return (
      <div className="cart-empty">
        <h1 className="display">Nothing to check out</h1>
        <p className="muted">Your cart is empty.</p>
        <Link href="/shop/" className="btn btn-glow">Shop gifts</Link>
      </div>
    );
  }

  const chosen: Addr | null = me && pick !== "new" ? saved?.find((a) => a.id === pick) ?? null : addr;
  const loginDone = !!me || (guest && !mustLogin);

  async function applyCoupon() {
    setCouponMsg("");
    if (!coupon.trim()) return;
    try {
      const r = await fetch("/api/order/coupon", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: coupon, items, phone: chosen?.phone }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not check the coupon");
      setApplied(d);
    } catch (e) {
      setApplied(null);
      setCouponMsg(e instanceof Error ? e.message : "Could not check the coupon");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!loginDone) { setError(mustLogin ? "Please log in with your mobile number first." : "Please log in, or choose “Continue as guest”."); return; }
    if (!chosen) { setError("Please choose a delivery address."); return; }
    const p = addrProblem(chosen);
    if (p) { setError(p); return; }
    if (!consent) { setError("Please accept the privacy policy to continue."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items,
          customer: { name: chosen.name, phone: chosen.phone, email, address: chosen.address, city: chosen.city, state: chosen.state, pincode: chosen.pincode },
          gift_message: gift.gift_message, notes: gift.notes, occasion: gift.occasion,
          coupon: applied?.code ?? "", payment_method: pay,
          save_address: !!me && pick === "new" && saveAddr,
          consent: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not place the order. Please try again.");
      if (!me) {
        try { localStorage.setItem(SAVED, JSON.stringify({ ...chosen, email })); } catch { /* ignore */ }
      }
      saveLastOrder({ number: data.number, phone: chosen.phone.replace(/\D/g, "").slice(-10), total: data.total, shipping: data.shipping, upi_id: data.upi_id ?? "", payment_method: data.payment_method });
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

        {/* 1. LOGIN */}
        <div className={`step-card${loginDone ? " done" : " now"}`}>
          <div className="step-head"><span className="step-num">1</span><h2>Login</h2>
            {me && <span className="step-sum">{me.name || "You"} · +91 {me.phone} <button type="button" className="link-btn" onClick={() => logout()}>Change</button></span>}
            {!me && guest && !mustLogin && <span className="step-sum">Guest checkout <button type="button" className="link-btn" onClick={() => setGuest(false)}>Log in instead</button></span>}
          </div>
          {!me && !guest && accReady && (
            <div className="step-body">
              <LoginBox compact />
              {!mustLogin && (
                <div className="guest-row">
                  <span className="muted">No account? You can still order.</span>
                  <button type="button" className="btn btn-outline small" onClick={() => setGuest(true)}>Continue as guest →</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. ADDRESS */}
        <div className={`step-card${loginDone ? " now" : " later"}`}>
          <div className="step-head"><span className="step-num">2</span><h2>Delivery address</h2></div>
          {loginDone && (
            <div className="step-body">
              {me && saved && saved.length > 0 && (
                <div className="addr-pick" role="radiogroup" aria-label="Saved addresses">
                  {saved.map((a) => (
                    <label key={a.id} className={`addr-option${pick === a.id ? " on" : ""}`}>
                      <input type="radio" name="addr" checked={pick === a.id} onChange={() => setPick(a.id)} />
                      <span><b>{a.name}</b> <span className="addr-label">{a.label}</span><br />{a.address}, {a.city}, {a.state} {a.pincode}<br /><span className="muted">+91 {a.phone}</span></span>
                    </label>
                  ))}
                  <label className={`addr-option${pick === "new" ? " on" : ""}`}>
                    <input type="radio" name="addr" checked={pick === "new"} onChange={() => { setPick("new"); setAddr((x) => ({ ...x, name: x.name || me.name, phone: x.phone || me.phone })); }} />
                    <span><b>+ Deliver to a new address</b></span>
                  </label>
                </div>
              )}
              {(!me || pick === "new") && (
                <>
                  <AddressFields v={addr} onChange={(k, v) => setAddr((x) => ({ ...x, [k]: v }))} />
                  {me && <label className="consent"><input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} /><span>Save this address to my account</span></label>}
                </>
              )}
              <label className="form-field" style={{ maxInlineSize: 420 }}>Email for the receipt (optional)<input type="email" autoComplete="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            </div>
          )}
        </div>

        {/* 3. GIFT */}
        <div className={`step-card${loginDone ? " now" : " later"}`}>
          <div className="step-head"><span className="step-num">3</span><h2>Make it a gift <small>(optional)</small></h2></div>
          {loginDone && (
            <div className="step-body form-grid">
              <label className="form-field">What&apos;s the occasion?
                <select value={gift.occasion} onChange={(e) => setGift({ ...gift, occasion: e.target.value })}>
                  <option value="">Choose…</option>
                  {props.occasions.map((o) => <option key={o.slug}>{o.name}</option>)}
                  <option>Just because</option>
                </select>
              </label>
              <label className="form-field wide">Message for the card<textarea rows={2} maxLength={300} placeholder="e.g. Happy birthday Ammi, with love from Sana" value={gift.gift_message} onChange={(e) => setGift({ ...gift, gift_message: e.target.value })} /><small>Handwritten on our card, in English, Hindi or Urdu.</small></label>
              <label className="form-field wide">Anything else?<input maxLength={500} placeholder="Name to personalise, delivery date, wrap colour…" value={gift.notes} onChange={(e) => setGift({ ...gift, notes: e.target.value })} /></label>
            </div>
          )}
        </div>

        {/* 4. PAYMENT */}
        <div className={`step-card${loginDone ? " now" : " later"}`}>
          <div className="step-head"><span className="step-num">4</span><h2>Payment</h2></div>
          {loginDone && (
            <div className="step-body pay-options" role="radiogroup" aria-label="Payment method">
              <label className={`addr-option${pay === "upi" ? " on" : ""}`}>
                <input type="radio" name="pay" checked={pay === "upi"} onChange={() => setPay("upi")} />
                <span><b>UPI</b> <span className="tag-rec">Recommended</span><br /><span className="muted">GPay, PhonePe, Paytm or any UPI app. {settings.upi_id ? "Pay on the next screen." : "We send the payment link on WhatsApp."}</span></span>
              </label>
              {codOn && (
                <label className={`addr-option${pay === "cod" ? " on" : ""}`}>
                  <input type="radio" name="pay" checked={pay === "cod"} onChange={() => setPay("cod")} />
                  <span><b>Cash on delivery</b>{codFee > 0 && <> · <span className="muted">+{formatInr(codFee)} fee</span></>}<br /><span className="muted">Pay the delivery person in cash or UPI.</span></span>
                </label>
              )}
            </div>
          )}
        </div>
      </section>

      <aside className="cart-summary">
        <h2>Price details</h2>
        <ul className="sum-items">
          {rows.map(({ line, p }) => (
            <li key={p.slug}><span>{p.name} × {line.qty}</span><b>{formatInr(line.qty * (p.priceInr ?? 0))}</b></li>
          ))}
        </ul>
        <div className="coupon-box">
          {applied ? (
            <div className="coupon-ok"><span>🏷️ <b>{applied.code}</b> applied · {applied.label}</span><button type="button" className="link-btn" onClick={() => { setApplied(null); setCoupon(""); }}>Remove</button></div>
          ) : (
            <div className="field-row">
              <input aria-label="Coupon code" placeholder="Coupon code" maxLength={24} value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }} />
              <button type="button" className="btn btn-outline small" onClick={applyCoupon}>Apply</button>
            </div>
          )}
          {couponMsg && <small className="coupon-err" role="alert">{couponMsg}</small>}
        </div>
        <div className="sum-row"><span>Items ({rows.reduce((s, r) => s + r.line.qty, 0)})</span><b>{formatInr(subtotal)}</b></div>
        {discount > 0 && <div className="sum-row save"><span>Coupon discount</span><b>−{formatInr(discount)}</b></div>}
        <div className="sum-row"><span>Delivery</span><b>{shipping === null ? "Confirmed on WhatsApp" : shipping === 0 ? <span className="free">FREE</span> : formatInr(shipping)}</b></div>
        {fee > 0 && <div className="sum-row"><span>Cash on delivery fee</span><b>{formatInr(fee)}</b></div>}
        <div className="sum-row total"><span>Total</span><b>{formatInr(total)}</b></div>
        {discount > 0 && <p className="save-note">You save {formatInr(discount)} on this order 🎉</p>}
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I agree that Insi House uses my details to deliver this order, as in the <Link href="/policies/privacy/" target="_blank">privacy policy</Link>.</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-glow" disabled={busy || !ready}>{busy ? "Placing order…" : `Place order · ${formatInr(total)}`}</button>
        <p className="secure-note">🔒 Secure checkout · prices checked on our server</p>
        <Link href="/cart/" className="link-more" style={{ textAlign: "center" }}>← Back to cart</Link>
        {me && <p className="muted" style={{ margin: 0, fontSize: 13, textAlign: "center" }}>Ordering as {firstName(me) || `+91 ${me.phone}`}</p>}
      </aside>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Occasion } from "@/data/catalog";
import { useAccount } from "@/lib/account";
import { whatsappLink } from "@/lib/site";

const BUDGETS = ["Under ₹200 per gift", "₹200 – ₹500 per gift", "₹500 – ₹1,000 per gift", "₹1,000 – ₹2,500 per gift", "Above ₹2,500 per gift", "Not sure yet"];

export function EnquiryForm({ occasions }: { occasions: Occasion[] }) {
  const { me } = useAccount();
  const [f, setF] = useState({ name: "", phone: "", email: "", occasion: "", event_date: "", quantity: "", budget: "", city: "", message: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const o = occasions.find((x) => x.slug === u.get("o"));
    const product = u.get("product");
    setF((x) => ({ ...x, occasion: o?.name ?? x.occasion, message: product ? `I'm interested in: ${product.replace(/-/g, " ")}` : x.message }));
  }, [occasions]);
  useEffect(() => {
    if (me) setF((x) => ({ ...x, name: x.name || me.name, phone: x.phone || me.phone, email: x.email || me.email }));
  }, [me]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[6-9][0-9]{9}$/.test(f.phone.replace(/\D/g, "").slice(-10))) { setError("Please enter a valid 10-digit mobile number."); return; }
    if (!consent) { setError("Please accept the privacy policy so we can contact you."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/enquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, quantity: f.quantity || null, consent: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not send. Please try again.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="form-card done-card" role="status">
        <span className="order-tick" aria-hidden="true">✓</span>
        <h2>Thank you, {f.name.split(" ")[0] || "we got it"}!</h2>
        <p className="muted" style={{ margin: 0 }}>We&apos;ll message you on WhatsApp with ideas and prices, usually within a day.</p>
        <a className="btn btn-outline" href={whatsappLink(`Hello Insi House! I just sent an enquiry for ${f.occasion || "an event"}${f.event_date ? ` on ${f.event_date}` : ""}${f.quantity ? `, about ${f.quantity} gifts` : ""}.`)} target="_blank" rel="noopener noreferrer">Message us now on WhatsApp</a>
        <Link href="/shop/" className="link-more">Browse gifts meanwhile →</Link>
      </div>
    );
  }

  return (
    <form className="form-card enquiry" onSubmit={submit} noValidate>
      <h2>Tell us about your event</h2>
      <div className="form-grid">
        <label className="form-field">Your name *<input required maxLength={100} autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label className="form-field">Mobile (WhatsApp) *<input required type="tel" inputMode="tel" autoComplete="tel-national" maxLength={14} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label className="form-field">Occasion
          <select value={f.occasion} onChange={(e) => set("occasion", e.target.value)}>
            <option value="">Choose…</option>
            {occasions.map((o) => <option key={o.slug}>{o.name}</option>)}
            <option>Corporate / office gifting</option>
            <option>Other</option>
          </select>
        </label>
        <label className="form-field">Event date<input type="date" value={f.event_date} onChange={(e) => set("event_date", e.target.value)} /></label>
        <label className="form-field">How many gifts?<input inputMode="numeric" maxLength={6} placeholder="e.g. 50" value={f.quantity} onChange={(e) => set("quantity", e.target.value.replace(/\D/g, ""))} /></label>
        <label className="form-field">Budget
          <select value={f.budget} onChange={(e) => set("budget", e.target.value)}>
            <option value="">Choose…</option>
            {BUDGETS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="form-field">Delivery city<input maxLength={60} autoComplete="address-level2" value={f.city} onChange={(e) => set("city", e.target.value)} /></label>
        <label className="form-field">Email (optional)<input type="email" maxLength={120} autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label className="form-field wide">What would you like?<textarea rows={3} maxLength={1500} placeholder="e.g. 80 small black-pottery diyas in haldi-yellow boxes with our names on the card" value={f.message} onChange={(e) => set("message", e.target.value)} /></label>
        <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} /></label>
      </div>
      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Insi House may contact me on WhatsApp or phone about this enquiry, as in the <Link href="/policies/privacy/" target="_blank">privacy policy</Link>.</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-glow" disabled={busy}>{busy ? "Sending…" : "Send enquiry"}</button>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib";
import { useAdmin } from "../AdminApp";
import { Field, Loading, PageHead } from "./ui";

type S = { whatsapp: string; email: string; announcement: string; delivery: string; instagram: string; upi_id: string; shipping_fee: string; free_shipping_above: string; require_login: string; cod_enabled: string; cod_fee: string; hold_hours: string };

export function SettingsView() {
  const { user, toast, fail } = useAdmin();
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const owner = user.role === "owner";

  useEffect(() => {
    if (owner) api<{ settings: S }>("settings").then((r) => setS(r.settings)).catch(fail);
  }, [owner, fail]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await api("settings", { method: "PUT", body: s }); toast("Settings saved. The website will update in a few minutes."); } catch (err) { fail(err); } finally { setBusy(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.again) { toast("The two new passwords are not the same", "err"); return; }
    try { await api("me/password", { method: "PUT", body: { current: pw.current, next: pw.next } }); toast("Password changed"); setPw({ current: "", next: "", again: "" }); } catch (err) { fail(err); }
  }

  const set = (k: keyof S, v: string) => setS((x) => (x ? { ...x, [k]: v } : x));

  return (
    <>
      <PageHead title={owner ? "Settings" : "My account"} sub={owner ? "Store details shown on the website." : undefined} />
      {owner && (!s ? <Loading /> : (
        <form className="adm-card" onSubmit={save}>
          <h2>Store details</h2>
          <div className="adm-grid">
            <Field label="WhatsApp number for orders" hint="91 + your 10-digit number, e.g. 919876543210. Every “Order on WhatsApp” button uses it.">
              <input inputMode="numeric" maxLength={14} value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value.replace(/[^0-9]/g, ""))} placeholder="91XXXXXXXXXX" />
            </Field>
            <Field label="Business email" hint="Shown in the footer.">
              <input type="email" maxLength={120} value={s.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Instagram username" hint="Without @. Shown in the footer.">
              <input maxLength={60} value={s.instagram} onChange={(e) => set("instagram", e.target.value)} />
            </Field>
            <Field label="UPI ID for payments" hint="Use a merchant UPI ID (PhonePe / Paytm / GPay for Business), e.g. insihouse@ybl. Customers see a “Pay by UPI” button after ordering. Empty = you send the payment link on WhatsApp.">
              <input maxLength={80} value={s.upi_id} onChange={(e) => set("upi_id", e.target.value)} />
            </Field>
            <Field label="Delivery charge (₹)" hint="Added to every website order. Leave empty if you confirm delivery charges on WhatsApp.">
              <input inputMode="numeric" maxLength={6} value={s.shipping_fee} onChange={(e) => set("shipping_fee", e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 80" />
            </Field>
            <Field label="Free delivery above (₹)" hint="Orders at or above this amount get free delivery. Leave empty for no free delivery.">
              <input inputMode="numeric" maxLength={7} value={s.free_shipping_above} onChange={(e) => set("free_shipping_above", e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 1999" />
            </Field>
            <Field label="Announcement bar (top of every page)" wide hint="Leave empty to hide it. E.g. “✦ Diwali orders close on 25 Oct ✦”">
              <input maxLength={160} value={s.announcement} onChange={(e) => set("announcement", e.target.value)} />
            </Field>
            <Field label="Delivery line" wide hint="Short line used in the footer and home page.">
              <input maxLength={80} value={s.delivery} onChange={(e) => set("delivery", e.target.value)} />
            </Field>
          </div>
          <h2 style={{ marginBlockStart: 24 }}>Checkout</h2>
          <div className="adm-grid">
            <label className="adm-check wide">
              <input type="checkbox" checked={s.require_login === "1"} onChange={(e) => set("require_login", e.target.checked ? "1" : "0")} />
              <span>Customers must log in before ordering <small>Like Flipkart. Recommended once WhatsApp / SMS login codes are switched on (Settings → WhatsApp &amp; SMS). When off, guests can also order.</small></span>
            </label>
            <label className="adm-check">
              <input type="checkbox" checked={s.cod_enabled === "1"} onChange={(e) => set("cod_enabled", e.target.checked ? "1" : "0")} />
              <span>Offer cash on delivery <small>Customers pay the courier. Check your courier collects COD at your PIN codes.</small></span>
            </label>
            <Field label="Cancel unpaid UPI orders after (hours)" hint="Website orders with no payment and no UTR are cancelled and their stock goes back. 0 = never. Default 48.">
              <input inputMode="numeric" maxLength={3} value={s.hold_hours} onChange={(e) => set("hold_hours", e.target.value.replace(/[^0-9]/g, ""))} placeholder="48" />
            </Field>
            <Field label="Cash on delivery fee (₹)" hint="Added to COD orders only. Empty = no fee.">
              <input inputMode="numeric" maxLength={5} value={s.cod_fee} disabled={s.cod_enabled !== "1"} onChange={(e) => set("cod_fee", e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 50" />
            </Field>
          </div>
          <div className="adm-row end"><button className="adm-btn primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></div>
        </form>
      ))}

      <form className="adm-card" onSubmit={changePassword}>
        <h2>Change my password</h2>
        <p className="adm-muted">Logged in as {user.email}.</p>
        <div className="adm-grid">
          <Field label="Current password"><input type="password" required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="New password" hint="At least 8 characters."><input type="password" required minLength={8} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Field label="New password again"><input type="password" required minLength={8} autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></Field>
        </div>
        <div className="adm-row end"><button className="adm-btn primary">Change password</button></div>
      </form>
    </>
  );
}

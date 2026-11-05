"use client";

import { useState } from "react";
import { api, rupees } from "../lib";
import { useAdmin } from "../AdminApp";
import { Empty, ErrorBox, Field, Loading, PageHead, useLoad } from "./ui";

interface Coupon {
  id: number; code: string; kind: "percent" | "flat"; value: number; min_order: number; max_discount: number | null; starts_at: string | null;
  ends_at: string | null; usage_limit: number | null; per_customer: number; used_count: number; active: number; note: string;
}
const blank = { code: "", kind: "percent" as Coupon["kind"], value: "10", min_order: "0", max_discount: "", starts_at: "", ends_at: "", usage_limit: "", per_customer: "1", active: true, note: "" };
type F = typeof blank & { id?: number };

function describe(c: Coupon) {
  const off = c.kind === "percent" ? `${c.value}% off` : `${rupees(c.value)} off`;
  return `${off}${c.max_discount ? ` (up to ${rupees(c.max_discount)})` : ""}${c.min_order ? ` on orders above ${rupees(c.min_order)}` : ""}`;
}
function state(c: Coupon): { label: string; cls: string } {
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  if (!c.active) return { label: "Off", cls: "" };
  if (c.ends_at && today > c.ends_at) return { label: "Expired", cls: "warn" };
  if (c.starts_at && today < c.starts_at) return { label: "Starts later", cls: "warn" };
  if (c.usage_limit !== null && c.used_count >= c.usage_limit) return { label: "Used up", cls: "warn" };
  return { label: "Live", cls: "ok" };
}

export function Coupons() {
  const { toast, fail, user } = useAdmin();
  const owner = user.role === "owner";
  const { data, error, reload } = useLoad(() => api<{ coupons: Coupon[] }>("coupons"));
  const [f, setF] = useState<F | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    setBusy(true);
    try {
      await api(f.id ? `coupons/${f.id}` : "coupons", { method: f.id ? "PUT" : "POST", body: f });
      toast(f.id ? "Coupon saved" : `Coupon ${f.code.toUpperCase()} created. Share it with customers!`);
      setF(null);
      reload();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function toggle(c: Coupon) {
    try { await api(`coupons/${c.id}`, { method: "PUT", body: { active: !c.active } }); reload(); } catch (e) { fail(e); }
  }
  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try { await api(`coupons/${c.id}`, { method: "DELETE" }); toast("Deleted"); reload(); } catch (e) { fail(e); }
  }
  const edit = (c: Coupon) => setF({
    id: c.id, code: c.code, kind: c.kind, value: String(c.value), min_order: String(c.min_order), max_discount: c.max_discount ? String(c.max_discount) : "",
    starts_at: c.starts_at ?? "", ends_at: c.ends_at ?? "", usage_limit: c.usage_limit ? String(c.usage_limit) : "", per_customer: String(c.per_customer), active: !!c.active, note: c.note,
  });
  const num = (v: string) => v.replace(/\D/g, "");

  return (
    <>
      <PageHead
        title="Coupons"
        sub="Discount codes customers type at checkout, e.g. EID10 or SHAADI500. The website checks every rule before giving the discount."
        actions={owner && !f && <button className="adm-btn primary" onClick={() => setF({ ...blank })}>+ Add coupon</button>}
      />
      {f && (
        <form className="adm-card" onSubmit={save}>
          <h2>{f.id ? `Edit ${f.code}` : "New coupon"}</h2>
          <div className="adm-grid">
            <Field label="Code *" hint="Letters and numbers, e.g. EID10."><input required maxLength={24} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} style={{ textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.06em" }} /></Field>
            <Field label="Discount type">
              <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Coupon["kind"] })}><option value="percent">Percent off (%)</option><option value="flat">Fixed amount off (₹)</option></select>
            </Field>
            <Field label={f.kind === "percent" ? "Percent off *" : "Amount off (₹) *"}><input required inputMode="numeric" value={f.value} onChange={(e) => setF({ ...f, value: num(e.target.value) })} /></Field>
            {f.kind === "percent" && <Field label="Maximum discount (₹)" hint="Optional cap, e.g. 500."><input inputMode="numeric" value={f.max_discount} onChange={(e) => setF({ ...f, max_discount: num(e.target.value) })} /></Field>}
            <Field label="Minimum order (₹)"><input inputMode="numeric" value={f.min_order} onChange={(e) => setF({ ...f, min_order: num(e.target.value) })} /></Field>
            <Field label="Starts on"><input type="date" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></Field>
            <Field label="Ends on" hint="Last day it works."><input type="date" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></Field>
            <Field label="Total uses allowed" hint="Empty = unlimited."><input inputMode="numeric" value={f.usage_limit} onChange={(e) => setF({ ...f, usage_limit: num(e.target.value) })} /></Field>
            <Field label="Uses per customer" hint="0 = unlimited. Checked by mobile number."><input inputMode="numeric" value={f.per_customer} onChange={(e) => setF({ ...f, per_customer: num(e.target.value) })} /></Field>
            <Field label="Note (team only)" wide><input maxLength={200} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. For Instagram followers, Eid 2027" /></Field>
            <label className="adm-check wide"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span>Coupon is on</span></label>
          </div>
          <div className="adm-row end">
            <button type="button" className="adm-btn" onClick={() => setF(null)}>Cancel</button>
            <button className="adm-btn primary" disabled={busy}>{busy ? "Saving…" : "Save coupon"}</button>
          </div>
        </form>
      )}
      {error ? <ErrorBox text={error} retry={reload} /> : !data ? <Loading /> : data.coupons.length === 0 ? (
        <Empty>No coupons yet. {owner ? "Create one for your next festival sale." : "Ask the owner to create one."}</Empty>
      ) : (
        <div className="adm-coupons">
          {data.coupons.map((c) => {
            const st = state(c);
            return (
              <div key={c.id} className={`adm-coupon${c.active ? "" : " off"}`}>
                <div className="adm-coupon-code"><b>{c.code}</b><span className={`adm-tag ${st.cls}`}>{st.label}</span></div>
                <span>{describe(c)}</span>
                <small className="adm-muted">
                  {c.starts_at || c.ends_at ? `${c.starts_at ?? "now"} → ${c.ends_at ?? "no end"} · ` : ""}
                  Used {c.used_count}{c.usage_limit ? ` of ${c.usage_limit}` : ""} time{c.used_count === 1 ? "" : "s"}{c.per_customer ? ` · ${c.per_customer} per customer` : ""}
                </small>
                {c.note && <small className="adm-muted">{c.note}</small>}
                {owner && (
                  <div className="adm-row wrap">
                    <button className="adm-btn small" onClick={() => edit(c)}>Edit</button>
                    <button className="adm-btn small" onClick={() => toggle(c)}>{c.active ? "Turn off" : "Turn on"}</button>
                    <button className="adm-btn small danger" onClick={() => remove(c)}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

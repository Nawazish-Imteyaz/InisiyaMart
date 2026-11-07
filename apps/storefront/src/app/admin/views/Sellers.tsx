"use client";

// Marketplace admin (decision 010): sellers, products to check, category requests.
import { useState } from "react";
import { api, when } from "../lib";
import { useAdmin } from "../AdminApp";
import { Empty, ErrorBox, Field, Loading, PageHead, useLoad } from "./ui";

const ST: Record<string, { label: string; color: string }> = {
  draft: { label: "Filling in", color: "#6e5a63" }, pending: { label: "Waiting for approval", color: "#b35f0a" }, approved: { label: "Open", color: "#2f8a4c" },
  changes: { label: "Changes asked", color: "#c22f63" }, rejected: { label: "Rejected", color: "#6e5a63" }, suspended: { label: "Paused", color: "#a01a3c" },
};
const RV: Record<string, { label: string; color: string }> = {
  pending: { label: "To check", color: "#b35f0a" }, approved: { label: "Live", color: "#2f8a4c" }, changes: { label: "Fix asked", color: "#c22f63" }, rejected: { label: "Rejected", color: "#6e5a63" },
};

interface SellerRow {
  id: number; slug: string; shop_name: string; maker_name: string; full_name: string; district: string; state: string; status: string; gst_type: string;
  phone: string | null; products: number; to_check: number; submitted_at: string | null; created_at: string;
}
interface Counts { pending: number; approved: number; draft: number; products_to_check: number; category_requests: number }

export function SellerList() {
  const [filter, setFilter] = useState("");
  const { data, error, reload } = useLoad(() => api<{ sellers: SellerRow[]; counts: Counts }>(`sellers${filter ? `?status=${filter}` : ""}`), [filter]);
  const c = data?.counts;
  return (
    <>
      <PageHead title="Sellers" sub="Makers who opened a shop. Approve new shops, check their first products and answer category requests." />
      {c && (
        <div className="adm-mk-quick">
          <a href="#/sellers/review" className="adm-card"><b>{c.products_to_check ?? 0}</b><span>Products to check</span></a>
          <a href="#/sellers/categories" className="adm-card"><b>{c.category_requests ?? 0}</b><span>Category requests</span></a>
          <button type="button" className="adm-card" onClick={() => setFilter("pending")}><b>{c.pending ?? 0}</b><span>Shops waiting</span></button>
          <button type="button" className="adm-card" onClick={() => setFilter("approved")}><b>{c.approved ?? 0}</b><span>Open shops</span></button>
        </div>
      )}
      <div className="adm-tabs" role="tablist">
        <button role="tab" aria-selected={!filter} onClick={() => setFilter("")}>All</button>
        {Object.entries(ST).map(([v, s]) => <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}>{s.label}</button>)}
      </div>
      {error ? <ErrorBox text={error} retry={reload} /> : !data ? <Loading /> : data.sellers.length === 0 ? (
        <Empty>No sellers here yet. Share <b>insihouse.pages.dev/sell/</b> with makers.</Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Shop</th><th>Maker</th><th>Place</th><th>Products</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {data.sellers.map((s) => (
                <tr key={s.id}>
                  <td><a href={`#/sellers/${s.id}`}><b>{s.shop_name}</b></a>{s.gst_type !== "none" && <span className="adm-tag">GST</span>}</td>
                  <td>{s.maker_name}<small className="adm-block adm-muted">{s.full_name}{s.phone ? ` · ${s.phone}` : ""}</small></td>
                  <td>{s.district}, {s.state}</td>
                  <td>{s.products}{s.to_check > 0 && <span className="adm-tag warn">{s.to_check} to check</span>}</td>
                  <td><span className="adm-status" style={{ background: ST[s.status]?.color }}>{ST[s.status]?.label ?? s.status}</span></td>
                  <td>{when(s.submitted_at ?? s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface SellerFull extends Record<string, unknown> {
  id: number; slug: string; shop_name: string; maker_name: string; status: string; review_note: string; admin_note: string; photo: string | null; login_phone: string | null;
}
interface SProduct { id: number; slug: string; name: string; price_inr: number; stock: number; status: string; review_status: string; review_note: string; category_name: string; image_key: string | null }

export function SellerView({ id }: { id: number }) {
  const { toast, fail, user } = useAdmin();
  const { data, error, reload } = useLoad(() => api<{ seller: SellerFull; products: SProduct[]; activity: { actor: string; action: string; detail: string; created_at: string }[]; requests: { id: number; name: string; status: string }[] }>(`sellers/${id}`), [id]);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<string | null>(null);
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;
  const s = data.seller;
  const owner = user.role === "owner";

  async function act(action: string, extra: Record<string, unknown> = {}) {
    try { await api(`sellers/${id}`, { method: "PUT", body: { action, review_note: message, ...extra } }); toast("Saved"); setMessage(""); reload(); } catch (e) { fail(e); }
  }
  async function saveNote() {
    try { await api(`sellers/${id}`, { method: "PUT", body: { admin_note: note } }); toast("Note saved"); setNote(null); reload(); } catch (e) { fail(e); }
  }
  const row = (label: string, k: string) => (s[k] ? <span key={k}><small>{label}</small><b>{String(s[k])}</b></span> : null);

  return (
    <>
      <PageHead title={s.shop_name} sub={`${s.maker_name} · ${String(s.district)}, ${String(s.state)}`}
        actions={<>
          <span className="adm-status" style={{ background: ST[s.status]?.color }}>{ST[s.status]?.label ?? s.status}</span>
          {s.status === "approved" && <a className="adm-btn" href={`/maker/?s=${s.slug}`} target="_blank" rel="noopener noreferrer">Open shop page ↗</a>}
        </>} />
      {s.id !== 1 && (
        <section className="adm-card">
          <h2>Decision</h2>
          <Field label="Message to the seller (needed for “ask for changes” and “reject”)" wide>
            <textarea rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Please add clearer photos in daylight." />
          </Field>
          <div className="adm-row">
            {(s.status === "pending" || s.status === "changes" || s.status === "draft") && <>
              <button className="adm-btn primary" onClick={() => act("approve", { with_products: true })}>Approve shop + its products</button>
              <button className="adm-btn" onClick={() => act("approve")}>Approve shop only</button>
              <button className="adm-btn" onClick={() => act("changes")}>Ask for changes</button>
              {owner && <button className="adm-btn danger" onClick={() => act("reject")}>Reject</button>}
            </>}
            {s.status === "approved" && owner && <button className="adm-btn danger" onClick={() => confirm("Pause this shop? Its products disappear from the website.") && act("suspend")}>Pause shop</button>}
            {(s.status === "suspended" || s.status === "rejected") && owner && <button className="adm-btn primary" onClick={() => act("reactivate")}>Open shop again</button>}
          </div>
        </section>
      )}
      <section className="adm-card">
        <h2>Shop details</h2>
        <div className="adm-enq-facts">
          {row("Shop name", "shop_name")}{row("Maker (public)", "maker_name")}{row("Makes", "craft")}{row("District", "district")}{row("State", "state")}
        </div>
        {s.story ? <p className="adm-enq-msg">“{String(s.story)}”</p> : null}
        <h3 className="adm-mk-private">🔒 Private (never shown to buyers)</h3>
        <div className="adm-enq-facts">
          {row("Full name", "full_name")}{row("Login mobile", "login_phone")}{row("Contact mobile", "contact_phone")}{row("Address", "address")}{row("PIN", "pincode")}
          {row("UPI ID", "upi_id")}{row("Bank", "bank_name")}{row("Account", "bank_account")}{row("IFSC", "bank_ifsc")}{row("PAN", "pan")}
          <span><small>GST</small><b>{s.gst_type === "none" ? "No GST" : `${String(s.gst_type)}: ${String(s.gst_id)}`}</b></span>
          {row("Promised handmade on", "undertaking_at")}
        </div>
        <div className="adm-enq-note">
          <input placeholder="Private admin note" maxLength={1000} value={note ?? s.admin_note} onChange={(e) => setNote(e.target.value)} />
          {note !== null && note !== s.admin_note && <button className="adm-btn small" onClick={saveNote}>Save</button>}
        </div>
      </section>
      <section className="adm-card">
        <h2>Products ({data.products.length})</h2>
        {data.products.length === 0 ? <p className="adm-muted">No products yet.</p> : (
          <ul className="adm-mk-prods">
            {data.products.map((p) => (
              <li key={p.id}>
                {p.image_key
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/img/${p.image_key}`} alt="" />
                  : <span className="adm-mk-noimg">📷</span>}
                <span><a href={`#/products/${p.id}`}><b>{p.name}</b></a><small className="adm-muted">₹{p.price_inr} · {p.category_name} · stock {p.stock}{p.status === "hidden" ? " · hidden by seller" : ""}</small></span>
                <span className="adm-status" style={{ background: RV[p.review_status]?.color }}>{RV[p.review_status]?.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="adm-card">
        <h2>Activity log</h2>
        <ul className="adm-mk-log">
          {data.activity.map((a, i) => <li key={i}><span><b>{a.actor === "seller" ? "Seller" : a.actor.replace("admin:", "🛡 ")}</b>: {a.action}{a.detail ? ` · ${a.detail}` : ""}</span><small>{when(a.created_at)}</small></li>)}
        </ul>
      </section>
    </>
  );
}

interface RProduct {
  id: number; name: string; summary: string; details: string; price_inr: number; mrp_inr: number | null; stock: number; made_by: string; technique: string; materials: string;
  made_to_order_days: number | null; requested_category: string; category_name: string; seller_id: number; shop_name: string; seller_status: string; images: string[];
}

export function ReviewQueue() {
  const { toast, fail, refreshBell } = useAdmin();
  const { data, error, reload } = useLoad(() => api<{ products: RProduct[] }>("review"));
  const [notes, setNotes] = useState<Record<number, string>>({});
  async function act(p: RProduct, action: string) {
    try { await api(`review/${p.id}`, { method: "PUT", body: { action, note: notes[p.id] ?? "" } }); toast(action === "approve" ? "Approved: live on the website" : "Sent back to the seller"); reload(); refreshBell(); } catch (e) { fail(e); }
  }
  return (
    <>
      <PageHead title="Products to check" sub="New sellers' first products, and products changed after you asked for a fix. Check: handmade? clear photos? fair description?" />
      {error ? <ErrorBox text={error} retry={reload} /> : !data ? <Loading /> : data.products.length === 0 ? <Empty>Nothing to check. ✓</Empty> : (
        <div className="adm-enq-list">
          {data.products.map((p) => (
            <article key={p.id} className="adm-card adm-enq">
              <div className="adm-enq-head">
                <div><b className="adm-enq-name">{p.name}</b><span className="adm-muted"> · <a href={`#/sellers/${p.seller_id}`}>{p.shop_name}</a>{p.seller_status !== "approved" ? ` (shop ${ST[p.seller_status]?.label.toLowerCase() ?? p.seller_status})` : ""}</span></div>
                <b>₹{p.price_inr}{p.mrp_inr ? <s className="adm-muted"> ₹{p.mrp_inr}</s> : null}</b>
              </div>
              <div className="adm-mk-photos">
                {p.images.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={src} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt="" /></a>
                ))}
                {p.images.length === 0 && <span className="adm-tag warn">No photos</span>}
              </div>
              <div className="adm-enq-facts">
                <span><small>Category</small><b>{p.category_name}{p.requested_category ? ` → asks for “${p.requested_category}”` : ""}</b></span>
                <span><small>Made by</small><b>{p.made_by}</b></span>
                {p.technique && <span><small>Craft</small><b>{p.technique}</b></span>}
                {p.materials && <span><small>Materials</small><b>{p.materials}</b></span>}
                <span><small>Stock</small><b>{p.made_to_order_days ? `made to order, ${p.made_to_order_days} days` : p.stock}</b></span>
              </div>
              <p className="adm-enq-msg">{p.summary}</p>
              {p.details && <p className="adm-muted" style={{ whiteSpace: "pre-line" }}>{p.details}</p>}
              <div className="adm-enq-note"><input placeholder="Message to the seller (needed to ask for a fix or reject)" maxLength={500} value={notes[p.id] ?? ""} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} /></div>
              <div className="adm-enq-actions">
                <button className="adm-btn small primary" onClick={() => act(p, "approve")}>Approve</button>
                <button className="adm-btn small" onClick={() => act(p, "changes")}>Ask for a fix</button>
                <button className="adm-btn small danger" onClick={() => act(p, "reject")}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

interface CReq { id: number; name: string; status: string; admin_note: string; created_at: string; product_name: string | null; seller_id: number; shop_name: string; same_asks: number }

export function CategoryRequests() {
  const { toast, fail } = useAdmin();
  const { data, error, reload } = useLoad(() => Promise.all([
    api<{ requests: CReq[] }>("category-requests"), api<{ categories: { id: number; name: string }[] }>("categories"),
  ]));
  const [merge, setMerge] = useState<Record<number, string>>({});
  const [names, setNames] = useState<Record<number, string>>({});
  async function act(r: CReq, action: string) {
    const body: Record<string, unknown> = { action };
    if (action === "approve") body.name = names[r.id] ?? r.name;
    if (action === "merge") { if (!merge[r.id]) return fail(new Error("Choose the category to move it into")); body.category_id = Number(merge[r.id]); }
    try { await api(`category-requests/${r.id}`, { method: "PUT", body }); toast("Done"); reload(); } catch (e) { fail(e); }
  }
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;
  const [{ requests }, { categories }] = data;
  return (
    <>
      <PageHead title="Category requests" sub="Sellers put products under “Other handmade” and asked for a new category. Add it, move them into an existing one, or say no." />
      {requests.length === 0 ? <Empty>No requests yet.</Empty> : (
        <div className="adm-enq-list">
          {requests.map((r) => (
            <article key={r.id} className="adm-card adm-enq">
              <div className="adm-enq-head">
                <div><b className="adm-enq-name">“{r.name}”</b><span className="adm-muted"> · {r.shop_name}{r.product_name ? ` · for “${r.product_name}”` : ""} · {when(r.created_at)}</span></div>
                {r.status === "pending" ? (r.same_asks > 1 ? <span className="adm-tag warn">{r.same_asks} sellers asked</span> : null) : <span className="adm-status" style={{ background: r.status === "approved" ? "#2f8a4c" : "#6e5a63" }}>{r.status}</span>}
              </div>
              {r.status === "pending" && (
                <div className="adm-enq-actions">
                  <input aria-label="Category name" value={names[r.id] ?? r.name} onChange={(e) => setNames({ ...names, [r.id]: e.target.value })} maxLength={60} />
                  <button className="adm-btn small primary" onClick={() => act(r, "approve")}>Add as new category</button>
                  <select aria-label="Existing category" value={merge[r.id] ?? ""} onChange={(e) => setMerge({ ...merge, [r.id]: e.target.value })}>
                    <option value="">…or move to existing</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button className="adm-btn small" onClick={() => act(r, "merge")}>Move</button>
                  <button className="adm-btn small danger" onClick={() => act(r, "reject")}>No</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

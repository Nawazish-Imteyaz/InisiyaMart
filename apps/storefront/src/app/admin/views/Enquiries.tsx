"use client";

import { useState } from "react";
import { api, when } from "../lib";
import { useAdmin } from "../AdminApp";
import { Empty, ErrorBox, Loading, PageHead, useLoad } from "./ui";

interface Enq {
  id: number; name: string; phone: string; email: string; occasion: string; event_date: string; quantity: number | null; budget: string;
  city: string; message: string; status: "new" | "contacted" | "quoted" | "won" | "lost"; admin_note: string; created_at: string;
}
const STATUS = [
  { v: "new", label: "New", color: "#c22f63" },
  { v: "contacted", label: "Contacted", color: "#7a52b8" },
  { v: "quoted", label: "Quote sent", color: "#b35f0a" },
  { v: "won", label: "Order confirmed", color: "#2f8a4c" },
  { v: "lost", label: "Not going ahead", color: "#6e5a63" },
] as const;

export function Enquiries() {
  const { toast, fail, user, refreshBell } = useAdmin();
  const [filter, setFilter] = useState("");
  const { data, error, reload } = useLoad(() => api<{ enquiries: Enq[] }>(`enquiries${filter ? `?status=${filter}` : ""}`), [filter]);
  const [notes, setNotes] = useState<Record<number, string>>({});

  async function put(e: Enq, body: Record<string, unknown>, msg: string) {
    try { await api(`enquiries/${e.id}`, { method: "PUT", body }); toast(msg); reload(); refreshBell(); } catch (err) { fail(err); }
  }
  async function remove(e: Enq) {
    if (!confirm(`Delete the enquiry from ${e.name}?`)) return;
    try { await api(`enquiries/${e.id}`, { method: "DELETE" }); toast("Deleted"); reload(); } catch (err) { fail(err); }
  }

  return (
    <>
      <PageHead title="Event enquiries" sub="Wedding, haldi, mehndi, bulk and return-gift requests from the website's Weddings & events page." />
      <div className="adm-tabs" role="tablist">
        <button role="tab" aria-selected={!filter} onClick={() => setFilter("")}>All</button>
        {STATUS.map((s) => <button key={s.v} role="tab" aria-selected={filter === s.v} onClick={() => setFilter(s.v)}>{s.label}</button>)}
      </div>
      {error ? <ErrorBox text={error} retry={reload} /> : !data ? <Loading /> : data.enquiries.length === 0 ? (
        <Empty>No enquiries {filter ? "with this status" : "yet"}. Share the link <b>insihouse.pages.dev/events/</b> with wedding customers.</Empty>
      ) : (
        <div className="adm-enq-list">
          {data.enquiries.map((e) => {
            const s = STATUS.find((x) => x.v === e.status) ?? STATUS[0];
            const wa = `https://wa.me/91${e.phone}?text=${encodeURIComponent(`Hello ${e.name.split(" ")[0]}! This is Insi House. Thank you for your ${e.occasion || "event"} enquiry${e.quantity ? ` for ${e.quantity} gifts` : ""}. `)}`;
            return (
              <article key={e.id} className="adm-card adm-enq">
                <div className="adm-enq-head">
                  <div>
                    <b className="adm-enq-name">{e.name}</b>
                    <span className="adm-muted"> · {when(e.created_at)}</span>
                  </div>
                  <span className="adm-status" style={{ background: s.color }}>{s.label}</span>
                </div>
                <div className="adm-enq-facts">
                  {e.occasion && <span><small>Occasion</small><b>{e.occasion}</b></span>}
                  {e.event_date && <span><small>Event date</small><b>{new Date(`${e.event_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</b></span>}
                  {e.quantity && <span><small>Gifts</small><b>{e.quantity}</b></span>}
                  {e.budget && <span><small>Budget</small><b>{e.budget}</b></span>}
                  {e.city && <span><small>City</small><b>{e.city}</b></span>}
                  <span><small>Mobile</small><b>{e.phone}</b></span>
                </div>
                {e.message && <p className="adm-enq-msg">“{e.message}”</p>}
                <div className="adm-enq-actions">
                  <a className="adm-btn small primary" href={wa} target="_blank" rel="noopener noreferrer">Reply on WhatsApp</a>
                  <select className="adm-select-status" value={e.status} onChange={(ev) => put(e, { status: ev.target.value }, "Status updated")} aria-label="Status">
                    {STATUS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                  </select>
                  {user.role === "owner" && <button className="adm-btn small danger" onClick={() => remove(e)}>Delete</button>}
                </div>
                <div className="adm-enq-note">
                  <input placeholder="Private note (e.g. sent 3 photos, waiting for reply)" maxLength={1000} value={notes[e.id] ?? e.admin_note} onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })} />
                  {notes[e.id] !== undefined && notes[e.id] !== e.admin_note && <button className="adm-btn small" onClick={() => put(e, { admin_note: notes[e.id] }, "Note saved")}>Save</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

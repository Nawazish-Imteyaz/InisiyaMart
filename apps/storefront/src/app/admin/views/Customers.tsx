"use client";

import { useEffect, useState } from "react";
import { api, rupees, statusLabel, when } from "../lib";
import { go, useAdmin } from "../AdminApp";
import { Empty, ErrorBox, Loading, PageHead, useLoad } from "./ui";

type Tab = "registered" | "guests" | "deleted";
interface Row {
  id?: number; phone: string; phone_verified?: number; name: string; email?: string; status?: string; city?: string; admin_note?: string;
  orders: number; spent: number; last_order?: string; last_login_at?: string | null; created_at?: string; deleted_at?: string | null;
}
interface Counts { registered: number | null; deleted: number | null; blocked: number | null; guests: number }

export function CustomerList({ tab }: { tab: Tab }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => { const t = window.setTimeout(() => setSearch(q), 300); return () => window.clearTimeout(t); }, [q]);
  const { data, error, reload } = useLoad(() => api<{ customers: Row[]; counts: Counts }>(`customers?tab=${tab}&q=${encodeURIComponent(search)}`), [tab, search]);
  const c = data?.counts;
  const title = tab === "deleted" ? "Deleted accounts" : "Customers";

  return (
    <>
      <PageHead
        title={title}
        sub={tab === "deleted" ? "Accounts closed by the customer or by you. Personal details are erased; order records stay for tax." : "Everyone who made an account or ordered from you."}
        actions={<span className="adm-count">{tab === "deleted" ? `${c?.deleted ?? 0} accounts` : `${(c?.registered ?? 0) + (c?.guests ?? 0)} customers`}</span>}
      />
      <div className="adm-toolbar">
        {tab !== "deleted" && (
          <div className="adm-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "registered"} onClick={() => go("/customers")}>With account <span className="adm-tab-n">{c?.registered ?? 0}</span></button>
            <button role="tab" aria-selected={tab === "guests"} onClick={() => go("/customers/guests")}>Guest buyers <span className="adm-tab-n">{c?.guests ?? 0}</span></button>
          </div>
        )}
        {tab === "deleted" && <a className="adm-btn small" href="#/customers">← Back to customers</a>}
        <input type="search" placeholder="Search name, mobile or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? <ErrorBox text={error} retry={reload} /> : !data ? <Loading /> : data.customers.length === 0 ? (
        <Empty>{search ? "No customers match your search." : tab === "guests" ? "No guest orders yet." : tab === "deleted" ? "No deleted accounts." : "No customer accounts yet. They appear when someone signs up on the website."}</Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Customer</th><th>Mobile</th><th>Orders</th><th>Spent</th><th>{tab === "guests" ? "Last order" : tab === "deleted" ? "Deleted" : "Joined"}</th>{tab === "registered" && <th>Status</th>}</tr></thead>
            <tbody>
              {data.customers.map((r) => (
                <tr key={r.id ?? r.phone} className={r.id ? "adm-click" : ""} onClick={() => r.id && tab !== "deleted" && go(`/customers/${r.id}`)}>
                  <td><b>{r.name || (tab === "deleted" ? "—" : "No name yet")}</b>{r.email ? <small className="adm-block adm-muted">{r.email}</small> : null}{tab === "deleted" && r.admin_note ? <small className="adm-block adm-muted">{r.admin_note}</small> : null}{r.city ? <small className="adm-block adm-muted">{r.city}</small> : null}</td>
                  <td>{tab === "deleted" ? "—" : <>{r.phone}{r.phone_verified ? <span className="adm-tag ok" title="Verified with a code">✓</span> : null}</>}</td>
                  <td>{r.orders}</td>
                  <td>{rupees(r.spent)}</td>
                  <td>{when(tab === "guests" ? r.last_order : tab === "deleted" ? r.deleted_at : r.created_at)}</td>
                  {tab === "registered" && <td>{r.status === "blocked" ? <span className="adm-tag warn">On hold</span> : <span className="adm-tag ok">Active</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface Detail {
  customer: { id: number; phone: string; phone_verified: number; name: string; email: string; status: string; marketing: number; admin_note: string; last_login_at: string | null; created_at: string; has_password: number; wishlist: number; cart: number };
  addresses: { id: number; label: string; name: string; phone: string; address: string; city: string; state: string; pincode: string; is_default: number }[];
  orders: { id: number; number: string; total: number; status: string; payment_status: string; created_at: string }[];
  sessions: number;
}

export function CustomerView({ id }: { id: number }) {
  const { toast, fail, user } = useAdmin();
  const { data, error, reload } = useLoad(() => api<Detail>(`customers/${id}`), [id]);
  const [note, setNote] = useState<string | null>(null);
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;
  const c = data.customer;
  const owner = user.role === "owner";
  const spent = data.orders.filter((o) => o.status !== "cancelled" && o.status !== "returned").reduce((s, o) => s + o.total, 0);

  async function put(body: Record<string, unknown>, msg: string) {
    try { await api(`customers/${id}`, { method: "PUT", body }); toast(msg); reload(); } catch (e) { fail(e); }
  }
  async function remove() {
    if (!confirm(`Delete ${c.name || c.phone}'s account? Their name, email, addresses and login are erased. Orders stay.`)) return;
    try { await api(`customers/${id}`, { method: "DELETE" }); toast("Account deleted"); go("/customers"); } catch (e) { fail(e); }
  }

  return (
    <>
      <PageHead
        title={c.name || `+91 ${c.phone}`}
        sub={`Customer since ${when(c.created_at)} · last login ${when(c.last_login_at)}`}
        actions={<>
          <a className="adm-btn" href={`https://wa.me/91${c.phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="adm-btn" href="#/customers">← All customers</a>
        </>}
      />
      <div className="adm-kpis small">
        <div className="adm-kpi"><span>Orders</span><b>{data.orders.length}</b></div>
        <div className="adm-kpi"><span>Spent</span><b>{rupees(spent)}</b></div>
        <div className="adm-kpi"><span>Wishlist</span><b>{c.wishlist}</b></div>
        <div className="adm-kpi"><span>In cart now</span><b>{c.cart}</b></div>
      </div>
      <div className="adm-edit">
        <div className="adm-edit-main">
          <section className="adm-card">
            <div className="adm-card-head"><h2>Orders</h2></div>
            {data.orders.length === 0 ? <p className="adm-muted">No orders yet.</p> : (
              <ul className="adm-list">
                {data.orders.map((o) => {
                  const s = statusLabel(o.status);
                  return <li key={o.id}><a href={`#/orders/${o.id}`}><span><b>{o.number}</b><small>{when(o.created_at)}</small></span><span className="adm-right"><b>{rupees(o.total)}</b><span className="adm-status" style={{ background: s.color }}>{s.label}</span></span></a></li>;
                })}
              </ul>
            )}
          </section>
          <section className="adm-card">
            <h2>Saved addresses</h2>
            {data.addresses.length === 0 ? <p className="adm-muted">None saved.</p> : (
              <div className="adm-addr-grid">
                {data.addresses.map((a) => <div key={a.id} className="adm-addr"><b>{a.label}{a.is_default ? " · default" : ""}</b><span>{a.name}, {a.phone}</span><span className="adm-muted">{a.address}, {a.city}, {a.state} {a.pincode}</span></div>)}
              </div>
            )}
          </section>
        </div>
        <div className="adm-edit-side">
          <section className="adm-card">
            <h2>Details</h2>
            <dl className="adm-dl">
              <dt>Mobile</dt><dd>+91 {c.phone} {c.phone_verified ? <span className="adm-tag ok">verified</span> : <span className="adm-tag warn">not verified</span>}</dd>
              <dt>Email</dt><dd>{c.email || "—"}</dd>
              <dt>Login</dt><dd>{c.has_password ? "Password" : "Code only"} · {data.sessions} device{data.sessions === 1 ? "" : "s"} logged in</dd>
              <dt>Offers on WhatsApp</dt><dd>{c.marketing ? "Yes, agreed" : "No"}</dd>
              <dt>Status</dt><dd>{c.status === "blocked" ? <span className="adm-tag warn">On hold</span> : <span className="adm-tag ok">Active</span>}</dd>
            </dl>
          </section>
          <section className="adm-card">
            <h2>Private note</h2>
            <textarea rows={3} maxLength={500} placeholder="Only the team sees this, e.g. prefers Urdu cards" value={note ?? c.admin_note} onChange={(e) => setNote(e.target.value)} />
            <div className="adm-row end"><button className="adm-btn small primary" disabled={note === null} onClick={() => put({ admin_note: note }, "Note saved")}>Save note</button></div>
          </section>
          {owner && (
            <section className="adm-card danger-zone">
              <h2>Account actions</h2>
              <div className="adm-row wrap">
                {data.sessions > 0 && <button className="adm-btn small" onClick={() => put({ logout: true }, "Logged out on all devices")}>Log out everywhere</button>}
                {c.status === "blocked"
                  ? <button className="adm-btn small" onClick={() => put({ status: "active" }, "Account active again")}>Remove hold</button>
                  : <button className="adm-btn small" onClick={() => { if (confirm("Put this account on hold? They can't log in until you remove the hold.")) put({ status: "blocked" }, "Account on hold"); }}>Put on hold</button>}
                <button className="adm-btn small" onClick={() => { const pw = prompt("Temporary password for this customer (at least 8 characters). Send it to them on WhatsApp and ask them to change it in My account."); if (pw) put({ temp_password: pw }, "Temporary password set. Send it to the customer privately."); }}>Set temporary password</button>
                <button className="adm-btn small danger" onClick={remove}>Delete account</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

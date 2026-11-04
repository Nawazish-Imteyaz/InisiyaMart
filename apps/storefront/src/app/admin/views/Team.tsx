"use client";

import { useState } from "react";
import { api, when } from "../lib";
import { useAdmin } from "../AdminApp";
import { ErrorBox, Field, Loading, PageHead, useLoad } from "./ui";

interface Member { id: number; email: string; name: string; role: "owner" | "staff"; active: number; last_login_at: string | null }

export function Team() {
  const { toast, fail, user } = useAdmin();
  const { data, error, reload } = useLoad(() => api<{ users: Member[] }>("users"));
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: "", email: "", role: "staff", password: "" });
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("users", { body: f });
      toast(`${f.name} added. Share the email and password with them privately.`);
      setF({ name: "", email: "", role: "staff", password: "" });
      setAdding(false);
      reload();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  async function update(m: Member, body: Record<string, unknown>, msg: string) {
    try { await api(`users/${m.id}`, { method: "PUT", body }); toast(msg); reload(); } catch (e) { fail(e); }
  }

  async function resetPassword(m: Member) {
    const pw = window.prompt(`New password for ${m.name} (at least 8 characters):`);
    if (!pw) return;
    await update(m, { password: pw }, `Password changed for ${m.name}. They need to log in again.`);
  }

  async function remove(m: Member) {
    if (!window.confirm(`Remove ${m.name} (${m.email}) from the admin console?`)) return;
    try { await api(`users/${m.id}`, { method: "DELETE" }); toast("Removed"); reload(); } catch (e) { fail(e); }
  }

  return (
    <>
      <PageHead
        title="Team"
        sub="People who can log in to this admin console. Owners can do everything; staff manage products, categories and orders."
        actions={!adding && <button className="adm-btn primary" onClick={() => setAdding(true)}>+ Add person</button>}
      />
      {adding && (
        <form className="adm-card" onSubmit={add}>
          <h2>Add a team member</h2>
          <div className="adm-grid">
            <Field label="Name *"><input required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Email *"><input type="email" required maxLength={120} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Role">
              <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                <option value="staff">Staff: products, categories, orders</option>
                <option value="owner">Owner: everything, incl. team and settings</option>
              </select>
            </Field>
            <Field label="Password *" hint="At least 8 characters. They can change it later in My account.">
              <input type="text" required minLength={8} maxLength={200} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </Field>
          </div>
          <div className="adm-row end">
            <button type="button" className="adm-btn" onClick={() => setAdding(false)}>Cancel</button>
            <button className="adm-btn primary" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
          </div>
        </form>
      )}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Person</th><th>Role</th><th>Last login</th><th>Access</th><th /></tr></thead>
          <tbody>
            {data.users.map((m) => (
              <tr key={m.id}>
                <td><b>{m.name}</b>{m.id === user.id && <span className="adm-tag">You</span>}<small className="adm-block adm-muted">{m.email}</small></td>
                <td>
                  <select value={m.role} disabled={m.id === user.id} aria-label={`Role of ${m.name}`} onChange={(e) => update(m, { role: e.target.value }, `${m.name} is now ${e.target.value}`)}>
                    <option value="staff">Staff</option><option value="owner">Owner</option>
                  </select>
                </td>
                <td>{when(m.last_login_at)}</td>
                <td>
                  <label className="adm-switch">
                    <input type="checkbox" checked={!!m.active} disabled={m.id === user.id} onChange={(e) => update(m, { active: e.target.checked }, e.target.checked ? `${m.name} can log in` : `${m.name} is blocked`)} />
                    <span>{m.active ? "Can log in" : "Blocked"}</span>
                  </label>
                </td>
                <td className="adm-right">
                  <div className="adm-row end">
                    <button className="adm-btn small" onClick={() => resetPassword(m)}>Set password</button>
                    {m.id !== user.id && <button className="adm-btn small danger" onClick={() => remove(m)}>Remove</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { api, when } from "../lib";
import { useAdmin } from "../AdminApp";
import { Empty, ErrorBox, Field, Loading, PageHead, useLoad } from "./ui";
import { Icon } from "./icons";

interface FieldDef { key: string; label: string; secret?: boolean; hint?: string; placeholder?: string; optional?: boolean }
interface Provider {
  id: string; group: "payments" | "shipping" | "messaging"; name: string; blurb: string; signup: string; uses: string; readiness: "ready" | "keys";
  fields: FieldDef[]; webhook?: { path: string; events: string; how: string }; webhookUrl: string | null; testable: boolean;
  enabled: boolean; mode: "test" | "live"; broken: boolean;
  values: Record<string, { set?: boolean; hint?: string; value?: string }>;
  lastTest: { at: string; ok: boolean; message: string } | null; lastWebhookAt: string | null; updatedBy: string; updatedAt: string | null;
}
interface LogRow { id: number; direction: "in" | "out"; source: string; event: string; ok: number; status: number | null; detail: string; created_at: string }

const GROUP_TEXT = {
  payments: { title: "Payments", sub: "Payment gateways. Add the keys you get from the partner here: they are encrypted on the server and never shown again." },
  shipping: { title: "Shipping & couriers", sub: "Courier accounts. Tracking updates from the courier can move orders to Shipped / Delivered automatically." },
  messaging: { title: "WhatsApp & SMS", sub: "Send customers a 6-digit login code (OTP) and order messages. Switching one on turns on “Log in with a code” on the website." },
} as const;

export function CopyText({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="adm-copy">
      <code>{text}</code>
      <button type="button" className="adm-btn small" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); window.setTimeout(() => setDone(false), 1800); } catch { /* ignore */ } }}>
        <Icon name={done ? "check" : "copy"} size={16} /> {done ? "Copied" : label ?? "Copy"}
      </button>
    </span>
  );
}

export function Integrations({ group }: { group: "payments" | "shipping" | "messaging" }) {
  const { data, error, reload } = useLoad(() => Promise.all([
    api<{ keyReady: boolean; providers: Provider[] }>("integrations"),
    api<{ log: LogRow[] }>("integrations/log"),
    group === "payments" ? api<{ settings: Record<string, string> }>("settings") : Promise.resolve({ settings: {} as Record<string, string> }),
  ]), [group]);
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;
  const [{ keyReady, providers }, { log }, { settings }] = data;
  const list = providers.filter((p) => p.group === group);
  const ids = new Set(list.map((p) => p.id));
  const myLog = log.filter((l) => l.direction === "in" && ids.has(l.source));
  const t = GROUP_TEXT[group];

  return (
    <>
      <PageHead title={t.title} sub={t.sub} actions={<span className="adm-count">{list.filter((p) => p.enabled).length} of {list.length} on</span>} />
      <div className="adm-vault">
        <Icon name="lock" size={22} />
        <div>
          <b>How your keys are kept safe</b>
          <span>Saved keys are encrypted with AES-256 on the server. This page only ever shows the last 4 characters. Changing a key or switching a partner on asks for your admin password, and every change is written to the Activity log.</span>
        </div>
      </div>
      {!keyReady && <div className="adm-error">The server encryption key is not set up yet, so keys can&apos;t be saved. (Developer: set the SECRETS_KEY secret in Cloudflare Pages.)</div>}

      {group === "payments" && (
        <section className="adm-card">
          <div className="adm-card-head"><h2>Payment methods at checkout</h2><a href="#/settings">Change in Store settings →</a></div>
          <div className="adm-table-wrap flat">
            <table className="adm-table">
              <thead><tr><th>Method</th><th>On</th><th>How it works</th></tr></thead>
              <tbody>
                <tr><td><b>UPI (your own UPI ID)</b></td><td>{settings.upi_id ? <span className="adm-tag ok">On</span> : <span className="adm-tag warn">Add UPI ID</span>}</td><td className="adm-muted">Customer pays to {settings.upi_id || "your UPI ID"} and sends the 12-digit UTR. You check your bank app and mark Paid. No fees.</td></tr>
                <tr><td><b>Cash on delivery</b></td><td>{settings.cod_enabled === "1" ? <span className="adm-tag ok">On</span> : <span className="adm-tag">Off</span>}</td><td className="adm-muted">Customer pays the courier. {settings.cod_fee ? `Extra fee ₹${settings.cod_fee}.` : "No extra fee set."}</td></tr>
                {list.map((p) => (
                  <tr key={p.id}><td><b>{p.name}</b></td><td>{p.enabled ? <span className="adm-tag ok">On</span> : <span className="adm-tag">Off</span>}</td><td className="adm-muted">{p.readiness === "ready" ? p.uses : "Keys can be stored now; online checkout comes in a later update."}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="adm-providers">
        {list.map((p) => <ProviderCard key={p.id} p={p} onSaved={reload} canSave={keyReady} />)}
      </div>

      <section className="adm-card">
        <div className="adm-card-head"><h2>Webhooks received</h2><span className="adm-muted">Last 60 days</span></div>
        {myLog.length === 0 ? <p className="adm-muted">Nothing received yet. When a partner sends an update, it appears here, including rejected ones.</p> : <LogTable rows={myLog} />}
      </section>
    </>
  );
}

function LogTable({ rows }: { rows: LogRow[] }) {
  return (
    <div className="adm-table-wrap flat">
      <table className="adm-table compact">
        <thead><tr><th>When</th><th>From / to</th><th>Event</th><th>Result</th><th>Details</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td className="adm-nowrap">{when(l.created_at)}</td><td>{l.source}</td><td>{l.event || "—"}</td>
              <td>{l.ok ? <span className="adm-tag ok">OK{l.status ? ` ${l.status}` : ""}</span> : <span className="adm-tag warn">Failed{l.status ? ` ${l.status}` : ""}</span>}</td>
              <td className="adm-muted">{l.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProviderCard({ p, onSaved, canSave }: { p: Provider; onSaved: () => void; canSave: boolean }) {
  const { toast, fail } = useAdmin();
  const [config, setConfig] = useState<Record<string, string>>(Object.fromEntries(p.fields.filter((f) => !f.secret).map((f) => [f.key, p.values[f.key]?.value ?? ""])));
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [replace, setReplace] = useState<Record<string, boolean>>({});
  const [clear, setClear] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(p.enabled);
  const [mode, setMode] = useState(p.mode);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [open, setOpen] = useState(p.enabled || !!p.updatedAt);

  const secretChanged = Object.values(secrets).some((v) => v.trim()) || clear.length > 0;
  const needPassword = secretChanged || (enabled && !p.enabled);
  const dirty = secretChanged || enabled !== p.enabled || mode !== p.mode || p.fields.some((f) => !f.secret && (config[f.key] ?? "") !== (p.values[f.key]?.value ?? ""));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`integrations/${p.id}`, { method: "PUT", body: { enabled, mode, config, secrets, clear, password: needPassword ? password : undefined } });
      toast(`${p.name} saved${enabled ? " and switched ON" : ""}`);
      setSecrets({}); setReplace({}); setClear([]); setPassword("");
      onSaved();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function test() {
    setTesting(true);
    try { const r = await api<{ ok: boolean; message: string }>(`integrations/${p.id}/test`, { method: "POST" }); toast(r.message, r.ok ? "ok" : "err"); onSaved(); } catch (err) { fail(err); } finally { setTesting(false); }
  }

  return (
    <form className={`adm-card adm-provider${p.enabled ? " on" : ""}`} onSubmit={save}>
      <div className="adm-provider-head">
        <span className={`adm-provider-ic g-${p.group}`}><Icon name={p.group === "payments" ? "card" : p.group === "shipping" ? "truck" : "chat"} /></span>
        <div className="adm-provider-title">
          <h2>{p.name}</h2>
          <span className="adm-muted">{p.blurb}</span>
        </div>
        <div className="adm-provider-state">
          {p.enabled ? <span className="adm-tag ok">On · {p.mode === "live" ? "Live" : "Test"}</span> : <span className="adm-tag">Off</span>}
          {p.readiness === "keys" && <span className="adm-tag info">Keys only for now</span>}
        </div>
        <button type="button" className="adm-btn small ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Close" : p.updatedAt ? "Manage" : "Set up"}</button>
      </div>
      {open && (
        <div className="adm-provider-body">
          <p className="adm-provider-uses">{p.uses} <a href={p.signup} target="_blank" rel="noopener noreferrer">Create an account ↗</a></p>
          {p.broken && <div className="adm-error">The saved keys could not be read (the server key changed). Please type them again.</div>}
          <div className="adm-grid">
            {p.fields.map((f) => {
              const v = p.values[f.key] ?? {};
              if (!f.secret) {
                return <Field key={f.key} label={`${f.label}${f.optional ? "" : " *"}`} hint={f.hint}><input value={config[f.key] ?? ""} placeholder={f.placeholder} maxLength={300} autoComplete="off" onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} /></Field>;
              }
              const editing = !v.set || replace[f.key];
              return (
                <Field key={f.key} label={`${f.label}${f.optional ? "" : " *"} 🔒`} hint={f.hint}>
                  {editing ? (
                    <input type="password" autoComplete="new-password" spellCheck={false} placeholder={v.set ? "Type the new value" : f.placeholder ?? "Paste from the partner dashboard"} value={secrets[f.key] ?? ""} onChange={(e) => setSecrets({ ...secrets, [f.key]: e.target.value })} />
                  ) : (
                    <span className="adm-secret">
                      <span className={clear.includes(f.key) ? "adm-strike" : ""}>Saved {v.hint}</span>
                      <button type="button" className="adm-btn small" onClick={() => setReplace({ ...replace, [f.key]: true })}>Replace</button>
                      <button type="button" className="adm-btn small ghost" onClick={() => setClear(clear.includes(f.key) ? clear.filter((k) => k !== f.key) : [...clear, f.key])}>{clear.includes(f.key) ? "Keep" : "Remove"}</button>
                    </span>
                  )}
                </Field>
              );
            })}
          </div>

          {p.webhook && p.webhookUrl && (
            <div className="adm-hookbox">
              <b>Webhook for {p.name}</b>
              <span className="adm-muted">{p.webhook.how}. Paste this URL and choose: {p.webhook.events}.</span>
              <CopyText text={p.webhookUrl} label="Copy URL" />
              <small className="adm-muted">Last received: {p.lastWebhookAt ? when(p.lastWebhookAt) : "never"}</small>
            </div>
          )}

          <div className="adm-provider-controls">
            <label className="adm-toggle"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /><span className="adm-toggle-ui" aria-hidden="true" /><span>{enabled ? "Switched on" : "Switched off"}</span></label>
            {p.group === "payments" && (
              <label className="adm-inline">Mode
                <select value={mode} onChange={(e) => setMode(e.target.value as "test" | "live")}><option value="test">Test (no real money)</option><option value="live">Live</option></select>
              </label>
            )}
            {p.testable && p.updatedAt && <button type="button" className="adm-btn small" onClick={test} disabled={testing}>{testing ? "Testing…" : "Test connection"}</button>}
            {p.lastTest && <span className={`adm-test ${p.lastTest.ok ? "ok" : "bad"}`}>{p.lastTest.ok ? "✓" : "✕"} {p.lastTest.message} <small>({when(p.lastTest.at)})</small></span>}
          </div>

          {dirty && (
            <div className="adm-confirm">
              {needPassword && <Field label="Your admin password" hint="Needed to change keys or switch a partner on."><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
              <div className="adm-row end">
                <button type="button" className="adm-btn" onClick={() => { setSecrets({}); setReplace({}); setClear([]); setEnabled(p.enabled); setMode(p.mode); setPassword(""); }}>Undo</button>
                <button className="adm-btn primary" disabled={busy || !canSave}>{busy ? "Saving…" : "Save securely"}</button>
              </div>
            </div>
          )}
          {p.updatedAt && <small className="adm-muted">Last changed {when(p.updatedAt)}{p.updatedBy ? ` by ${p.updatedBy}` : ""}</small>}
        </div>
      )}
    </form>
  );
}

// ============================ Outgoing webhooks ============================
interface Hook { id: number; name: string; url: string; events: string; active: number; last_status: number | null; last_at: string | null; created_at: string }

export function Webhooks() {
  const { toast, fail } = useAdmin();
  const { data, error, reload } = useLoad(() => Promise.all([api<{ webhooks: Hook[]; events: { id: string; label: string }[] }>("webhooks"), api<{ log: LogRow[] }>("integrations/log")]));
  const [f, setF] = useState<{ id?: number; name: string; url: string; events: string[]; password: string } | null>(null);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;
  const [{ webhooks, events }, { log }] = data;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    setBusy(true);
    try {
      const r = await api<{ secret?: string }>(f.id ? `webhooks/${f.id}` : "webhooks", { method: f.id ? "PUT" : "POST", body: f });
      if (r.secret) setSecret(r.secret);
      toast(f.id ? "Webhook saved" : "Webhook added");
      setF(null);
      reload();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function act(h: Hook, what: "toggle" | "test" | "delete") {
    try {
      if (what === "toggle") await api(`webhooks/${h.id}`, { method: "PUT", body: { active: !h.active } });
      if (what === "test") { const r = await api<{ ok: boolean; status: number }>(`webhooks/${h.id}/test`, { method: "POST" }); toast(r.ok ? `Test delivered (HTTP ${r.status})` : `Test failed (HTTP ${r.status || "no answer"})`, r.ok ? "ok" : "err"); }
      if (what === "delete") { if (!confirm(`Delete webhook “${h.name}”?`)) return; await api(`webhooks/${h.id}`, { method: "DELETE" }); toast("Deleted"); }
      reload();
    } catch (err) { fail(err); }
  }

  return (
    <>
      <PageHead
        title="Webhooks"
        sub="Send order and enquiry events to another app (Google Sheets via Make/Zapier, your accountant's tool, a WhatsApp bot…). Every call is signed so the other app can check it really came from Insi House."
        actions={<><span className="adm-count">{webhooks.length} hooks</span>{!f && <button className="adm-btn primary" onClick={() => setF({ name: "", url: "https://", events: ["order.created"], password: "" })}>+ Add hook</button>}</>}
      />
      {secret && (
        <div className="adm-card adm-secret-once">
          <h2>Copy the signing secret now</h2>
          <p className="adm-muted">It is shown only once. Paste it in the other app to check the <code>X-InsiHouse-Signature</code> header (HMAC-SHA256 of <code>timestamp.body</code>).</p>
          <CopyText text={secret} />
          <div className="adm-row end"><button className="adm-btn" onClick={() => setSecret("")}>I saved it</button></div>
        </div>
      )}
      {f && (
        <form className="adm-card" onSubmit={save}>
          <h2>{f.id ? `Edit ${f.name}` : "New webhook"}</h2>
          <div className="adm-grid">
            <Field label="Name *"><input required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Orders to Google Sheet" /></Field>
            <Field label="URL *" hint="Must start with https://"><input required type="url" maxLength={500} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
            <fieldset className="adm-fieldset wide">
              <legend>Send these events</legend>
              <div className="adm-chips">
                {events.map((ev) => (
                  <label key={ev.id} className={`adm-chip${f.events.includes(ev.id) ? " on" : ""}`}>
                    <input type="checkbox" checked={f.events.includes(ev.id)} onChange={(e) => setF({ ...f, events: e.target.checked ? [...f.events, ev.id] : f.events.filter((x) => x !== ev.id) })} />{ev.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Your admin password" hint="Needed to add a webhook or change its URL."><input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          </div>
          <div className="adm-row end">
            <button type="button" className="adm-btn" onClick={() => setF(null)}>Cancel</button>
            <button className="adm-btn primary" disabled={busy}>{busy ? "Saving…" : "Save webhook"}</button>
          </div>
        </form>
      )}
      {webhooks.length === 0 ? <Empty>No webhooks yet. You don&apos;t need any to run the shop: they are for connecting other apps.</Empty> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Events</th><th>URL</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {webhooks.map((h) => (
                <tr key={h.id}>
                  <td><b>{h.name}</b></td>
                  <td className="adm-muted">{h.events.split(",").map((e) => events.find((x) => x.id === e)?.label ?? e).join(", ")}</td>
                  <td className="adm-url">{h.url}</td>
                  <td>{h.active ? <span className="adm-tag ok">On</span> : <span className="adm-tag">Off</span>}{h.last_at && <small className="adm-block adm-muted">Last: HTTP {h.last_status || "—"} · {when(h.last_at)}</small>}</td>
                  <td><div className="adm-row wrap">
                    <button className="adm-btn small" onClick={() => act(h, "test")}>Send test</button>
                    <button className="adm-btn small" onClick={() => setF({ id: h.id, name: h.name, url: h.url, events: h.events.split(","), password: "" })}>Edit</button>
                    <button className="adm-btn small" onClick={() => act(h, "toggle")}>{h.active ? "Turn off" : "Turn on"}</button>
                    <button className="adm-btn small danger" onClick={() => act(h, "delete")}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="adm-card">
        <div className="adm-card-head"><h2>Delivery log</h2></div>
        {log.filter((l) => l.direction === "out").length === 0 ? <p className="adm-muted">Nothing sent yet.</p> : <LogTable rows={log.filter((l) => l.direction === "out")} />}
      </section>
    </>
  );
}

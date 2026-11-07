"use client";

import { useState } from "react";
import qrcode from "qrcode-generator";
import { api, when } from "../lib";
import { useAdmin } from "../AdminApp";
import { ErrorBox, Field, Loading, PageHead, useLoad } from "./ui";
import { Icon } from "./icons";
import { CopyText } from "./Integrations";

interface Sess { id: string; ip: string; ua: string; created_at: string; expires_at: string; current: boolean }
interface LoginRow { ip: string; ok: number; created_at: string }

function device(ua: string): string {
  if (!ua) return "Unknown device";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone / iPad" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "browser";
  return `${br} on ${os}`;
}

function Qr({ text }: { text: string }) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const cells: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) cells.push(`M${c + 4},${r + 4}h1v1h-1z`);
  return (
    <svg className="adm-qr" viewBox={`0 0 ${n + 8} ${n + 8}`} role="img" aria-label="QR code for your authenticator app" shapeRendering="crispEdges">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={cells.join("")} fill="#2b1b22" />
    </svg>
  );
}

export function Security() {
  const { user, toast, fail } = useAdmin();
  const { data, error, reload } = useLoad(() => Promise.all([api<{ sessions: Sess[] }>("me/sessions"), api<{ logins: LoginRow[] }>("me/logins"), api<{ user: { totp: boolean } }>("me")]));
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [off, setOff] = useState({ password: "", code: "" });
  const [showOff, setShowOff] = useState(false);

  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;
  const [{ sessions }, { logins }, { user: me }] = data;
  const on = me.totp;

  async function start() {
    try { setSetup(await api<{ secret: string; uri: string }>("me/2fa/setup", { method: "POST" })); } catch (e) { fail(e); }
  }
  async function enable(e: React.FormEvent) {
    e.preventDefault();
    try { await api("me/2fa/enable", { body: { code, password: pw } }); toast("Two-step login is ON. Other devices were logged out."); setSetup(null); setCode(""); setPw(""); reload(); } catch (err) { fail(err); }
  }
  async function disable(e: React.FormEvent) {
    e.preventDefault();
    try { await api("me/2fa/disable", { body: off }); toast("Two-step login is off"); setOff({ password: "", code: "" }); setShowOff(false); reload(); } catch (err) { fail(err); }
  }
  async function logoutOthers() {
    if (!confirm("Log out every other phone and computer?")) return;
    try { await api("me/sessions", { method: "DELETE" }); toast("Other devices logged out"); reload(); } catch (e) { fail(e); }
  }

  const fails24 = logins.filter((l) => !l.ok && Date.now() - Date.parse(`${l.created_at.replace(" ", "T")}Z`) < 86400_000).length;

  return (
    <>
      <PageHead title="Security" sub={`Keep the ${user.role === "owner" ? "shop" : "admin console"} safe. These settings are for your own login (${user.email}).`} />
      <div className="adm-sec-score">
        <div className={`adm-sec-item ${on ? "ok" : "warn"}`}><Icon name="shield" /><span><b>Two-step login</b>{on ? "On: a code from your phone is needed" : "Off: turn it on below"}</span></div>
        <div className="adm-sec-item ok"><Icon name="lock" /><span><b>Login protection</b>8 wrong tries locks for 15 minutes</span></div>
        <div className={`adm-sec-item ${fails24 ? "warn" : "ok"}`}><Icon name="key" /><span><b>Wrong passwords (24 h)</b>{fails24 ? `${fails24} failed tries: check below` : "None"}</span></div>
        <div className="adm-sec-item ok"><Icon name="check" /><span><b>Secure connection</b>HTTPS only, secure cookies</span></div>
      </div>

      <section className="adm-card">
        <h2>Two-step login (authenticator app)</h2>
        {on ? (
          <>
            <p className="adm-muted">When you log in, you type your password and then a 6-digit code from Google Authenticator or Microsoft Authenticator on your phone. Even if someone learns your password, they can&apos;t get in without your phone.</p>
            {!showOff ? <button className="adm-btn" onClick={() => setShowOff(true)}>Turn off two-step login</button> : (
              <form onSubmit={disable} className="adm-grid">
                <Field label="Your password"><input type="password" required autoComplete="current-password" value={off.password} onChange={(e) => setOff({ ...off, password: e.target.value })} /></Field>
                <Field label="Code from the app"><input inputMode="numeric" maxLength={6} required value={off.code} onChange={(e) => setOff({ ...off, code: e.target.value.replace(/\D/g, "") })} /></Field>
                <div className="adm-row end wide"><button type="button" className="adm-btn" onClick={() => setShowOff(false)}>Cancel</button><button className="adm-btn danger">Turn off</button></div>
              </form>
            )}
          </>
        ) : !setup ? (
          <>
            <p className="adm-muted">Strongly recommended for the owner. You need the free <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> app on your phone. It takes 1 minute.</p>
            <button className="adm-btn primary" onClick={start}>Turn on two-step login</button>
          </>
        ) : (
          <form className="adm-2fa" onSubmit={enable}>
            <ol className="adm-steps">
              <li>Open the authenticator app and tap <b>+</b> → <b>Scan a QR code</b>.</li>
              <li>Scan this code. (Can&apos;t scan? Choose “Enter a setup key” and type the key below.)</li>
              <li>Type the 6-digit code the app shows.</li>
            </ol>
            <div className="adm-2fa-row">
              <Qr text={setup.uri} />
              <div className="adm-2fa-side">
                <span className="adm-muted">Setup key</span>
                <CopyText text={setup.secret.replace(/(.{4})/g, "$1 ").trim()} />
                <Field label="6-digit code"><input className="adm-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
                <Field label="Your password"><input type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
                <div className="adm-row"><button className="adm-btn primary">Turn on</button><button type="button" className="adm-btn" onClick={() => setSetup(null)}>Cancel</button></div>
              </div>
            </div>
          </form>
        )}
      </section>

      <section className="adm-card">
        <div className="adm-card-head"><h2>Devices logged in</h2>{sessions.length > 1 && <button className="adm-btn small" onClick={logoutOthers}>Log out all other devices</button>}</div>
        <ul className="adm-list">
          {sessions.map((s) => (
            <li key={s.id}><div className="adm-list-row"><span><b>{device(s.ua)}</b>{s.current && <span className="adm-tag ok">This device</span>}<small>Logged in {when(s.created_at)} · IP {s.ip || "—"} · ends {when(s.expires_at)}</small></span></div></li>
          ))}
        </ul>
      </section>

      <section className="adm-card">
        <div className="adm-card-head"><h2>Recent logins</h2><span className="adm-muted">Last 30</span></div>
        {logins.length === 0 ? <p className="adm-muted">None yet.</p> : (
          <div className="adm-table-wrap flat">
            <table className="adm-table compact">
              <thead><tr><th>When</th><th>Result</th><th>IP address</th></tr></thead>
              <tbody>{logins.map((l, i) => <tr key={i}><td>{when(l.created_at)}</td><td>{l.ok ? <span className="adm-tag ok">Logged in</span> : <span className="adm-tag warn">Wrong password or code</span>}</td><td>{l.ip || "—"}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <p className="adm-muted" style={{ marginBlockEnd: 0 }}>See a login you don&apos;t recognise? Change your password in <a href="#/settings">Settings</a> (this logs out every other device) and turn on two-step login.</p>
      </section>
    </>
  );
}

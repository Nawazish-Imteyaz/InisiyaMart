"use client";

// Log in / sign up with a mobile number: a 6-digit code on WhatsApp or SMS (when connected), or a password.
import Link from "next/link";
import { useState } from "react";
import { accountApi, setMe, useAccount, type Me } from "@/lib/account";
import { whatsappLink } from "@/lib/site";

type Mode = "code" | "password" | "register";

export function LoginBox({ compact, onDone }: { compact?: boolean; onDone?: (me: Me) => void }) {
  const { otp, ready } = useAccount();
  const [mode, setMode] = useState<Mode | null>(null);
  const m: Mode = mode ?? (otp ? "code" : "password");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<{ via: string; minutes: number } | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  const ten = phone.replace(/\D/g, "").slice(-10);
  const phoneOk = /^[6-9][0-9]{9}$/.test(ten);

  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(false); }
  }
  const finish = (me: Me) => { setMe(me); onDone?.(me); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneOk) { setError("Please enter a valid 10-digit mobile number."); return; }
    if (m === "code" && !sent) return run(async () => { setSent(await accountApi<{ via: string; minutes: number }>("otp/send", { body: { phone: ten } })); });
    if (m === "code") return run(async () => finish((await accountApi<{ customer: Me }>("otp/verify", { body: { phone: ten, code, name } })).customer));
    if (m === "password") return run(async () => finish((await accountApi<{ customer: Me }>("login", { body: { phone: ten, password } })).customer));
    if (!consent) { setError("Please accept the privacy policy to create your account."); return; }
    return run(async () => finish((await accountApi<{ customer: Me }>("register", { body: { phone: ten, name, password, consent: true } })).customer));
  }

  if (!ready) return <div className="cart-empty"><span className="spinner" aria-label="Loading" /></div>;

  return (
    <form className={`login-box${compact ? " compact" : ""}`} onSubmit={submit} noValidate>
      {!compact && <h2>{m === "register" ? "Create your account" : "Log in or sign up"}</h2>}
      {otp && m !== "register" && (
        <div className="seg" role="tablist" aria-label="How to log in">
          <button type="button" role="tab" aria-selected={m === "code"} onClick={() => { setMode("code"); setError(""); }}>Get a code</button>
          <button type="button" role="tab" aria-selected={m === "password"} onClick={() => { setMode("password"); setError(""); }}>Password</button>
        </div>
      )}

      <label className="form-field">Mobile number
        <span className="phone-field">
          <span className="cc">+91</span>
          <input type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} placeholder="10-digit mobile number" value={phone}
            onChange={(e) => { setPhone(e.target.value); setSent(null); }} disabled={busy || (m === "code" && !!sent)} autoFocus={!compact} />
        </span>
      </label>

      {m === "register" && <label className="form-field">Your name<input autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} required /></label>}

      {(m === "password" || m === "register") && (
        <label className="form-field">{m === "register" ? "Choose a password" : "Password"}
          <span className="pw-field">
            <input type={show ? "text" : "password"} autoComplete={m === "register" ? "new-password" : "current-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="link-btn" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</button>
          </span>
          {m === "register" && <small>At least 8 characters. Use letters and numbers.</small>}
        </label>
      )}

      {m === "code" && sent && (
        <>
          <p className="ok-note" role="status">Code sent on {sent.via === "whatsapp" ? "WhatsApp" : "SMS"} to +91 {ten}. It works for {sent.minutes} minutes.</p>
          <label className="form-field">6-digit code<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus /></label>
          <label className="form-field">Your name <small>(only if you&apos;re new)</small><input autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => { setSent(null); setCode(""); }}>Change number or send again</button>
        </>
      )}

      {m === "register" && (
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I agree to the <Link href="/policies/privacy/" target="_blank">privacy policy</Link> and <Link href="/policies/terms/" target="_blank">terms</Link>.</span>
        </label>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-glow" disabled={busy}>
        {busy ? "Please wait…" : m === "code" ? (sent ? "Verify & continue" : "Send code") : m === "password" ? "Log in" : "Create account"}
      </button>

      <div className="login-foot">
        {m === "register" ? (
          <span>Already have an account? <button type="button" className="link-btn" onClick={() => { setMode(otp ? "code" : "password"); setError(""); }}>Log in</button></span>
        ) : (
          <span>New to Insi House? <button type="button" className="link-btn" onClick={() => { setMode(otp ? "code" : "register"); setError(""); }}>{otp ? "Just get a code" : "Create an account"}</button></span>
        )}
        {m === "password" && (otp
          ? <button type="button" className="link-btn" onClick={() => setMode("code")}>Forgot password? Log in with a code</button>
          : <a href={whatsappLink(`Hello Insi House! I forgot my account password. My mobile number is ${ten || "__________"}.`)} target="_blank" rel="noopener noreferrer">Forgot password?</a>)}
      </div>
    </form>
  );
}

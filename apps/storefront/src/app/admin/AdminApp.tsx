"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, type AdminUser } from "./lib";
import { Dashboard } from "./views/Dashboard";
import { ProductList, ProductEdit } from "./views/Products";
import { Categories } from "./views/Categories";
import { OrderList, OrderView, OrderNew } from "./views/Orders";
import { Team } from "./views/Team";
import { SettingsView } from "./views/Settings";
import { Activity } from "./views/Activity";

// ---------------- Toasts & current user (shared with all views) ----------------
type Toast = { id: number; text: string; kind: "ok" | "err" };
interface AdminCtx {
  user: AdminUser;
  toast: (text: string, kind?: "ok" | "err") => void;
  fail: (e: unknown) => void;
  refreshPublish: () => void;
}
const Ctx = createContext<AdminCtx | null>(null);
export function useAdmin(): AdminCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin outside AdminApp");
  return c;
}

/** Current hash route, e.g. "#/products/12" → "/products/12". */
function useRoute(): string {
  const [route, setRoute] = useState("/");
  useEffect(() => {
    const read = () => setRoute(window.location.hash.replace(/^#/, "") || "/");
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return route;
}

export function go(path: string) {
  window.location.hash = path;
}

// ---------------- App ----------------
export function AdminApp() {
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 6000 : 3200);
  }, []);
  const fail = useCallback((e: unknown) => toast(e instanceof Error ? e.message : "Something went wrong", "err"), [toast]);

  useEffect(() => {
    api<{ user: AdminUser }>("me")
      .then((r) => setUser(r.user))
      .catch((e) => {
        setUser(null);
        if (!(e instanceof ApiError) || e.status !== 401) {
          toast(e.status === 404 ? "The admin server is not reachable here. Open the admin on insihouse.pages.dev." : e.message, "err");
        }
      });
    const ended = () => setUser(null);
    window.addEventListener("ih-session-ended", ended);
    return () => window.removeEventListener("ih-session-ended", ended);
  }, [toast]);

  return (
    <div className="adm">
      {user === undefined ? (
        <div className="adm-center"><span className="adm-spinner" aria-label="Loading" /></div>
      ) : user === null ? (
        <Login onDone={setUser} fail={fail} />
      ) : (
        <Shell user={user} onLogout={() => setUser(null)} toast={toast} fail={fail} />
      )}
      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`adm-toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Login ----------------
function Login({ onDone, fail }: { onDone: (u: AdminUser) => void; fail: (e: unknown) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ user: AdminUser }>("login", { body: { email, password } });
      onDone(r.user);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-login">
      <form className="adm-card adm-login-card" onSubmit={submit}>
        <div className="adm-brand">
          <span className="adm-brand-word">INSI HOUSE</span>
          <span className="urdu" lang="ur" dir="rtl">انسی ہاؤس</span>
        </div>
        <h1>Admin console</h1>
        <p className="adm-muted">Log in to manage products, orders and your website.</p>
        <label className="adm-field">
          <span>Email</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="adm-field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="adm-btn primary block" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
        <a className="adm-link" href="/">← Back to website</a>
      </form>
    </div>
  );
}

// ---------------- Shell ----------------
interface PublishState { hook: boolean; pending: boolean; lastPublish: string | null; nextAllowedAt: string | null }

function Shell({ user, onLogout, toast, fail }: { user: AdminUser; onLogout: () => void; toast: AdminCtx["toast"]; fail: AdminCtx["fail"] }) {
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pub, setPub] = useState<PublishState | null>(null);
  const autoTried = useRef(0);

  const refreshPublish = useCallback(() => {
    api<PublishState>("publish").then(setPub).catch(() => {});
  }, []);

  // Keep the website in sync: if changes are waiting and the 3-minute gap has passed, refresh automatically.
  useEffect(() => {
    refreshPublish();
    const t = window.setInterval(refreshPublish, 30_000);
    return () => window.clearInterval(t);
  }, [refreshPublish]);
  useEffect(() => {
    if (!pub?.hook || !pub.pending) return;
    const due = pub.nextAllowedAt ? Date.parse(pub.nextAllowedAt) : 0;
    const wait = Math.max(0, due - Date.now()) + 1500;
    const t = window.setTimeout(() => {
      if (Date.now() - autoTried.current < 60_000) return;
      autoTried.current = Date.now();
      api<PublishState & { started: boolean }>("publish", { method: "POST" }).then(setPub).catch(() => {});
    }, wait);
    return () => window.clearTimeout(t);
  }, [pub]);

  useEffect(() => setMenuOpen(false), [route]);

  async function logout() {
    try { await api("logout", { method: "POST" }); } catch { /* ignore */ }
    onLogout();
  }

  const parts = route.split("?")[0].split("/").filter(Boolean);
  const section = parts[0] ?? "";
  const nav = [
    { href: "/", label: "Dashboard", key: "" },
    { href: "/orders", label: "Orders", key: "orders" },
    { href: "/products", label: "Products", key: "products" },
    { href: "/categories", label: "Categories", key: "categories" },
    ...(user.role === "owner"
      ? [
          { href: "/team", label: "Team", key: "team" },
          { href: "/settings", label: "Settings", key: "settings" },
          { href: "/activity", label: "Activity log", key: "activity" },
        ]
      : [{ href: "/settings", label: "My account", key: "settings" }]),
  ];

  let view: React.ReactNode;
  if (section === "products" && parts[1]) view = <ProductEdit id={parts[1] === "new" ? null : Number(parts[1])} />;
  else if (section === "products") view = <ProductList />;
  else if (section === "categories") view = <Categories />;
  else if (section === "orders" && parts[1] === "new") view = <OrderNew />;
  else if (section === "orders" && parts[1]) view = <OrderView id={Number(parts[1])} />;
  else if (section === "orders") view = <OrderList />;
  else if (section === "team" && user.role === "owner") view = <Team />;
  else if (section === "settings") view = <SettingsView />;
  else if (section === "activity" && user.role === "owner") view = <Activity />;
  else view = <Dashboard />;

  return (
    <Ctx.Provider value={{ user, toast, fail, refreshPublish }}>
      <div className="adm-shell">
        <aside className={`adm-side${menuOpen ? " open" : ""}`}>
          <div className="adm-brand">
            <span className="adm-brand-word">INSI HOUSE</span>
            <span className="adm-tag">Admin</span>
          </div>
          <nav aria-label="Admin">
            {nav.map((n) => (
              <a key={n.href} href={`#${n.href}`} className={section === n.key ? "active" : ""}>{n.label}</a>
            ))}
          </nav>
          <div className="adm-side-foot">
            <a href="/" target="_blank" rel="noopener noreferrer">View website ↗</a>
            <div className="adm-me">
              <b>{user.name || user.email}</b>
              <span>{user.role === "owner" ? "Owner" : "Staff"}</span>
            </div>
            <button className="adm-btn ghost block" onClick={logout}>Log out</button>
          </div>
        </aside>
        {menuOpen && <button className="adm-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

        <div className="adm-main">
          <header className="adm-top">
            <button className="adm-btn ghost adm-menu-btn" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>☰</button>
            <PublishPill pub={pub} onPublish={async () => {
              try {
                const r = await api<PublishState & { started: boolean; reason?: string }>("publish", { method: "POST" });
                setPub(r);
                toast(r.started ? "Website is updating. Changes appear in about 3 minutes." : r.reason ?? "Not started", r.started ? "ok" : "err");
              } catch (e) { fail(e); }
            }} />
          </header>
          <div className="adm-content">{view}</div>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function PublishPill({ pub, onPublish }: { pub: PublishState | null; onPublish: () => void }) {
  if (!pub) return <span />;
  if (!pub.hook) return <span className="adm-pill warn" title="Ask the developer to set DEPLOY_HOOK_URL">Website auto-update is not set up</span>;
  const building = pub.lastPublish && Date.now() - Date.parse(pub.lastPublish) < 4 * 60_000;
  if (pub.pending) {
    return (
      <span className="adm-pill warn">
        Changes waiting for the website
        <button className="adm-btn small" onClick={onPublish}>Update now</button>
      </span>
    );
  }
  if (building) return <span className="adm-pill info"><span className="adm-dot pulse" /> Website is updating (about 3 min)</span>;
  return <span className="adm-pill ok"><span className="adm-dot" /> Website is up to date</span>;
}

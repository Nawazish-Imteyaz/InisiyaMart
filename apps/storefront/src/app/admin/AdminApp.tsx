"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, when, type AdminUser } from "./lib";
import { Icon, type IconName } from "./views/icons";
import { Dashboard } from "./views/Dashboard";
import { ProductList, ProductEdit } from "./views/Products";
import { Categories } from "./views/Categories";
import { Occasions } from "./views/Occasions";
import { OrderList, OrderView, OrderNew } from "./views/Orders";
import { CustomerList, CustomerView } from "./views/Customers";
import { Enquiries } from "./views/Enquiries";
import { Coupons } from "./views/Coupons";
import { Integrations, Webhooks } from "./views/Integrations";
import { Team } from "./views/Team";
import { SettingsView } from "./views/Settings";
import { Security } from "./views/Security";
import { Activity } from "./views/Activity";

// ---------------- Toasts & current user (shared with all views) ----------------
type Toast = { id: number; text: string; kind: "ok" | "err" };
interface AdminCtx {
  user: AdminUser;
  toast: (text: string, kind?: "ok" | "err") => void;
  fail: (e: unknown) => void;
  refreshPublish: () => void;
  refreshBell: () => void;
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

// ---------------- Login (with optional 2-step code) ----------------
function Login({ onDone, fail }: { onDone: (u: AdminUser) => void; fail: (e: unknown) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ user?: AdminUser; need_code?: boolean }>("login", { body: { email, password, ...(needCode ? { code } : {}) } });
      if (r.need_code) setNeedCode(true);
      else if (r.user) onDone(r.user);
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
        <h1>{needCode ? "Two-step login" : "Admin console"}</h1>
        <p className="adm-muted">{needCode ? "Open your authenticator app and type the 6-digit code for Insi House." : "Log in to manage products, orders and your website."}</p>
        {!needCode ? (
          <>
            <label className="adm-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="adm-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          </>
        ) : (
          <label className="adm-field"><span>6-digit code</span><input className="adm-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
        )}
        <button className="adm-btn primary block" disabled={busy}>{busy ? "Checking…" : needCode ? "Verify & log in" : "Log in"}</button>
        {needCode ? <button type="button" className="adm-btn ghost block" onClick={() => { setNeedCode(false); setCode(""); }}>← Back</button> : <a className="adm-link" href="/">← Back to website</a>}
        <p className="adm-secure">🔒 Protected login · too many wrong tries locks it for 15 minutes</p>
      </form>
    </div>
  );
}

// ---------------- Shell ----------------
interface PublishState { hook: boolean; pending: boolean; lastPublish: string | null; nextAllowedAt: string | null }
interface Bell {
  counts: { orders: number; utr: number; enquiries: number; outOfStock: number; hookFails: number };
  items: { kind: "order" | "utr" | "enquiry"; id: number; title: string; sub: string; created_at: string }[];
}
type NavLeaf = { href: string; label: string; match: (r: string) => boolean; badge?: number };
type NavItem = { label: string; icon: IconName; href?: string; match?: (r: string) => boolean; badge?: number; items?: NavLeaf[] };

const starts = (p: string) => (r: string) => r === p || r.startsWith(`${p}/`) || r.startsWith(`${p}?`);

function Shell({ user, onLogout, toast, fail }: { user: AdminUser; onLogout: () => void; toast: AdminCtx["toast"]; fail: AdminCtx["fail"] }) {
  const route = useRoute();
  const path = route.split("?")[0];
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsedPref, setCollapsed] = useState(false);
  const [wide, setWide] = useState(true);
  // The mini sidebar is for laptops only; phones always get the full slide-in menu.
  const collapsed = collapsedPref && wide;
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 821px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [pub, setPub] = useState<PublishState | null>(null);
  const [bell, setBell] = useState<Bell | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const autoTried = useRef(0);
  const owner = user.role === "owner";

  const refreshPublish = useCallback(() => { api<PublishState>("publish").then(setPub).catch(() => {}); }, []);
  const refreshBell = useCallback(() => { api<Bell>("notifications").then(setBell).catch(() => {}); }, []);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("ih-adm-collapsed") === "1"); } catch { /* ignore */ }
    refreshPublish();
    refreshBell();
    const t = window.setInterval(refreshPublish, 30_000);
    const b = window.setInterval(refreshBell, 60_000);
    return () => { window.clearInterval(t); window.clearInterval(b); };
  }, [refreshPublish, refreshBell]);
  // Keep the website in sync: if changes are waiting and the 3-minute gap has passed, refresh automatically.
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
  useEffect(() => { setMenuOpen(false); refreshBell(); window.scrollTo({ top: 0 }); }, [path, refreshBell]);

  async function logout() {
    try { await api("logout", { method: "POST" }); } catch { /* ignore */ }
    onLogout();
  }
  function toggleCollapse() {
    setCollapsed((c) => { try { localStorage.setItem("ih-adm-collapsed", c ? "0" : "1"); } catch { /* ignore */ } return !c; });
  }

  const c = bell?.counts;
  const nav: NavItem[] = [
    { label: "Dashboard", icon: "dashboard", href: "/", match: (r) => r === "/" },
    { label: "Orders", icon: "cart", href: "/orders", match: starts("/orders"), badge: (c?.orders ?? 0) + (c?.utr ?? 0) },
    {
      label: "Catalogue", icon: "box", items: [
        { href: "/products", label: "All products", match: (r) => r === "/products" || (/^\/products\/\d+/.test(r)) },
        { href: "/products/new", label: "Add product", match: (r) => r === "/products/new" },
        { href: "/categories", label: "Categories", match: starts("/categories") },
        { href: "/occasions", label: "Occasions", match: starts("/occasions") },
      ],
    },
    {
      label: "Customers", icon: "users", badge: c?.enquiries, items: [
        { href: "/customers", label: "All customers", match: (r) => r === "/customers" || /^\/customers\/(\d+|guests)/.test(r) },
        { href: "/enquiries", label: "Event enquiries", match: starts("/enquiries"), badge: c?.enquiries },
        { href: "/customers/deleted", label: "Deleted accounts", match: starts("/customers/deleted") },
      ],
    },
    { label: "Coupons", icon: "tag", href: "/coupons", match: starts("/coupons") },
    ...(owner
      ? [{
          label: "Settings", icon: "gear" as IconName, badge: c?.hookFails || undefined, items: [
            { href: "/settings", label: "Store settings", match: starts("/settings") },
            { href: "/integrations/payments", label: "Payments", match: starts("/integrations/payments") },
            { href: "/integrations/shipping", label: "Shipping & couriers", match: starts("/integrations/shipping") },
            { href: "/integrations/messaging", label: "WhatsApp & SMS", match: starts("/integrations/messaging") },
            { href: "/webhooks", label: "Webhooks", match: starts("/webhooks"), badge: c?.hookFails || undefined },
            { href: "/team", label: "Team & permissions", match: starts("/team") },
            { href: "/security", label: "Security", match: starts("/security") },
            { href: "/activity", label: "Activity log", match: starts("/activity") },
          ],
        }]
      : [{
          label: "My account", icon: "gear" as IconName, items: [
            { href: "/settings", label: "Password", match: starts("/settings") },
            { href: "/security", label: "Security", match: starts("/security") },
          ],
        }]),
  ];

  const parts = path.split("/").filter(Boolean);
  const section = parts[0] ?? "";
  let view: React.ReactNode;
  let title = "Dashboard";
  if (section === "products" && parts[1]) { view = <ProductEdit id={parts[1] === "new" ? null : Number(parts[1])} />; title = parts[1] === "new" ? "Add product" : "Edit product"; }
  else if (section === "products") { view = <ProductList />; title = "Products"; }
  else if (section === "categories") { view = <Categories />; title = "Categories"; }
  else if (section === "occasions") { view = <Occasions />; title = "Occasions"; }
  else if (section === "orders" && parts[1] === "new") { view = <OrderNew />; title = "New order"; }
  else if (section === "orders" && parts[1]) { view = <OrderView id={Number(parts[1])} />; title = "Order"; }
  else if (section === "orders") { view = <OrderList />; title = "Orders"; }
  else if (section === "customers" && parts[1] && /^\d+$/.test(parts[1])) { view = <CustomerView id={Number(parts[1])} />; title = "Customer"; }
  else if (section === "customers") { view = <CustomerList tab={parts[1] === "deleted" ? "deleted" : parts[1] === "guests" ? "guests" : "registered"} />; title = parts[1] === "deleted" ? "Deleted accounts" : "Customers"; }
  else if (section === "enquiries") { view = <Enquiries />; title = "Event enquiries"; }
  else if (section === "coupons") { view = <Coupons />; title = "Coupons"; }
  else if (section === "integrations" && owner) { const g = (parts[1] ?? "payments") as "payments" | "shipping" | "messaging"; view = <Integrations group={g} />; title = g === "payments" ? "Payments" : g === "shipping" ? "Shipping & couriers" : "WhatsApp & SMS"; }
  else if (section === "webhooks" && owner) { view = <Webhooks />; title = "Webhooks"; }
  else if (section === "team" && owner) { view = <Team />; title = "Team & permissions"; }
  else if (section === "settings") { view = <SettingsView />; title = owner ? "Store settings" : "My account"; }
  else if (section === "security") { view = <Security />; title = "Security"; }
  else if (section === "activity" && owner) { view = <Activity />; title = "Activity log"; }
  else view = <Dashboard />;

  const bellTotal = (c?.orders ?? 0) + (c?.utr ?? 0) + (c?.enquiries ?? 0);

  return (
    <Ctx.Provider value={{ user, toast, fail, refreshPublish, refreshBell }}>
      <div className={`adm-shell${collapsed ? " collapsed" : ""}`}>
        <aside className={`adm-side${menuOpen ? " open" : ""}`}>
          <div className="adm-side-top">
            <a href="#/" className="adm-brand">
              <span className="adm-brand-word">{collapsed ? "IH" : "INSI HOUSE"}</span>
              {!collapsed && <span className="urdu adm-brand-urdu" lang="ur" dir="rtl">انسی ہاؤس</span>}
            </a>
            <button className="adm-collapse" onClick={toggleCollapse} aria-label={collapsed ? "Expand menu" : "Collapse menu"} title={collapsed ? "Expand menu" : "Collapse menu"}>
              <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={18} />
            </button>
          </div>
          <nav aria-label="Admin" className="adm-nav">
            {nav.map((n) => {
              if (!n.items) {
                const on = n.match?.(path) ?? false;
                return (
                  <a key={n.label} href={`#${n.href}`} className={`adm-nav-item${on ? " active" : ""}`} title={collapsed ? n.label : undefined}>
                    <Icon name={n.icon} /><span className="adm-nav-label">{n.label}</span>{!!n.badge && <span className="adm-badge">{n.badge}</span>}
                  </a>
                );
              }
              const childOn = n.items.some((i) => i.match(path));
              const isOpen = open[n.label] ?? childOn;
              return (
                <div key={n.label} className={`adm-nav-group${childOn ? " has-active" : ""}`}>
                  <button type="button" className="adm-nav-item" aria-expanded={isOpen} onClick={() => (collapsed ? (toggleCollapse(), setOpen({ ...open, [n.label]: true })) : setOpen({ ...open, [n.label]: !isOpen }))} title={collapsed ? n.label : undefined}>
                    <Icon name={n.icon} /><span className="adm-nav-label">{n.label}</span>
                    {!!n.badge && !isOpen && <span className="adm-badge">{n.badge}</span>}
                    <span className="adm-caret"><Icon name="chevronDown" size={16} /></span>
                  </button>
                  {isOpen && !collapsed && (
                    <div className="adm-subnav">
                      {n.items.map((i) => (
                        <a key={i.href} href={`#${i.href}`} className={i.match(path) ? "active" : ""}>
                          <span>{i.label}</span>{!!i.badge && <span className="adm-badge">{i.badge}</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="adm-side-foot">
            <a href="/" target="_blank" rel="noopener noreferrer" className="adm-nav-item" title="View website"><Icon name="external" /><span className="adm-nav-label">View website</span></a>
          </div>
        </aside>
        {menuOpen && <button className="adm-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

        <div className="adm-main">
          <header className="adm-top">
            <button className="adm-icon-btn adm-menu-btn" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}><Icon name="menu" /></button>
            <h1 className="adm-top-title">{title}</h1>
            <PublishPill pub={pub} onPublish={async () => {
              try {
                const r = await api<PublishState & { started: boolean; reason?: string }>("publish", { method: "POST" });
                setPub(r);
                toast(r.started ? "Website is updating. Changes appear in about 3 minutes." : r.reason ?? "Not started", r.started ? "ok" : "err");
              } catch (e) { fail(e); }
            }} />
            <BellMenu bell={bell} total={bellTotal} />
            <UserMenu user={user} onLogout={logout} />
          </header>
          <div className="adm-content">{view}</div>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [ref, close]);
}

function BellMenu({ bell, total }: { bell: Bell | null; total: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, close);
  const c = bell?.counts;
  return (
    <div className="adm-pop-wrap" ref={ref}>
      <button className="adm-icon-btn adm-bell" aria-label={`Notifications${total ? `, ${total} new` : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" />
        {total > 0 && <span className="adm-bell-dot">{total > 9 ? "9+" : total}</span>}
      </button>
      {open && (
        <div className="adm-pop adm-bell-pop" role="dialog" aria-label="Notifications">
          <div className="adm-pop-head"><b>Notifications</b></div>
          <div className="adm-bell-counts">
            <a href="#/orders?status=new" onClick={close}><b>{c?.orders ?? 0}</b><span>New orders</span></a>
            <a href="#/orders?pay=check" onClick={close}><b>{c?.utr ?? 0}</b><span>Payments to check</span></a>
            <a href="#/enquiries" onClick={close}><b>{c?.enquiries ?? 0}</b><span>Enquiries</span></a>
            <a href="#/products" onClick={close}><b>{c?.outOfStock ?? 0}</b><span>Out of stock</span></a>
          </div>
          {bell && bell.items.length > 0 ? (
            <ul className="adm-bell-list">
              {bell.items.map((i) => (
                <li key={`${i.kind}${i.id}`}>
                  <a href={i.kind === "enquiry" ? "#/enquiries" : `#/orders/${i.id}`} onClick={close}>
                    <span className={`adm-bell-ic k-${i.kind}`}><Icon name={i.kind === "enquiry" ? "sparkle" : i.kind === "utr" ? "rupee" : "cart"} size={16} /></span>
                    <span><b>{i.kind === "order" ? `New order ${i.title}` : i.kind === "utr" ? `${i.title}: payment sent` : `Enquiry from ${i.title}`}</b><small>{i.sub || "—"} · {when(i.created_at)}</small></span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <p className="adm-muted" style={{ padding: "8px 16px 16px", margin: 0 }}>You&apos;re all caught up ✨</p>}
        </div>
      )}
    </div>
  );
}

function UserMenu({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, close);
  return (
    <div className="adm-pop-wrap" ref={ref}>
      <button className="adm-user-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="adm-avatar">{(user.name || user.email)[0]?.toUpperCase()}</span>
        <span className="adm-user-text"><b>{user.name || user.email}</b><small>{user.role === "owner" ? "Owner" : "Staff"}</small></span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="adm-pop adm-user-pop" role="menu">
          <div className="adm-pop-head"><b>{user.name}</b><small>{user.email}</small></div>
          <a role="menuitem" href="#/security" onClick={close}><Icon name="shield" size={18} /> Security {user.totp ? <span className="adm-tag ok">2-step on</span> : <span className="adm-tag warn">2-step off</span>}</a>
          <a role="menuitem" href="#/settings" onClick={close}><Icon name="key" size={18} /> Change password</a>
          <a role="menuitem" href="/" target="_blank" rel="noopener noreferrer" onClick={close}><Icon name="external" size={18} /> View website</a>
          <button role="menuitem" className="danger" onClick={onLogout}><Icon name="logout" size={18} /> Log out</button>
        </div>
      )}
    </div>
  );
}

function PublishPill({ pub, onPublish }: { pub: PublishState | null; onPublish: () => void }) {
  if (!pub) return <span className="adm-pill-space" />;
  if (!pub.hook) return <span className="adm-pill warn" title="Ask the developer to set DEPLOY_HOOK_URL">Auto-update off</span>;
  const building = pub.lastPublish && Date.now() - Date.parse(pub.lastPublish) < 4 * 60_000;
  if (pub.pending) {
    return (
      <span className="adm-pill warn">
        <span className="adm-pill-text">Changes waiting</span>
        <button className="adm-btn small" onClick={onPublish}>Update now</button>
      </span>
    );
  }
  if (building) return <span className="adm-pill info"><span className="adm-dot pulse" /> <span className="adm-pill-text">Website updating</span></span>;
  return <span className="adm-pill ok"><span className="adm-dot" /> <span className="adm-pill-text">Website up to date</span></span>;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatInr, type Product } from "@/data/catalog";
import { accountApi, firstName, logout, setMe, useAccount, type Me } from "@/lib/account";
import { cart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { LoginBox } from "@/components/LoginBox";
import { ProductCard } from "@/components/ProductCard";
import { AddressFields, addrProblem, emptyAddr, type Addr, type SavedAddress } from "@/components/AddressFields";

const TABS = [
  { id: "orders", label: "My orders" },
  { id: "wishlist", label: "Wishlist" },
  { id: "addresses", label: "Addresses" },
  { id: "profile", label: "Profile" },
  { id: "security", label: "Password & privacy" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "Order placed", tone: "rani" }, confirmed: { label: "Confirmed", tone: "lilac" }, packed: { label: "Packed", tone: "marigold" },
  shipped: { label: "Shipped", tone: "peacock" }, delivered: { label: "Delivered", tone: "ok" }, cancelled: { label: "Cancelled", tone: "muted" }, returned: { label: "Returned", tone: "muted" },
};

function when(s: string) {
  const d = new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export function AccountApp({ products }: { products: Product[] }) {
  const { me, ready } = useAccount();
  const [tab, setTab] = useState<Tab>("orders");

  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1) as Tab; if (TABS.some((t) => t.id === h)) setTab(h); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  if (!ready) return <div className="cart-empty"><span className="spinner" aria-label="Loading" /></div>;

  if (!me) {
    return (
      <div className="login-page">
        <aside className="login-side">
          <h1 className="display">Your Insi House</h1>
          <ul>
            <li>Track every order in one place</li>
            <li>Save addresses for faster checkout</li>
            <li>Your wishlist and cart on every device</li>
            <li>Early access to festival collections</li>
          </ul>
          <span className="urdu" lang="ur" dir="rtl">خوش آمدید</span>
        </aside>
        <div className="login-main"><LoginBox /></div>
      </div>
    );
  }

  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `#${t}`); };
  return (
    <div className="acct">
      <aside className="acct-side">
        <div className="acct-hello">
          <span className="acct-avatar" aria-hidden="true">{(firstName(me)[0] || "★").toUpperCase()}</span>
          <span><small>Hello,</small><b>{me.name || "Friend"}</b><small>+91 {me.phone}{me.verified ? " · verified" : ""}</small></span>
        </div>
        <nav className="acct-tabs" aria-label="My account">
          {TABS.map((t) => <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>{t.label}</button>)}
          <button type="button" className="acct-logout" onClick={() => logout()}>Log out</button>
        </nav>
      </aside>
      <section className="acct-main">
        {tab === "orders" && <Orders />}
        {tab === "wishlist" && <Wishlist products={products} />}
        {tab === "addresses" && <Addresses />}
        {tab === "profile" && <Profile me={me} />}
        {tab === "security" && <Security me={me} />}
      </section>
    </div>
  );
}

// ---------------- Orders ----------------
interface MyOrder {
  number: string; status: string; payment_status: string; payment_method: string; total: number; created_at: string; courier: string; awb: string; tracking_url: string;
  items: { name: string; qty: number; priceInr: number; slug: string | null; image: string | null }[];
}
function Orders() {
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");
  useEffect(() => { accountApi<{ orders: MyOrder[] }>("orders").then((r) => setOrders(r.orders)).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="form-error">{error}</p>;
  if (!orders) return <div className="cart-empty"><span className="spinner" aria-label="Loading" /></div>;
  if (!orders.length) return (
    <div className="empty-state"><b>No orders yet</b><span className="muted">When you order, you can track it here.</span><Link href="/shop/" className="btn btn-glow">Start shopping</Link></div>
  );
  return (
    <>
      <h2 className="acct-title">My orders</h2>
      <ul className="my-orders">
        {orders.map((o) => {
          const s = STATUS[o.status] ?? { label: o.status, tone: "muted" };
          const again = o.items.filter((i) => i.slug);
          return (
            <li key={o.number} className="my-order">
              <div className="mo-head">
                <span><b>{o.number}</b><small>{when(o.created_at)}</small></span>
                <span className={`st st-${s.tone}`}>{s.label}</span>
              </div>
              <ul className="mo-items">
                {o.items.map((i, k) => (
                  <li key={k}>
                    <span className="mo-thumb">{i.image ? <img src={i.image} alt="" loading="lazy" /> : "✦"}</span>
                    <span>{i.slug ? <Link href={`/product/${i.slug}/`}>{i.name}</Link> : i.name}<small>Qty {i.qty} · {formatInr(i.priceInr)}</small></span>
                  </li>
                ))}
              </ul>
              <div className="mo-foot">
                <b>{formatInr(o.total)}</b>
                <span className="muted">{o.payment_status === "paid" ? "Paid" : o.payment_status === "cod" ? "Cash on delivery" : o.payment_status === "refunded" ? "Refunded" : "Payment pending"}</span>
                <span className="mo-actions">
                  {again.length > 0 && <button type="button" className="btn btn-outline small" onClick={() => { again.forEach((i) => cart.add(i.slug!, i.qty)); setAdded(o.number); }}>{added === o.number ? "✓ In your cart" : "Buy again"}</button>}
                  <Link href={`/order/?n=${o.number}`} className="btn small">Track & details</Link>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ---------------- Wishlist ----------------
export function Wishlist({ products }: { products: Product[] }) {
  const { list, ready } = useWishlist();
  if (!ready) return null;
  const items = list.map((s) => products.find((p) => p.slug === s)).filter((p): p is Product => !!p);
  return (
    <>
      <h2 className="acct-title">Wishlist {items.length > 0 && <small>({items.length})</small>}</h2>
      {items.length === 0 ? (
        <div className="empty-state"><b>Nothing saved yet</b><span className="muted">Tap the ♥ on any gift to save it here.</span><Link href="/shop/" className="btn btn-glow">Find gifts</Link></div>
      ) : (
        <div className="grid">{items.map((p) => <ProductCard key={p.slug} p={p} />)}</div>
      )}
    </>
  );
}

// ---------------- Addresses ----------------
function Addresses() {
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [edit, setEdit] = useState<(Addr & { id?: number; label: string; is_default: boolean }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => accountApi<{ addresses: SavedAddress[] }>("addresses").then((r) => setList(r.addresses)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const p = addrProblem(edit);
    if (p) { setError(p); return; }
    setBusy(true);
    setError("");
    try {
      await accountApi(edit.id ? `addresses/${edit.id}` : "addresses", { method: edit.id ? "PUT" : "POST", body: edit });
      setEdit(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save"); } finally { setBusy(false); }
  }
  async function remove(id: number) {
    if (!confirm("Delete this address?")) return;
    await accountApi(`addresses/${id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    load();
  }
  async function makeDefault(a: SavedAddress) {
    await accountApi(`addresses/${a.id}`, { method: "PUT", body: { ...a, is_default: true } }).catch((e) => setError(e.message));
    load();
  }

  return (
    <>
      <div className="acct-row"><h2 className="acct-title">Saved addresses</h2>{!edit && <button type="button" className="btn btn-outline small" onClick={() => setEdit({ ...emptyAddr, label: "Home", is_default: false })}>+ Add address</button>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {edit && (
        <form className="form-card" onSubmit={save} noValidate>
          <div className="seg small" role="radiogroup" aria-label="Label">
            {["Home", "Work", "Family", "Other"].map((l) => <button key={l} type="button" role="radio" aria-checked={edit.label === l} onClick={() => setEdit({ ...edit, label: l })}>{l}</button>)}
          </div>
          <AddressFields v={edit} onChange={(k, v) => setEdit({ ...edit, [k]: v })} />
          <label className="consent"><input type="checkbox" checked={edit.is_default} onChange={(e) => setEdit({ ...edit, is_default: e.target.checked })} /><span>Use as my default address</span></label>
          <div className="row-btns"><button className="btn btn-glow" disabled={busy}>{busy ? "Saving…" : "Save address"}</button><button type="button" className="btn btn-outline" onClick={() => { setEdit(null); setError(""); }}>Cancel</button></div>
        </form>
      )}
      {!list ? <div className="cart-empty"><span className="spinner" /></div> : list.length === 0 && !edit ? (
        <div className="empty-state"><b>No saved addresses</b><span className="muted">Addresses you use at checkout can be saved here.</span></div>
      ) : (
        <div className="addr-grid">
          {list.map((a) => (
            <div key={a.id} className={`addr-card${a.is_default ? " def" : ""}`}>
              <span className="addr-label">{a.label}{a.is_default ? " · Default" : ""}</span>
              <b>{a.name}</b>
              <span>{a.address}, {a.city}, {a.state} {a.pincode}</span>
              <span className="muted">+91 {a.phone}</span>
              <span className="addr-actions">
                <button type="button" className="link-btn" onClick={() => setEdit({ ...a, is_default: !!a.is_default })}>Edit</button>
                {!a.is_default && <button type="button" className="link-btn" onClick={() => makeDefault(a)}>Make default</button>}
                <button type="button" className="link-btn danger" onClick={() => remove(a.id)}>Delete</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------- Profile ----------------
function Profile({ me }: { me: Me }) {
  const [f, setF] = useState({ name: me.name, email: me.email, marketing: me.marketing });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setError("");
    try { await accountApi("profile", { method: "PUT", body: f }); setMe({ ...me, ...f }); setMsg("Saved ✓"); } catch (err) { setError(err instanceof Error ? err.message : "Could not save"); }
  }
  return (
    <form className="form-card" onSubmit={save}>
      <h2>Profile</h2>
      <div className="form-grid">
        <label className="form-field">Name<input required maxLength={80} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="form-field">Mobile number<input value={`+91 ${me.phone}`} disabled /><small>{me.verified ? "Verified with a code." : "Not verified yet. It's verified the first time you log in with a code."}</small></label>
        <label className="form-field wide">Email (optional)<input type="email" maxLength={120} autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      </div>
      <label className="consent"><input type="checkbox" checked={f.marketing} onChange={(e) => setF({ ...f, marketing: e.target.checked })} /><span>Tell me about new collections and festival offers on WhatsApp (you can stop any time).</span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {msg && <p className="ok-note" role="status">{msg}</p>}
      <button className="btn btn-glow" style={{ alignSelf: "flex-start" }}>Save changes</button>
    </form>
  );
}

// ---------------- Password & privacy ----------------
function Security({ me }: { me: Me }) {
  const [pw, setPw] = useState({ current: "", next: "" });
  const [del, setDel] = useState({ confirm: "", password: "" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  async function change(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setError("");
    try { await accountApi("password", { method: "PUT", body: pw }); setPw({ current: "", next: "" }); setMe({ ...me, hasPassword: true }); setMsg("Password saved ✓ Other devices were logged out."); } catch (err) { setError(err instanceof Error ? err.message : "Could not save"); }
  }
  async function remove(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!confirm("Delete your account for ever? Your saved addresses, wishlist and login will be removed.")) return;
    try { await accountApi("", { method: "DELETE", body: del }); setMe(null); } catch (err) { setError(err instanceof Error ? err.message : "Could not delete"); }
  }
  return (
    <>
      <form className="form-card" onSubmit={change}>
        <h2>{me.hasPassword ? "Change password" : "Set a password"}</h2>
        <div className="form-grid">
          {me.hasPassword && <label className="form-field">Current password<input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>}
          <label className="form-field">New password<input type="password" minLength={8} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><small>At least 8 characters, letters and numbers.</small></label>
        </div>
        {msg && <p className="ok-note" role="status">{msg}</p>}
        <button className="btn btn-glow" style={{ alignSelf: "flex-start" }}>Save password</button>
      </form>
      <form className="form-card danger-card" onSubmit={remove}>
        <h2>Delete my account</h2>
        <p className="muted" style={{ margin: 0 }}>Your name, email, addresses, wishlist and login are erased. Past order records are kept only as long as tax law needs, as the <Link href="/policies/privacy/">privacy policy</Link> explains.</p>
        <div className="form-grid">
          <label className="form-field">Type DELETE<input value={del.confirm} onChange={(e) => setDel({ ...del, confirm: e.target.value.toUpperCase() })} /></label>
          {me.hasPassword && <label className="form-field">Your password<input type="password" autoComplete="current-password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></label>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-outline danger" style={{ alignSelf: "flex-start" }} disabled={del.confirm !== "DELETE"}>Delete my account</button>
      </form>
    </>
  );
}

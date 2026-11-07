"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatInr, makerLink, occasions, productLink } from "@/data/catalog";
import { useAccount } from "@/lib/account";
import { LoginBox } from "@/components/LoginBox";
import { compressImage } from "@/app/admin/lib";
import { whatsappLink } from "@/lib/site";
import { REVIEW_LABEL, sellerApi, STATES, type CategoryOpt, type MyProduct, type Overview, type Shop } from "@/lib/seller";

type Tab = "home" | "products" | "shop" | "help";
const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "🏠 Home" }, { id: "products", label: "🧺 My products" }, { id: "shop", label: "🏪 My shop" }, { id: "help", label: "💬 Help" },
];
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function SellerApp() {
  const { me, ready } = useAccount();
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => { sellerApi<Overview>("").then(setOv).catch((e) => setError(msg(e))); }, []);
  useEffect(() => { if (me) load(); }, [me, load]);

  if (!ready) return <div className="cart-empty"><span className="spinner" aria-label="Loading" /></div>;
  if (!me) {
    return (
      <div className="login-page">
        <aside className="login-side">
          <h1 className="display">Open your shop</h1>
          <ul>
            <li>Free to join: 0% commission</li>
            <li>Sell your handmade work across India</li>
            <li>Simple: add a product in 2 minutes from your phone</li>
            <li>Your phone number and address stay private</li>
          </ul>
          <span className="urdu" lang="ur" dir="rtl">ہنر کی دکان</span>
        </aside>
        <div className="login-main">
          <p className="muted" style={{ marginBlockStart: 0 }}>Step 1 of 5 · Log in or create your account with your mobile number.</p>
          <LoginBox />
        </div>
      </div>
    );
  }
  if (error) return <p className="form-error">{error} <button className="link-btn" onClick={() => { setError(""); load(); }}>Try again</button></p>;
  if (!ov) return <div className="cart-empty"><span className="spinner" aria-label="Loading" /></div>;
  if (!ov.seller || ov.step < 6) return <Wizard ov={ov} reload={load} />;
  return <Dashboard ov={ov} reload={load} />;
}

// ============================ Become a seller: steps 2–5 ============================
const STEPS = [
  { n: 2, label: "Your shop" }, { n: 3, label: "First product" }, { n: 4, label: "Getting paid" }, { n: 5, label: "Send for approval" },
];

function Wizard({ ov, reload }: { ov: Overview; reload: () => void }) {
  const [step, setStep] = useState(ov.step);
  useEffect(() => setStep(ov.step), [ov.step]);
  const s = ov.seller;
  const reached = (n: number) => n <= ov.step;
  return (
    <div className="sel-wizard">
      <header className="sel-wiz-head">
        <h1 className="display">{s ? `Your shop: ${s.shop_name}` : "Open your shop on Insi House"}</h1>
        <p className="muted">Free to join · 0% commission · handmade only. It takes about 5 minutes.</p>
        <ol className="sel-steps">
          <li className="done">Log in</li>
          {STEPS.map((x) => (
            <li key={x.n} className={step === x.n ? "on" : reached(x.n) ? "done" : ""}>
              <button type="button" disabled={!reached(x.n)} onClick={() => setStep(x.n)}>{x.label}</button>
            </li>
          ))}
        </ol>
      </header>
      {s?.status === "changes" && s.review_note && <div className="infobox warn"><b>Insi House asked for a few changes</b><span>{s.review_note}</span></div>}
      {step === 2 && <ShopBasics shop={s} onSaved={reload} />}
      {step === 3 && s && (
        <section className="form-card">
          <h2 className="acct-title">Add your first product</h2>
          <p className="muted">Take 2–3 clear photos in daylight on a plain background. You can add more products later.</p>
          <ProductEditor onDone={reload} />
        </section>
      )}
      {step === 4 && s && <Payment shop={s} onSaved={reload} />}
      {step === 5 && s && <Submit shop={s} onDone={reload} />}
    </div>
  );
}

function useShopForm(shop: Shop | null, fields: (keyof Shop)[]) {
  const [f, setF] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map((k) => [k, typeof shop?.[k] === "number" && (k === "show_photo" || k === "holiday" || k === "cod") ? !!shop?.[k] : shop?.[k] == null ? "" : String(shop[k])])));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  return { f, set, setF };
}

function ShopBasics({ shop, onSaved }: { shop: Shop | null; onSaved: () => void }) {
  const { f, set } = useShopForm(shop, ["shop_name", "maker_name", "craft", "story", "district", "state", "full_name", "address", "pincode"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await sellerApi("shop", { method: "PUT", body: f }); onSaved(); } catch (x) { setErr(msg(x)); } finally { setBusy(false); }
  }
  return (
    <form className="form-card" onSubmit={save}>
      <h2 className="acct-title">Your shop</h2>
      <p className="sel-note">👀 <b>Buyers see:</b> shop name, your first name, district and state, and your story.</p>
      <div className="form-grid">
        <label className="form-field">Shop name<input required minLength={3} maxLength={50} value={String(f.shop_name)} onChange={set("shop_name")} placeholder="e.g. Rehana's Stitches" /></label>
        <label className="form-field">Your first name (shown to buyers)<input required maxLength={40} value={String(f.maker_name)} onChange={set("maker_name")} placeholder="e.g. Rehana" /></label>
        <label className="form-field">What do you make?<input maxLength={80} value={String(f.craft)} onChange={set("craft")} placeholder="e.g. hand embroidery, crochet, clay diyas" /></label>
        <label className="form-field">District / city<input required maxLength={60} value={String(f.district)} onChange={set("district")} placeholder="e.g. Azamgarh" /></label>
        <label className="form-field">State
          <select required value={String(f.state)} onChange={set("state")}><option value="">Choose…</option>{STATES.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
        <label className="form-field wide">Your story (2–3 lines)<textarea maxLength={600} rows={3} value={String(f.story)} onChange={set("story")} placeholder="I learnt embroidery from my mother. I make each piece by hand at home…" /></label>
      </div>
      <p className="sel-note private">🔒 <b>Private: only Insi House sees this.</b> Used for pickups and checks, never shown to buyers.</p>
      <div className="form-grid">
        <label className="form-field">Full name (as on bank / PAN)<input required maxLength={100} value={String(f.full_name)} onChange={set("full_name")} /></label>
        <label className="form-field">PIN code<input required inputMode="numeric" maxLength={6} value={String(f.pincode)} onChange={set("pincode")} /></label>
        <label className="form-field wide">Pickup address<textarea required maxLength={400} rows={2} value={String(f.address)} onChange={set("address")} placeholder="House, street, village / area" /></label>
      </div>
      {err && <p className="form-error">{err}</p>}
      <button className="btn btn-glow" disabled={busy}>{busy ? "Saving…" : shop ? "Save and continue →" : "Create my shop →"}</button>
    </form>
  );
}

function Payment({ shop, onSaved }: { shop: Shop; onSaved: () => void }) {
  const { f, set } = useShopForm(shop, ["upi_id", "bank_name", "bank_account", "bank_ifsc", "pan"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await sellerApi("shop", { method: "PUT", body: f }); onSaved(); } catch (x) { setErr(msg(x)); } finally { setBusy(false); }
  }
  return (
    <form className="form-card" onSubmit={save}>
      <h2 className="acct-title">How you get paid</h2>
      <p className="muted">Buyers pay you directly by UPI. Insi House takes <b>0% commission</b>.</p>
      <div className="form-grid">
        <label className="form-field wide">Your UPI ID<input required maxLength={80} value={String(f.upi_id)} onChange={set("upi_id")} placeholder="e.g. rehana.stitches@okaxis" /></label>
      </div>
      <p className="sel-note">💡 Tip: buyers&apos; UPI apps show the name and UPI ID they pay to. If your UPI ID is your phone number (98xxxxxx@ybl), create a new one without it in your UPI app (Settings → UPI ID), to keep your number private.</p>
      <details className="sel-more">
        <summary>Bank account and PAN (optional now)</summary>
        <div className="form-grid">
          <label className="form-field">Bank name<input maxLength={80} value={String(f.bank_name)} onChange={set("bank_name")} /></label>
          <label className="form-field">Account number<input inputMode="numeric" maxLength={20} value={String(f.bank_account)} onChange={set("bank_account")} /></label>
          <label className="form-field">IFSC<input maxLength={11} value={String(f.bank_ifsc)} onChange={set("bank_ifsc")} placeholder="SBIN0001234" /></label>
          <label className="form-field">PAN<input maxLength={10} value={String(f.pan)} onChange={set("pan")} placeholder="ABCDE1234F" /></label>
        </div>
      </details>
      {err && <p className="form-error">{err}</p>}
      <button className="btn btn-glow" disabled={busy}>{busy ? "Saving…" : "Save and continue →"}</button>
    </form>
  );
}

function Submit({ shop, onDone }: { shop: Shop; onDone: () => void }) {
  const { f, set } = useShopForm(shop, ["gst_type", "gst_id"]);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await sellerApi("shop", { method: "PUT", body: { gst_type: f.gst_type || "none", gst_id: f.gst_type === "none" ? "" : f.gst_id } });
      await sellerApi("submit", { body: { undertaking: ok } });
      onDone();
    } catch (x) { setErr(msg(x)); } finally { setBusy(false); }
  }
  return (
    <form className="form-card" onSubmit={send}>
      <h2 className="acct-title">Almost done!</h2>
      <fieldset className="sel-radio">
        <legend>Do you have GST? <small className="muted">(optional: you can sell without it)</small></legend>
        {[["none", "No, not yet"], ["gstin", "Yes, I have a GSTIN"], ["enrolment", "I have a GST enrolment ID"]].map(([v, l]) => (
          <label key={v}><input type="radio" name="gst" value={v} checked={(f.gst_type || "none") === v} onChange={set("gst_type")} /> {l}</label>
        ))}
      </fieldset>
      {f.gst_type && f.gst_type !== "none" && (
        <label className="form-field">{f.gst_type === "gstin" ? "GSTIN" : "Enrolment ID"}<input maxLength={15} value={String(f.gst_id)} onChange={set("gst_id")} /></label>
      )}
      <label className="consent">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} required />
        <span>I promise that <b>everything I sell is handmade</b> by me, my family or my group, and that my details are true. I agree to the Insi House seller rules.</span>
      </label>
      {err && <p className="form-error">{err}</p>}
      <button className="btn btn-glow" disabled={busy || !ok}>{busy ? "Sending…" : "Send my shop for approval ✓"}</button>
      <p className="muted" style={{ fontSize: 14 }}>Insi House checks every new shop, usually within 1–2 days. You can keep adding products while you wait.</p>
    </form>
  );
}

// ============================ Dashboard ============================
const STATUS_BANNER: Record<Shop["status"], { cls: string; title: string; text: string }> = {
  draft: { cls: "", title: "Not sent yet", text: "Finish the steps to open your shop." },
  pending: { cls: "soon", title: "⏳ We are checking your shop", text: "Usually within 1–2 days. You can keep adding products. They go live when your shop is approved." },
  approved: { cls: "ok", title: "✅ Your shop is open", text: "Buyers can find your products." },
  changes: { cls: "warn", title: "✏️ A few changes needed", text: "" },
  rejected: { cls: "warn", title: "Your shop was not approved", text: "Please message us on WhatsApp if you have questions." },
  suspended: { cls: "warn", title: "Your shop is paused", text: "Please message us on WhatsApp." },
};

function Dashboard({ ov, reload }: { ov: Overview; reload: () => void }) {
  const s = ov.seller!;
  const [tab, setTab] = useState<Tab>("home");
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1) as Tab; if (TABS.some((t) => t.id === h)) setTab(h); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `#${t}`); };
  const banner = STATUS_BANNER[s.status];
  return (
    <div className="acct">
      <aside className="acct-side">
        <div className="acct-hello">
          {s.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="acct-avatar" src={s.photo} alt="" />
            : <span className="acct-avatar" aria-hidden="true">{(s.shop_name[0] || "★").toUpperCase()}</span>}
          <span><small>Seller</small><b>{s.shop_name}</b><small>{s.district}, {s.state}</small></span>
        </div>
        <nav className="acct-tabs" aria-label="Seller dashboard">
          {TABS.map((t) => <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>{t.label}</button>)}
          {s.status === "approved" && <Link className="acct-tabs-link" href={makerLink(s.slug)}>👁 See my shop page</Link>}
        </nav>
      </aside>
      <div className="acct-main">
        <div className={`infobox ${banner.cls}`}><b>{banner.title}</b><span>{s.status === "changes" ? s.review_note : banner.text}</span></div>
        {tab === "home" && <Home ov={ov} go={go} />}
        {tab === "products" && <Products onChange={reload} />}
        {tab === "shop" && <ShopSettings shop={s} onSaved={reload} />}
        {tab === "help" && <Help />}
      </div>
    </div>
  );
}

function Home({ ov, go }: { ov: Overview; go: (t: Tab) => void }) {
  const c = ov.counts!;
  const [acts, setActs] = useState<{ actor: string; action: string; detail: string; created_at: string }[]>([]);
  useEffect(() => { sellerApi<{ activity: typeof acts }>("activity").then((r) => setActs(r.activity.slice(0, 12))).catch(() => {}); }, []);
  return (
    <>
      <div className="sel-tiles">
        <button type="button" onClick={() => go("products")}><b>{c.live}</b><span>Live products</span></button>
        <button type="button" onClick={() => go("products")}><b>{c.pending}</b><span>Being checked</span></button>
        <button type="button" onClick={() => go("products")} className={c.needsFix ? "warn" : ""}><b>{c.needsFix}</b><span>Need a fix</span></button>
        <button type="button" onClick={() => go("products")} className={c.outOfStock ? "warn" : ""}><b>{c.outOfStock}</b><span>Out of stock</span></button>
      </div>
      <div className="row-btns">
        <button className="btn btn-glow" onClick={() => { history.replaceState(null, "", "#products"); go("products"); window.dispatchEvent(new Event("ih-add-product")); }}>＋ Add a product</button>
      </div>
      <section className="form-card">
        <h2 className="acct-title">Orders</h2>
        <p className="muted">Buying from maker shops opens very soon. Your orders will appear here, with the buyer&apos;s address to ship to.</p>
      </section>
      {acts.length > 0 && (
        <section className="form-card">
          <h2 className="acct-title">Recent activity</h2>
          <ul className="sel-log">
            {acts.map((a, i) => <li key={i}><span>{a.actor.startsWith("admin") ? "🛡 Insi House" : "You"}: {a.action}{a.detail ? ` · ${a.detail}` : ""}</span><small>{when(a.created_at)}</small></li>)}
          </ul>
        </section>
      )}
    </>
  );
}

function when(s: string) {
  const d = new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function Products({ onChange }: { onChange: () => void }) {
  const [list, setList] = useState<MyProduct[] | null>(null);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { sellerApi<{ products: MyProduct[] }>("products").then((r) => setList(r.products)).catch((e) => setErr(msg(e))); }, []);
  useEffect(() => { load(); const add = () => setEditing("new"); window.addEventListener("ih-add-product", add); return () => window.removeEventListener("ih-add-product", add); }, [load]);
  const done = () => { setEditing(null); load(); onChange(); };

  if (editing !== null) {
    return (
      <section className="form-card">
        <h2 className="acct-title">{editing === "new" ? "Add a product" : "Edit product"}</h2>
        <ProductEditor id={editing === "new" ? undefined : editing} onDone={done} onCancel={() => setEditing(null)} />
      </section>
    );
  }
  return (
    <>
      <div className="acct-row"><h2 className="acct-title">My products {list && <small>({list.length})</small>}</h2><button className="btn btn-glow small" onClick={() => setEditing("new")}>＋ Add a product</button></div>
      {err && <p className="form-error">{err}</p>}
      {!list ? <span className="spinner" aria-label="Loading" /> : list.length === 0 ? <p className="empty-state">No products yet. Add your first one!</p> : (
        <ul className="my-orders">
          {list.map((p) => {
            const r = REVIEW_LABEL[p.review_status];
            return (
              <li key={p.id} className="my-order">
                <div className="mo-head">
                  <span style={{ flexDirection: "row", gap: 12, alignItems: "center", display: "flex" }}>
                    <span className="mo-thumb">{p.image_key
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={`/img/${p.image_key}`} alt="" />
                      : "📷"}</span>
                    <span style={{ display: "flex", flexDirection: "column" }}>
                      <b>{p.name}</b>
                      <small>{formatInr(p.price_inr)} · {p.made_to_order_days ? `made to order (${p.made_to_order_days} days)` : `${p.stock} in stock`}{p.status === "hidden" ? " · hidden" : ""}</small>
                    </span>
                  </span>
                  <span className={`st ${r.cls}`}>{r.text}</span>
                </div>
                {p.review_note && p.review_status !== "approved" && <p className="sel-fix">✏️ Insi House: {p.review_note}</p>}
                <div className="mo-foot">
                  <QuickStock p={p} onSaved={load} />
                  <span className="mo-actions">
                    {p.review_status === "approved" && p.status === "active" && <Link className="btn btn-outline small" href={productLink(p.slug)}>View</Link>}
                    <button className="btn btn-outline small" onClick={() => setEditing(p.id)}>Edit</button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** Change stock in one tap (no full edit, never needs a new check). */
function QuickStock({ p, onSaved }: { p: MyProduct; onSaved: () => void }) {
  const [v, setV] = useState(String(p.stock));
  if (p.made_to_order_days) return <span className="muted" style={{ fontSize: 14 }}>Made to order</span>;
  const save = async () => { try { await sellerApi(`products/${p.id}`, { method: "PUT", body: { stock: Number(v) } }); onSaved(); } catch (e) { alert(msg(e)); } };
  return (
    <label className="sel-stock">Stock
      <input inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} />
      {v !== String(p.stock) && <button className="btn btn-glow small" onClick={save}>Save</button>}
    </label>
  );
}

interface Draft {
  name: string; category_id: string; requested_category: string; price_inr: string; mrp_inr: string; stock: string; mto: boolean; made_to_order_days: string;
  summary: string; details: string; made_by: string; technique: string; materials: string; personalisable: boolean; occasions: string[]; status: "active" | "hidden";
}
const EMPTY: Draft = { name: "", category_id: "", requested_category: "", price_inr: "", mrp_inr: "", stock: "1", mto: false, made_to_order_days: "7", summary: "", details: "", made_by: "me", technique: "", materials: "", personalisable: false, occasions: [], status: "active" };

function ProductEditor({ id, onDone, onCancel }: { id?: number; onDone: () => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [cats, setCats] = useState<CategoryOpt[]>([]);
  const [photos, setPhotos] = useState<{ id: number; url: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [review, setReview] = useState<{ status: string; note: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    sellerApi<{ categories: CategoryOpt[] }>("categories").then((r) => setCats(r.categories)).catch(() => {});
    if (!id) return;
    sellerApi<{ product: Record<string, unknown>; images: { id: number; url: string }[] }>(`products/${id}`).then(({ product: p, images }) => {
      const s = (k: string) => (p[k] == null ? "" : String(p[k]));
      setD({
        name: s("name"), category_id: s("category_id"), requested_category: s("requested_category"), price_inr: s("price_inr"), mrp_inr: s("mrp_inr"), stock: s("stock"),
        mto: !!p.made_to_order_days, made_to_order_days: s("made_to_order_days") || "7", summary: s("summary"), details: s("details"), made_by: s("made_by") || "me",
        technique: s("technique"), materials: s("materials"), personalisable: !!p.personalisable, occasions: s("occasions").split(",").filter(Boolean), status: (s("status") as Draft["status"]) || "active",
      });
      setPhotos(images);
      setReview({ status: s("review_status"), note: s("review_note") });
    }).catch((e) => setErr(msg(e)));
  }, [id]);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD((x) => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  const otherId = cats.find((c) => c.slug === "other")?.id;
  const total = photos.length + files.length;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!id && files.length === 0) { setErr("Please add at least one photo"); return; }
    setErr(""); setBusy("Saving…");
    const body = {
      name: d.name, category_id: Number(d.category_id), requested_category: Number(d.category_id) === otherId ? d.requested_category : "",
      price_inr: Number(d.price_inr), mrp_inr: d.mrp_inr ? Number(d.mrp_inr) : null, stock: d.mto ? 0 : Number(d.stock || 0),
      made_to_order_days: d.mto ? Number(d.made_to_order_days) : null, summary: d.summary, details: d.details, made_by: d.made_by,
      technique: d.technique, materials: d.materials, personalisable: d.personalisable, occasions: d.occasions, status: d.status,
    };
    try {
      const pid = id ?? (await sellerApi<{ id: number }>("products", { body })).id;
      if (id) await sellerApi(`products/${id}`, { method: "PUT", body });
      for (let i = 0; i < files.length; i++) {
        setBusy(`Uploading photo ${i + 1} of ${files.length}…`);
        const fd = new FormData();
        fd.append("file", await compressImage(files[i]), "photo.webp");
        await sellerApi(`products/${pid}/images`, { form: fd });
      }
      onDone();
    } catch (x) { setErr(msg(x)); } finally { setBusy(""); }
  }

  async function removePhoto(imgId: number) {
    if (!id || !confirm("Remove this photo?")) return;
    try { await sellerApi(`products/${id}/images/${imgId}`, { method: "DELETE" }); setPhotos((p) => p.filter((x) => x.id !== imgId)); } catch (e) { setErr(msg(e)); }
  }
  async function del() {
    if (!id || !confirm("Delete this product for ever?")) return;
    try { await sellerApi(`products/${id}`, { method: "DELETE" }); onDone(); } catch (e) { setErr(msg(e)); }
  }

  return (
    <form className="sel-editor" onSubmit={save}>
      {review && review.status !== "approved" && review.note && <p className="sel-fix">✏️ Insi House: {review.note}</p>}
      <div className="sel-photos">
        {photos.map((p) => (
          <figure key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" />
            <button type="button" onClick={() => removePhoto(p.id)} aria-label="Remove photo">✕</button>
          </figure>
        ))}
        {files.map((f, i) => (
          <figure key={`${f.name}-${i}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(f)} alt="" />
            <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="Remove photo">✕</button>
          </figure>
        ))}
        {total < 8 && (
          <label className="sel-add-photo">
            <span>📷<br />Add photo</span>
            <input type="file" accept="image/*" multiple onChange={(e) => { const add = [...(e.target.files ?? [])].slice(0, 8 - total); setFiles((x) => [...x, ...add]); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <div className="form-grid">
        <label className="form-field wide">Product name<input required minLength={3} maxLength={120} value={d.name} onChange={set("name")} placeholder="e.g. Hand-embroidered cushion cover" /></label>
        <label className="form-field">Category
          <select required value={d.category_id} onChange={set("category_id")}><option value="">Choose…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        {Number(d.category_id) === otherId && (
          <label className="form-field">Which category should we add?<input maxLength={60} value={d.requested_category} onChange={set("requested_category")} placeholder="e.g. Crochet toys" /></label>
        )}
        <label className="form-field">Price (₹)<input required inputMode="numeric" value={d.price_inr} onChange={(e) => setD({ ...d, price_inr: e.target.value.replace(/\D/g, "") })} /></label>
        <label className="form-field">Price before discount (₹, optional)<input inputMode="numeric" value={d.mrp_inr} onChange={(e) => setD({ ...d, mrp_inr: e.target.value.replace(/\D/g, "") })} /></label>
        <label className="sel-check wide"><input type="checkbox" checked={d.mto} onChange={set("mto")} /> I make it after someone orders (made to order)</label>
        {d.mto
          ? <label className="form-field">Days to make it<input inputMode="numeric" value={d.made_to_order_days} onChange={(e) => setD({ ...d, made_to_order_days: e.target.value.replace(/\D/g, "") })} /></label>
          : <label className="form-field">How many do you have?<input inputMode="numeric" value={d.stock} onChange={(e) => setD({ ...d, stock: e.target.value.replace(/\D/g, "") })} /></label>}
        <label className="form-field wide">Describe it (what it is, why it is special)<textarea required maxLength={600} rows={3} value={d.summary} onChange={set("summary")} /></label>
      </div>
      <fieldset className="sel-radio">
        <legend>Who made it?</legend>
        {[["me", "I made it myself"], ["family", "My family made it"], ["group", "My group / self-help group made it"]].map(([v, l]) => (
          <label key={v}><input type="radio" name="made_by" value={v} checked={d.made_by === v} onChange={set("made_by")} /> {l}</label>
        ))}
      </fieldset>
      <div className="form-grid">
        <label className="form-field">Craft / technique<input maxLength={80} value={d.technique} onChange={set("technique")} placeholder="e.g. chikankari, block print, terracotta" /></label>
        <label className="form-field">Materials<input maxLength={200} value={d.materials} onChange={set("materials")} placeholder="e.g. cotton, silk thread" /></label>
        <label className="form-field wide">Size and other details (optional)<textarea maxLength={2000} rows={2} value={d.details} onChange={set("details")} placeholder="e.g. 40 × 40 cm, hand wash only" /></label>
      </div>
      <fieldset className="sel-radio">
        <legend>Good gift for (optional)</legend>
        <div className="chips" style={{ margin: 0 }}>
          {occasions.map((o) => (
            <button key={o.slug} type="button" className="chip small" aria-pressed={d.occasions.includes(o.slug)}
              onClick={() => setD((x) => ({ ...x, occasions: x.occasions.includes(o.slug) ? x.occasions.filter((s) => s !== o.slug) : [...x.occasions, o.slug] }))}>{o.name}</button>
          ))}
        </div>
      </fieldset>
      <label className="sel-check"><input type="checkbox" checked={d.personalisable} onChange={set("personalisable")} /> Can be personalised (a name or message)</label>
      {id && <label className="sel-check"><input type="checkbox" checked={d.status === "hidden"} onChange={(e) => setD({ ...d, status: e.target.checked ? "hidden" : "active" })} /> Hide from my shop for now</label>}
      {err && <p className="form-error">{err}</p>}
      <div className="row-btns">
        <button className="btn btn-glow" disabled={!!busy}>{busy || (id ? "Save changes" : "Save product")}</button>
        {onCancel && <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>}
        {id && <button type="button" className="link-btn danger" onClick={del}>Delete</button>}
      </div>
    </form>
  );
}

function ShopSettings({ shop, onSaved }: { shop: Shop; onSaved: () => void }) {
  const fields: (keyof Shop)[] = ["shop_name", "maker_name", "craft", "story", "district", "state", "show_photo", "full_name", "address", "pincode", "contact_phone",
    "upi_id", "bank_name", "bank_account", "bank_ifsc", "pan", "gst_type", "gst_id", "ship_fee", "dispatch_days", "holiday"];
  const { f, set } = useShopForm(shop, fields);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setNote("");
    try {
      await sellerApi("shop", { method: "PUT", body: { ...f, ship_fee: Number(f.ship_fee || 0), dispatch_days: Number(f.dispatch_days || 3), gst_id: f.gst_type === "none" ? "" : f.gst_id } });
      setNote("Saved ✓"); onSaved();
    } catch (x) { setErr(msg(x)); } finally { setBusy(false); }
  }
  async function photo(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", await compressImage(file, 800), "shop.webp");
    try { await sellerApi("shop/photo", { form: fd }); onSaved(); } catch (x) { setErr(msg(x)); }
  }
  return (
    <form className="form-card" onSubmit={save}>
      <div className="acct-row"><h2 className="acct-title">My shop</h2>
        <label className="btn btn-outline small">📷 {shop.photo ? "Change photo" : "Add shop photo"}<input type="file" accept="image/*" hidden onChange={(e) => photo(e.target.files?.[0])} /></label>
      </div>
      <p className="sel-note">👀 <b>Buyers see</b></p>
      <div className="form-grid">
        <label className="form-field">Shop name<input required value={String(f.shop_name)} onChange={set("shop_name")} maxLength={50} /></label>
        <label className="form-field">Your first name<input required value={String(f.maker_name)} onChange={set("maker_name")} maxLength={40} /></label>
        <label className="form-field">What you make<input value={String(f.craft)} onChange={set("craft")} maxLength={80} /></label>
        <label className="form-field">District / city<input required value={String(f.district)} onChange={set("district")} maxLength={60} /></label>
        <label className="form-field">State<select value={String(f.state)} onChange={set("state")}>{STATES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="sel-check"><input type="checkbox" checked={!!f.show_photo} onChange={set("show_photo")} /> Show my photo to buyers</label>
        <label className="form-field wide">Your story<textarea rows={3} value={String(f.story)} onChange={set("story")} maxLength={600} /></label>
      </div>
      <p className="sel-note private">🔒 <b>Private: only Insi House sees this</b></p>
      <div className="form-grid">
        <label className="form-field">Full name<input required value={String(f.full_name)} onChange={set("full_name")} maxLength={100} /></label>
        <label className="form-field">Contact mobile<input inputMode="numeric" value={String(f.contact_phone)} onChange={set("contact_phone")} maxLength={13} /></label>
        <label className="form-field wide">Pickup address<textarea rows={2} required value={String(f.address)} onChange={set("address")} maxLength={400} /></label>
        <label className="form-field">PIN code<input required inputMode="numeric" value={String(f.pincode)} onChange={set("pincode")} maxLength={6} /></label>
        <label className="form-field">UPI ID<input required value={String(f.upi_id)} onChange={set("upi_id")} maxLength={80} /></label>
        <label className="form-field">Bank name<input value={String(f.bank_name)} onChange={set("bank_name")} maxLength={80} /></label>
        <label className="form-field">Account number<input inputMode="numeric" value={String(f.bank_account)} onChange={set("bank_account")} maxLength={20} /></label>
        <label className="form-field">IFSC<input value={String(f.bank_ifsc)} onChange={set("bank_ifsc")} maxLength={11} /></label>
        <label className="form-field">PAN (optional)<input value={String(f.pan)} onChange={set("pan")} maxLength={10} /></label>
        <label className="form-field">GST<select value={String(f.gst_type || "none")} onChange={set("gst_type")}><option value="none">No GST (optional)</option><option value="gstin">GSTIN</option><option value="enrolment">Enrolment ID</option></select></label>
        {f.gst_type && f.gst_type !== "none" && <label className="form-field">GST number<input value={String(f.gst_id)} onChange={set("gst_id")} maxLength={15} /></label>}
      </div>
      <p className="sel-note">🚚 <b>Delivery</b> (used when orders open)</p>
      <div className="form-grid">
        <label className="form-field">Delivery charge per order (₹, 0 = free)<input inputMode="numeric" value={String(f.ship_fee)} onChange={set("ship_fee")} /></label>
        <label className="form-field">Days to dispatch<input inputMode="numeric" value={String(f.dispatch_days)} onChange={set("dispatch_days")} /></label>
        <label className="sel-check"><input type="checkbox" checked={!!f.holiday} onChange={set("holiday")} /> I&apos;m on a break (holiday mode)</label>
      </div>
      {err && <p className="form-error">{err}</p>}
      {note && <p className="ok-note">{note}</p>}
      <button className="btn btn-glow" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
    </form>
  );
}

function Help() {
  return (
    <section className="form-card">
      <h2 className="acct-title">Help</h2>
      <ul className="sel-help">
        <li><b>Only handmade.</b> Everything you sell must be made by hand by you, your family or your group. Factory-made or resold items are removed.</li>
        <li><b>Good photos sell.</b> Daylight, plain background, 2–3 photos from different sides.</li>
        <li><b>Your privacy.</b> Buyers never see your phone number or address. Insi House contacts you if needed.</li>
        <li><b>0% commission.</b> Insi House takes nothing from your sales while we grow together.</li>
        <li><b>New categories.</b> Can&apos;t find the right one? Choose &ldquo;Other handmade&rdquo; and write the category you need. We&apos;ll add it.</li>
      </ul>
      <a className="btn btn-glow" href={whatsappLink("Hello Insi House! I need help with my seller shop.")} target="_blank" rel="noopener noreferrer">💬 Ask us on WhatsApp</a>
    </section>
  );
}

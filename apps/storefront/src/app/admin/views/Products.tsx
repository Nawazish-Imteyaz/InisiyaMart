"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ARTS, BADGES, COLLECTIONS, OCCASIONS, rupees, TONES, uploadPhoto, when } from "../lib";
import { go, useAdmin } from "../AdminApp";
import { ColorDots, Empty, ErrorBox, Field, Loading, PageHead, useLoad } from "./ui";

interface Row {
  id: number; slug: string; name: string; price_inr: number | null; mrp_inr: number | null; stock: number; track_stock: number;
  status: "active" | "hidden" | "draft"; category_name: string | null; category_id: number | null; image_key: string | null;
  image_count: number; tone: string; updated_at: string;
}
interface Cat { id: number; name: string }

const STATUS_LABEL = { active: "On website", hidden: "Hidden", draft: "Draft" } as const;

// ============================ List ============================
export function ProductList() {
  const { toast, fail } = useAdmin();
  const { data, error, reload, setData } = useLoad(() => Promise.all([api<{ products: Row[] }>("products"), api<{ categories: Cat[] }>("categories")]));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [show, setShow] = useState("all");

  const rows = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data[0].products.filter((p) =>
      (!s || p.name.toLowerCase().includes(s)) &&
      (cat === "all" || String(p.category_id) === cat) &&
      (show === "all" ||
        (show === "out" && p.track_stock && p.stock <= 0) ||
        (show === "low" && p.track_stock && p.stock > 0 && p.stock <= 3) ||
        (show === p.status)),
    );
  }, [data, q, cat, show]);

  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;

  async function patch(p: Row, body: Partial<Row>, msg: string) {
    try {
      await api(`products/${p.id}`, { method: "PUT", body });
      setData((d) => (d ? [{ products: d[0].products.map((x) => (x.id === p.id ? { ...x, ...body } : x)) }, d[1]] : d));
      toast(msg);
    } catch (e) { fail(e); }
  }

  return (
    <>
      <PageHead
        title="Products"
        sub={`${data[0].products.length} products`}
        actions={<a className="adm-btn primary" href="#/products/new">+ Add product</a>}
      />
      <div className="adm-filters">
        <input type="search" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {data[1].categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show">
          <option value="all">All products</option>
          <option value="active">On website</option>
          <option value="hidden">Hidden</option>
          <option value="draft">Drafts</option>
          <option value="out">Out of stock</option>
          <option value="low">Running low (1–3)</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty>No products match. <a href="#/products/new">Add a product</a></Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a className="adm-prod" href={`#/products/${p.id}`}>
                      <span className="adm-thumb" style={{ background: TONES.find((t) => t.value === p.tone)?.css }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.image_key && <img src={`/img/${p.image_key}`} alt="" loading="lazy" />}
                      </span>
                      <span><b>{p.name}</b><small>{p.category_name ?? "No category"} · {p.image_count} photo{p.image_count === 1 ? "" : "s"}</small></span>
                    </a>
                  </td>
                  <td>{p.price_inr === null ? <span className="adm-muted">On request</span> : rupees(p.price_inr)}</td>
                  <td>
                    {p.track_stock ? (
                      <StockEditor value={p.stock} onSave={(n) => patch(p, { stock: n }, `${p.name}: stock ${n}`)} />
                    ) : (
                      <span className="adm-muted">Made to order</span>
                    )}
                  </td>
                  <td>
                    <select
                      className={`adm-select-status s-${p.status}`}
                      value={p.status}
                      aria-label={`Status of ${p.name}`}
                      onChange={(e) => patch(p, { status: e.target.value as Row["status"] }, `${p.name}: ${STATUS_LABEL[e.target.value as Row["status"]]}`)}
                    >
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="adm-right"><a className="adm-btn small" href={`#/products/${p.id}`}>Edit</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StockEditor({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const n = Number(v);
  const dirty = v !== String(value) && Number.isInteger(n) && n >= 0;
  return (
    <span className="adm-stock-edit">
      <button type="button" className="adm-btn small" aria-label="One less" onClick={() => value > 0 && onSave(value - 1)}>−</button>
      <input inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ""))} onKeyDown={(e) => e.key === "Enter" && dirty && onSave(n)} aria-label="Stock" className={value <= 0 ? "out" : value <= 3 ? "low" : ""} />
      <button type="button" className="adm-btn small" aria-label="One more" onClick={() => onSave(value + 1)}>+</button>
      {dirty && <button type="button" className="adm-btn small primary" onClick={() => onSave(n)}>Save</button>}
    </span>
  );
}

// ============================ Edit / create ============================
interface Form {
  name: string; slug: string; category_id: string; collection: string; badge: string; summary: string; details: string;
  price_inr: string; mrp_inr: string; stock: string; track_stock: boolean; status: Row["status"]; personalisable: boolean;
  occasions: string[]; tone: string; art: string; sort: string;
}
interface Img { id: number; url: string }

const emptyForm: Form = {
  name: "", slug: "", category_id: "", collection: "", badge: "Handmade", summary: "", details: "", price_inr: "", mrp_inr: "",
  stock: "1", track_stock: true, status: "active", personalisable: false, occasions: [], tone: "rose", art: "gift", sort: "0",
};

export function ProductEdit({ id }: { id: number | null }) {
  const { toast, fail } = useAdmin();
  const [form, setForm] = useState<Form | null>(id ? null : emptyForm);
  const [images, setImages] = useState<Img[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [meta, setMeta] = useState<{ slug: string; updated_at: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ categories: Cat[] }>("categories").then((r) => setCats(r.categories)).catch(fail);
    if (!id) return;
    api<{ product: Record<string, unknown>; images: Img[] }>(`products/${id}`)
      .then(({ product: p, images }) => {
        const s = (k: string) => (p[k] === null || p[k] === undefined ? "" : String(p[k]));
        setForm({
          name: s("name"), slug: s("slug"), category_id: s("category_id"), collection: s("collection"), badge: s("badge") || "Handmade",
          summary: s("summary"), details: s("details"), price_inr: s("price_inr"), mrp_inr: s("mrp_inr"), stock: s("stock") || "0",
          track_stock: !!p.track_stock, status: (s("status") || "active") as Row["status"], personalisable: !!p.personalisable,
          occasions: s("occasions").split(",").filter(Boolean), tone: s("tone") || "rose", art: s("art") || "gift", sort: s("sort") || "0",
        });
        setMeta({ slug: s("slug"), updated_at: s("updated_at") });
        setImages(images);
      })
      .catch(fail);
  }, [id, fail]);

  if (!form) return <Loading />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const body = {
      ...form,
      category_id: form.category_id || null,
      price_inr: form.price_inr.trim() === "" ? null : form.price_inr,
      mrp_inr: form.mrp_inr.trim() === "" ? null : form.mrp_inr,
      stock: form.stock || "0",
      slug: id ? form.slug : "",
    };
    try {
      if (id) {
        const r = await api<{ slug: string }>(`products/${id}`, { method: "PUT", body });
        set("slug", r.slug);
        toast("Saved. The website will update in a few minutes.");
      } else {
        const r = await api<{ id: number }>("products", { body });
        toast("Product created. Now add photos.");
        go(`/products/${r.id}`);
      }
    } catch (err) { fail(err); } finally { setSaving(false); }
  }

  async function upload(files: FileList | null) {
    if (!files || !id) return;
    const list = [...files].slice(0, 12 - images.length);
    setUploading(list.length);
    for (const f of list) {
      try {
        const r = await uploadPhoto(`products/${id}/images`, f);
        const added = r as unknown as { id: number; url: string };
        setImages((im) => [...im, { id: added.id, url: added.url }]);
      } catch (err) { fail(err); }
      setUploading((n) => n - 1);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeImage(img: Img) {
    if (!confirm("Remove this photo?")) return;
    try {
      await api(`images/${img.id}`, { method: "DELETE" });
      setImages((im) => im.filter((x) => x.id !== img.id));
      toast("Photo removed");
    } catch (err) { fail(err); }
  }

  async function makeMain(img: Img) {
    const order = [img, ...images.filter((x) => x.id !== img.id)];
    setImages(order);
    try { await api(`products/${id}/images`, { method: "PUT", body: { order: order.map((x) => x.id) } }); toast("Main photo changed"); } catch (err) { fail(err); }
  }

  async function remove() {
    if (!id || !form) return;
    if (!confirm(`Delete "${form.name}" for ever? Its photos will be deleted too.\n\nTip: choose "Hidden" instead if you may sell it again.`)) return;
    try {
      await api(`products/${id}`, { method: "DELETE" });
      toast("Product deleted");
      go("/products");
    } catch (err) { fail(err); }
  }

  return (
    <form onSubmit={save}>
      <PageHead
        title={id ? form.name || "Edit product" : "Add product"}
        sub={id && meta ? `Last changed ${when(meta.updated_at)} · Link: /product/${form.slug}/` : "Fill in the details, save, then add photos."}
        actions={<>
          <a className="adm-btn" href="#/products">← Back</a>
          {id && form.status === "active" && <a className="adm-btn" href={`/product/${form.slug}/`} target="_blank" rel="noopener noreferrer">View on website ↗</a>}
          <button className="adm-btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </>}
      />

      <div className="adm-edit">
        <div className="adm-edit-main">
          <section className="adm-card">
            <h2>Details</h2>
            <div className="adm-grid">
              <Field label="Product name *" wide><input required maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Etched black pottery vase" /></Field>
              <Field label="Short description" hint="1–2 lines shown under the name." wide>
                <textarea rows={3} maxLength={600} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
              </Field>
              <Field label="Size & materials" hint="Size, weight, material, care. One item per line." wide>
                <textarea rows={4} maxLength={4000} value={form.details} onChange={(e) => set("details", e.target.value)} placeholder={"Height: 25 cm\nMaterial: Nizamabad black clay\nCare: wipe with a dry cloth"} />
              </Field>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-head">
              <h2>Photos {images.length > 0 && <small className="adm-muted">({images.length}/12)</small>}</h2>
              {id && images.length < 12 && (
                <button type="button" className="adm-btn" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
                  {uploading > 0 ? `Uploading ${uploading}…` : "+ Upload photos"}
                </button>
              )}
            </div>
            {!id ? (
              <p className="adm-muted">Save the product first, then you can upload photos.</p>
            ) : (
              <>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
                {images.length === 0 ? (
                  <button type="button" className="adm-drop" onClick={() => fileRef.current?.click()}>
                    <b>Tap to upload photos</b>
                    <span>JPG or PNG from your phone or camera. We resize them automatically. The first photo is the main one.</span>
                  </button>
                ) : (
                  <div className="adm-photos">
                    {images.map((img, i) => (
                      <figure key={img.id} className={i === 0 ? "main" : ""}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={`Photo ${i + 1}`} />
                        <figcaption>
                          {i === 0 ? <span className="adm-tag">Main</span> : <button type="button" className="adm-btn small" onClick={() => makeMain(img)}>Make main</button>}
                          <button type="button" className="adm-btn small danger" onClick={() => removeImage(img)}>Remove</button>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <div className="adm-edit-side">
          <section className="adm-card">
            <h2>Price & stock</h2>
            <div className="adm-grid">
              <Field label="Selling price (₹)" hint="Including GST. Leave empty for “Price on request”.">
                <input inputMode="numeric" value={form.price_inr} onChange={(e) => set("price_inr", e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 1499" />
              </Field>
              <Field label="MRP (₹), optional" hint="Shows a crossed-out price if higher.">
                <input inputMode="numeric" value={form.mrp_inr} onChange={(e) => set("mrp_inr", e.target.value.replace(/[^0-9]/g, ""))} />
              </Field>
              <label className="adm-check wide">
                <input type="checkbox" checked={form.track_stock} onChange={(e) => set("track_stock", e.target.checked)} />
                <span>Count stock <small>Untick for made-to-order items that never run out.</small></span>
              </label>
              {form.track_stock && (
                <Field label="Pieces in stock" hint="0 = shows “Out of stock” on the website.">
                  <input inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
              )}
            </div>
          </section>

          <section className="adm-card">
            <h2>Show on website</h2>
            <div className="adm-grid">
              <Field label="Status" wide>
                <select value={form.status} onChange={(e) => set("status", e.target.value as Row["status"])}>
                  <option value="active">On website</option>
                  <option value="hidden">Hidden (not on website)</option>
                  <option value="draft">Draft (still working on it)</option>
                </select>
              </Field>
              <Field label="Category" wide>
                <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                  <option value="">— Choose —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Collection">
                <select value={form.collection} onChange={(e) => set("collection", e.target.value)}>
                  {COLLECTIONS.map((c) => <option key={c} value={c}>{c || "None"}</option>)}
                </select>
              </Field>
              <Field label="Label on photo">
                <select value={form.badge} onChange={(e) => set("badge", e.target.value)}>
                  {BADGES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <label className="adm-check wide">
                <input type="checkbox" checked={form.personalisable} onChange={(e) => set("personalisable", e.target.checked)} />
                <span>Can be personalised <small>Shows “Add a name” on the product page.</small></span>
              </label>
              <fieldset className="adm-fieldset wide">
                <legend>Occasions</legend>
                <div className="adm-chips">
                  {OCCASIONS.map((o) => (
                    <label key={o} className={`adm-chip${form.occasions.includes(o) ? " on" : ""}`}>
                      <input type="checkbox" checked={form.occasions.includes(o)} onChange={(e) => set("occasions", e.target.checked ? [...form.occasions, o] : form.occasions.filter((x) => x !== o))} />
                      {o}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          <section className="adm-card">
            <h2>Look without photos</h2>
            <p className="adm-muted">Used until you upload a photo.</p>
            <div className="adm-grid">
              <Field label="Card colour" wide><ColorDots name="Card colour" options={TONES} value={form.tone as (typeof TONES)[number]["value"]} onChange={(v) => set("tone", v)} /></Field>
              <Field label="Drawing">
                <select value={form.art} onChange={(e) => set("art", e.target.value)}>
                  {ARTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </Field>
              <Field label="Order in lists" hint="Smaller numbers show first.">
                <input inputMode="numeric" value={form.sort} onChange={(e) => set("sort", e.target.value.replace(/[^0-9]/g, ""))} />
              </Field>
            </div>
          </section>

          {id && (
            <section className="adm-card danger-zone">
              <h2>Delete</h2>
              <p className="adm-muted">Deleting removes the product and its photos for ever.</p>
              <button type="button" className="adm-btn danger" onClick={remove}>Delete product</button>
            </section>
          )}
        </div>
      </div>
      <div className="adm-savebar">
        <button className="adm-btn primary block" disabled={saving}>{saving ? "Saving…" : id ? "Save changes" : "Create product"}</button>
      </div>
    </form>
  );
}

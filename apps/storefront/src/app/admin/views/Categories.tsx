"use client";

import { useRef, useState } from "react";
import { api, ARTS, COLORS, uploadPhoto } from "../lib";
import { useAdmin } from "../AdminApp";
import { ColorDots, Empty, ErrorBox, Field, Loading, PageHead, useLoad } from "./ui";

type Color = (typeof COLORS)[number]["value"];
interface Cat {
  id: number; slug: string; name: string; sub: string; art: string; color: Color; image_key: string | null;
  sort: number; visible: number; product_count: number;
}
type Draft = { name: string; sub: string; art: string; color: Color; sort: string; visible: boolean };

const blank: Draft = { name: "", sub: "", art: "gift", color: "plum", sort: "0", visible: true };

export function Categories() {
  const { toast, fail } = useAdmin();
  const { data, error, reload } = useLoad(() => api<{ categories: Cat[] }>("categories"));
  const [editing, setEditing] = useState<number | "new" | null>(null);

  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;

  async function remove(c: Cat) {
    if (c.product_count > 0) {
      toast(`"${c.name}" still has ${c.product_count} product(s). Move them to another category first.`, "err");
      return;
    }
    if (!confirm(`Delete the category "${c.name}"?`)) return;
    try {
      await api(`categories/${c.id}`, { method: "DELETE" });
      toast("Category deleted");
      reload();
    } catch (e) { fail(e); }
  }

  return (
    <>
      <PageHead
        title="Categories"
        sub="Shown as big colourful tiles on the home page, in the menu and as filters in the shop."
        actions={editing !== "new" && <button className="adm-btn primary" onClick={() => setEditing("new")}>+ Add category</button>}
      />
      {editing === "new" && (
        <CategoryForm initial={blank} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
      {data.categories.length === 0 ? (
        <Empty>No categories yet. Add your first one, e.g. “Black Pottery”.</Empty>
      ) : (
        <div className="adm-cat-grid">
          {data.categories.map((c) =>
            editing === c.id ? (
              <CategoryForm
                key={c.id}
                cat={c}
                initial={{ name: c.name, sub: c.sub, art: c.art, color: c.color, sort: String(c.sort), visible: !!c.visible }}
                onCancel={() => setEditing(null)}
                onSaved={() => { setEditing(null); reload(); }}
              />
            ) : (
              <article key={c.id} className="adm-cat">
                <div
                  className="adm-cat-tile"
                  style={{ background: c.image_key ? `linear-gradient(180deg,transparent 30%,rgba(43,27,34,.75)),url(/img/${c.image_key}) center/cover` : COLORS.find((x) => x.value === c.color)?.css }}
                >
                  <b>{c.name}</b>
                  <span>{c.sub}</span>
                </div>
                <div className="adm-cat-body">
                  <span className="adm-muted">{c.product_count} product{c.product_count === 1 ? "" : "s"} · {c.visible ? "Visible" : "Hidden"} · order {c.sort}</span>
                  <div className="adm-row">
                    <button className="adm-btn small" onClick={() => setEditing(c.id)}>Edit</button>
                    <a className="adm-btn small" href={`/shop/?c=${c.slug}`} target="_blank" rel="noopener noreferrer">View ↗</a>
                    <button className="adm-btn small danger" onClick={() => remove(c)}>Delete</button>
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </>
  );
}

function CategoryForm({ cat, initial, onCancel, onSaved }: { cat?: Cat; initial: Draft; onCancel: () => void; onSaved: () => void }) {
  const { toast, fail } = useAdmin();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(cat?.image_key ? `/img/${cat.image_key}` : null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (cat) await api(`categories/${cat.id}`, { method: "PUT", body: d });
      else await api("categories", { body: d });
      toast(cat ? "Category saved" : "Category added");
      onSaved();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  async function upload(files: FileList | null) {
    if (!files?.[0] || !cat) return;
    setBusy(true);
    try {
      const r = await uploadPhoto(`categories/${cat.id}/image`, files[0]);
      setImage(r.image ?? null);
      toast("Tile photo updated");
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  async function removeImage() {
    if (!cat) return;
    try {
      await api(`categories/${cat.id}/image`, { method: "DELETE" });
      setImage(null);
      toast("Tile photo removed");
    } catch (err) { fail(err); }
  }

  return (
    <form className="adm-card adm-cat-form" onSubmit={save}>
      <h2>{cat ? `Edit “${cat.name}”` : "New category"}</h2>
      <div className="adm-grid">
        <Field label="Name *"><input required maxLength={60} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Black Pottery" /></Field>
        <Field label="Small line under the name"><input maxLength={80} value={d.sub} onChange={(e) => set("sub", e.target.value)} placeholder="e.g. Nizamabad craft" /></Field>
        <Field label="Tile colour" wide><ColorDots name="Tile colour" options={COLORS} value={d.color} onChange={(v) => set("color", v)} /></Field>
        <Field label="Drawing (when no photo)">
          <select value={d.art} onChange={(e) => set("art", e.target.value)}>
            {ARTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Field>
        <Field label="Order" hint="Smaller numbers show first."><input inputMode="numeric" value={d.sort} onChange={(e) => set("sort", e.target.value.replace(/[^0-9]/g, ""))} /></Field>
        <label className="adm-check wide">
          <input type="checkbox" checked={d.visible} onChange={(e) => set("visible", e.target.checked)} />
          <span>Show on website</span>
        </label>
        {cat && (
          <div className="adm-field wide">
            <span>Tile photo (optional)</span>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files)} />
            <div className="adm-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {image && <img src={image} alt="" className="adm-cat-photo" />}
              <button type="button" className="adm-btn small" onClick={() => fileRef.current?.click()} disabled={busy}>{image ? "Change photo" : "Upload photo"}</button>
              {image && <button type="button" className="adm-btn small danger" onClick={removeImage}>Remove</button>}
            </div>
          </div>
        )}
      </div>
      <div className="adm-row end">
        <button type="button" className="adm-btn" onClick={onCancel}>Cancel</button>
        <button className="adm-btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

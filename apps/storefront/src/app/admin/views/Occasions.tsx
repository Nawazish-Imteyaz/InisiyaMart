"use client";

import { useRef, useState } from "react";
import { api, COLORS, uploadPhoto } from "../lib";
import { useAdmin } from "../AdminApp";
import { ColorDots, Empty, ErrorBox, Field, Loading, PageHead, useLoad } from "./ui";

interface Occ {
  id: number; slug: string; name: string; urdu: string; blurb: string; color: string; grp: "wedding" | "festival" | "celebration";
  image_key: string | null; sort: number; visible: number; product_count: number;
}
type Color = (typeof COLORS)[number]["value"];
const GROUPS = [
  { v: "wedding", label: "Wedding (haldi, mehndi, nikah…)" },
  { v: "celebration", label: "Celebration (birthday, anniversary…)" },
  { v: "festival", label: "Festival (Eid, Diwali, Rakhi…)" },
] as const;
const blank = { name: "", urdu: "", blurb: "", color: "rani" as Color, grp: "celebration" as Occ["grp"], sort: "0", visible: true };

export function Occasions() {
  const { toast, fail, user } = useAdmin();
  const { data, error, reload } = useLoad(() => api<{ occasions: Occ[] }>("occasions"));
  const [edit, setEdit] = useState<(typeof blank & { id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const [photoFor, setPhotoFor] = useState<number | null>(null);

  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      await api(edit.id ? `occasions/${edit.id}` : "occasions", { method: edit.id ? "PUT" : "POST", body: edit });
      toast(edit.id ? "Occasion saved" : "Occasion added. The website will update in a few minutes.");
      setEdit(null);
      reload();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function toggle(o: Occ) {
    try { await api(`occasions/${o.id}`, { method: "PUT", body: { ...o, visible: !o.visible } }); toast(o.visible ? `${o.name} hidden from the website` : `${o.name} shown on the website`); reload(); } catch (e) { fail(e); }
  }
  async function remove(o: Occ) {
    if (!confirm(`Delete “${o.name}”? It will be removed from ${o.product_count} product(s). The products stay.`)) return;
    try { await api(`occasions/${o.id}`, { method: "DELETE" }); toast("Occasion deleted"); reload(); } catch (e) { fail(e); }
  }
  async function photo(f: File | undefined) {
    if (!f || !photoFor) return;
    try { await uploadPhoto(`occasions/${photoFor}/image`, f); toast("Photo uploaded"); reload(); } catch (e) { fail(e); } finally { setPhotoFor(null); if (file.current) file.current.value = ""; }
  }

  const list = data.occasions.filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase()));
  const css = (c: string) => COLORS.find((x) => x.value === c)?.css ?? COLORS[0].css;

  return (
    <>
      <PageHead
        title="Occasions"
        sub="Haldi, mehndi, birthday, Eid… Each one gets its own page on the website. Tick occasions on each product to show it there."
        actions={<>
          <span className="adm-count">{data.occasions.length} occasions</span>
          <button className="adm-btn primary" onClick={() => setEdit({ ...blank })}>+ Add occasion</button>
        </>}
      />
      <input type="file" accept="image/*" hidden ref={file} onChange={(e) => photo(e.target.files?.[0])} />
      {edit && (
        <form className="adm-card" onSubmit={save}>
          <h2>{edit.id ? `Edit ${edit.name}` : "New occasion"}</h2>
          <div className="adm-grid">
            <Field label="Name *"><input required maxLength={60} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Haldi" /></Field>
            <Field label="Urdu name (optional)" hint="Shown in beautiful Nastaliq on the tile."><input dir="rtl" lang="ur" maxLength={40} value={edit.urdu} onChange={(e) => setEdit({ ...edit, urdu: e.target.value })} /></Field>
            <Field label="Group"><select value={edit.grp} onChange={(e) => setEdit({ ...edit, grp: e.target.value as Occ["grp"] })}>{GROUPS.map((g) => <option key={g.v} value={g.v}>{g.label}</option>)}</select></Field>
            <Field label="Order" hint="Smaller numbers show first."><input inputMode="numeric" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label="Short line" wide hint="One sentence under the title on the occasion page."><input maxLength={200} value={edit.blurb} onChange={(e) => setEdit({ ...edit, blurb: e.target.value })} /></Field>
            <div className="adm-field wide"><span>Colour</span><ColorDots name="Colour" options={COLORS} value={edit.color} onChange={(v) => setEdit({ ...edit, color: v })} /></div>
            <label className="adm-check wide"><input type="checkbox" checked={edit.visible} onChange={(e) => setEdit({ ...edit, visible: e.target.checked })} /><span>Show on the website</span></label>
          </div>
          <div className="adm-row end">
            <button type="button" className="adm-btn" onClick={() => setEdit(null)}>Cancel</button>
            <button className="adm-btn primary" disabled={busy}>{busy ? "Saving…" : "Save occasion"}</button>
          </div>
        </form>
      )}
      <div className="adm-toolbar"><input type="search" placeholder="Search occasions…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.length === 0 ? <Empty>No occasions yet.</Empty> : (
        <div className="adm-cat-grid">
          {list.map((o) => (
            <div key={o.id} className={`adm-cat${o.visible ? "" : " off"}`}>
              <div className="adm-cat-tile" style={{ background: o.image_key ? `linear-gradient(180deg, transparent 30%, rgba(43,27,34,.75)), url(/img/${o.image_key}) center/cover` : css(o.color) }}>
                {o.urdu && <span className="urdu adm-cat-urdu" lang="ur" dir="rtl">{o.urdu}</span>}
                <b>{o.name}</b>
                <span>{GROUPS.find((g) => g.v === o.grp)?.label.split(" (")[0]} · {o.product_count} product{o.product_count === 1 ? "" : "s"}</span>
              </div>
              <div className="adm-cat-body">
                {o.blurb && <span className="adm-muted">{o.blurb}</span>}
                <div className="adm-row wrap">
                  <button className="adm-btn small" onClick={() => setEdit({ id: o.id, name: o.name, urdu: o.urdu, blurb: o.blurb, color: o.color as Color, grp: o.grp, sort: String(o.sort), visible: !!o.visible })}>Edit</button>
                  <button className="adm-btn small" onClick={() => { setPhotoFor(o.id); file.current?.click(); }}>{o.image_key ? "Change photo" : "Add photo"}</button>
                  <button className="adm-btn small" onClick={() => toggle(o)}>{o.visible ? "Hide" : "Show"}</button>
                  <a className="adm-btn small ghost" href={`/occasion/${o.slug}/`} target="_blank" rel="noopener noreferrer">View ↗</a>
                  {user.role === "owner" && <button className="adm-btn small danger" onClick={() => remove(o)}>Delete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

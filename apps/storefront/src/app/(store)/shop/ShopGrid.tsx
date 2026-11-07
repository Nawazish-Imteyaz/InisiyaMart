"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category, Occasion, Product } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";

const PRICES = [
  { v: "", label: "Any price" },
  { v: "0-999", label: "Under ₹999" },
  { v: "1000-2499", label: "₹1,000 – ₹2,499" },
  { v: "2500-4999", label: "₹2,500 – ₹4,999" },
  { v: "5000-", label: "₹5,000 & above" },
];
const SORTS = [
  { v: "", label: "Recommended" },
  { v: "new", label: "Newest first" },
  { v: "low", label: "Price: low to high" },
  { v: "high", label: "Price: high to low" },
];

interface F { c: string; o: string; q: string; price: string; sort: string; stock: boolean; pers: boolean }
const EMPTY: F = { c: "", o: "", q: "", price: "", sort: "", stock: false, pers: false };

export function ShopGrid({ products: built, categories: builtCats, occasions }: { products: Product[]; categories: Category[]; occasions: Occasion[] }) {
  // Start with the catalogue built into the page, then switch to the live one (new makers' products appear at once).
  const [products, setProducts] = useState(built);
  const [categories, setCategories] = useState(builtCats);
  useEffect(() => {
    fetch("/api/catalog", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.source === "live") { setProducts(d.products); if (d.categories?.length) setCategories(d.categories); } }).catch(() => {});
  }, []);
  const [f, setF] = useState<F>(EMPTY);

  // Filters live in the link (?c=, ?o=, ?q=, ?price=, ?sort=), so a filtered page can be shared on WhatsApp.
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    setF({ c: u.get("c") ?? "", o: u.get("o") ?? "", q: u.get("q") ?? "", price: u.get("price") ?? "", sort: u.get("sort") ?? "", stock: u.get("stock") === "1", pers: u.get("pers") === "1" });
  }, []);

  function update(patch: Partial<F>) {
    const next = { ...f, ...patch };
    setF(next);
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(next)) {
      const val = typeof v === "boolean" ? (v ? "1" : "") : v;
      if (val) url.searchParams.set(k === "pers" ? "pers" : k, val); else url.searchParams.delete(k);
    }
    window.history.replaceState(null, "", url);
  }

  const shown = useMemo(() => {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const occName = new Map(occasions.map((o) => [o.slug, o.name.toLowerCase()]));
    const [lo, hi] = f.price ? f.price.split("-").map((x) => (x === "" ? null : Number(x))) : [null, null];
    let list = products.filter((p) => {
      if (f.c && p.category !== f.c) return false;
      if (f.o && !p.occasions.includes(f.o)) return false;
      if (f.stock && !p.inStock) return false;
      if (f.pers && !p.personalisable) return false;
      if (f.price) {
        if (p.priceInr === null) return false;
        if (lo !== null && p.priceInr < lo) return false;
        if (hi !== null && hi !== undefined && p.priceInr > hi) return false;
      }
      if (words.length) {
        const hay = [p.name, p.craft, p.summary, p.collection, p.technique ?? "", p.maker?.shop ?? "", p.maker?.district ?? "", p.maker?.state ?? "", ...p.occasions.map((o) => occName.get(o) ?? o)].join(" ").toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const price = (p: Product) => p.priceInr ?? Number.POSITIVE_INFINITY;
    if (f.sort === "low") list = [...list].sort((a, b) => price(a) - price(b));
    if (f.sort === "high") list = [...list].sort((a, b) => (b.priceInr ?? -1) - (a.priceInr ?? -1));
    if (f.sort === "new") list = [...list].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    // In-stock gifts first, without changing the order otherwise.
    return [...list.filter((p) => p.inStock), ...list.filter((p) => !p.inStock)];
  }, [f, products, occasions]);

  const usedCats = categories.filter((c) => products.some((p) => p.category === c.slug));
  const usedOcc = occasions.filter((o) => products.some((p) => p.occasions.includes(o.slug)));
  const active = [f.c, f.o, f.q, f.price].filter(Boolean).length + (f.stock ? 1 : 0) + (f.pers ? 1 : 0);

  return (
    <>
      {f.q && (
        <p className="search-note">Results for <b>“{f.q}”</b> <button type="button" className="link-btn" onClick={() => update({ q: "" })}>clear</button></p>
      )}
      <div className="chips scroll-x" role="group" aria-label="Filter by category">
        <button type="button" className="chip" aria-pressed={!f.c} onClick={() => update({ c: "" })}>All</button>
        {usedCats.map((c) => (
          <button key={c.slug} type="button" className="chip" aria-pressed={f.c === c.slug} onClick={() => update({ c: f.c === c.slug ? "" : c.slug })}>{c.name}</button>
        ))}
      </div>
      {usedOcc.length > 0 && (
        <div className="chips scroll-x occ-chips" role="group" aria-label="Filter by occasion">
          {usedOcc.map((o) => (
            <button key={o.slug} type="button" className={`chip occ k-${o.color}`} aria-pressed={f.o === o.slug} onClick={() => update({ o: f.o === o.slug ? "" : o.slug })}>{o.name}</button>
          ))}
        </div>
      )}

      <div className="shop-bar" role="group" aria-label="Sort and filter">
        <span className="shop-count" aria-live="polite">{shown.length} {shown.length === 1 ? "gift" : "gifts"}</span>
        <label className="bar-select"><span className="sr-only">Sort</span>
          <select value={f.sort} onChange={(e) => update({ sort: e.target.value })}>{SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select>
        </label>
        <label className="bar-select"><span className="sr-only">Price</span>
          <select value={f.price} onChange={(e) => update({ price: e.target.value })}>{PRICES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select>
        </label>
        <button type="button" className="chip small" aria-pressed={f.stock} onClick={() => update({ stock: !f.stock })}>In stock</button>
        <button type="button" className="chip small" aria-pressed={f.pers} onClick={() => update({ pers: !f.pers })}>Personalised</button>
        {active > 0 && <button type="button" className="link-btn" onClick={() => update(EMPTY)}>Clear all</button>}
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <b>No gifts match these filters.</b>
          <span className="muted">Try clearing a filter, or tell us what you have in mind and we&apos;ll make it by hand.</span>
          <div className="row-btns" style={{ justifyContent: "center" }}>
            <button type="button" className="btn btn-outline" onClick={() => update(EMPTY)}>Clear filters</button>
            <a className="btn btn-glow" href="/events/">Ask for a custom gift</a>
          </div>
        </div>
      ) : (
        <div className="grid">
          {shown.map((p) => <ProductCard key={p.slug} p={p} />)}
        </div>
      )}
    </>
  );
}

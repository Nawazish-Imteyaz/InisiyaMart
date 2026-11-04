"use client";

import { useEffect, useState } from "react";
import type { Category, Product } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";

export function ShopGrid({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [cat, setCat] = useState<string>("all");

  // Read ?c=<category> from the link (e.g. from the home page tiles).
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (c && categories.some((x) => x.slug === c)) setCat(c);
  }, [categories]);

  function choose(slug: string) {
    setCat(slug);
    const url = new URL(window.location.href);
    if (slug === "all") url.searchParams.delete("c");
    else url.searchParams.set("c", slug);
    window.history.replaceState(null, "", url);
  }

  const used = categories.filter((c) => products.some((p) => p.category === c.slug));
  const shown = cat === "all" ? products : products.filter((p) => p.category === cat);

  return (
    <>
      <div className="chips" role="group" aria-label="Filter by category">
        <button type="button" className="chip" aria-pressed={cat === "all"} onClick={() => choose("all")}>All</button>
        {used.map((c) => (
          <button key={c.slug} type="button" className="chip" aria-pressed={cat === c.slug} onClick={() => choose(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 14, marginBlock: "0 20px" }} aria-live="polite">
        {shown.length} {shown.length === 1 ? "gift" : "gifts"}
      </p>
      {shown.length === 0 ? (
        <p className="muted">New gifts are coming soon. Message us on WhatsApp and we&apos;ll help you choose.</p>
      ) : (
        <div className="grid">
          {shown.map((p) => <ProductCard key={p.slug} p={p} />)}
        </div>
      )}
    </>
  );
}

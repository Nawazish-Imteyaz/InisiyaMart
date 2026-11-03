"use client";

import { useState } from "react";
import { crafts, products, type Craft } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";

export function ShopGrid() {
  const [craft, setCraft] = useState<Craft | "All">("All");
  const shown = craft === "All" ? products : products.filter((p) => p.craft === craft);

  return (
    <>
      <div className="chips" role="group" aria-label="Filter by craft">
        {(["All", ...crafts] as const).map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={craft === c} onClick={() => setCraft(c)}>
            {c}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 14, marginBlock: "0 20px" }} aria-live="polite">
        {shown.length} {shown.length === 1 ? "gift" : "gifts"}
      </p>
      <div className="grid">
        {shown.map((p) => <ProductCard key={p.slug} p={p} />)}
      </div>
    </>
  );
}

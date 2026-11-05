"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/data/catalog";
import { recent } from "@/lib/wishlist";
import { ProductCard } from "./ProductCard";

/** Share a gift on WhatsApp, Instagram etc. (phone share sheet), or copy the link. */
export function ShareButton({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href.split("#")[0];
    const text = `${name}, handmade in Azamgarh · Insi House`;
    if (navigator.share) {
      try { await navigator.share({ title: name, text, url }); return; } catch { return; }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener"); }
  }
  return (
    <button type="button" className="wish-btn big share" onClick={share} aria-label={`Share ${name}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></svg>
      <span>{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}

/** Remembers this product and shows the gifts viewed before it. */
export function RecentlyViewed({ current, products }: { current: string; products: Product[] }) {
  const [list, setList] = useState<Product[]>([]);
  useEffect(() => {
    const before = recent.get().filter((s) => s !== current);
    setList(before.map((s) => products.find((p) => p.slug === s)).filter((p): p is Product => !!p).slice(0, 8));
    recent.add(current);
  }, [current, products]);
  if (list.length === 0) return null;
  return (
    <section style={{ paddingBlockStart: 64 }}>
      <div className="section-head"><h2 className="display">Recently viewed</h2></div>
      <div className="rail" tabIndex={0} aria-label="Recently viewed gifts, scroll sideways">
        {list.map((p) => <ProductCard key={p.slug} p={p} />)}
      </div>
    </section>
  );
}

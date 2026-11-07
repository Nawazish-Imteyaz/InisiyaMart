"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Maker, Product } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";

interface Data { maker: Maker & { holiday?: boolean; dispatchDays?: number }; products: Product[] }

export function MakerView() {
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("s") ?? "";
    if (!/^[a-z0-9-]{1,90}$/.test(slug)) { setMissing(true); return; }
    fetch(`/api/makers/${slug}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Data | null) => { if (d) { setData(d); document.title = `${d.maker.shop} · Insi House`; } else setMissing(true); })
      .catch(() => setMissing(true));
  }, []);

  if (missing) {
    return (
      <div className="container" style={{ paddingBlock: 80, textAlign: "center" }}>
        <h1 className="display">This shop is not open</h1>
        <Link href="/shop/" className="btn btn-glow">See all handmade gifts</Link>
      </div>
    );
  }
  if (!data) return <div className="container" style={{ paddingBlock: 80 }}><div className="pdp-skeleton" aria-label="Loading" /></div>;
  const m = data.maker;

  return (
    <div className="container" style={{ paddingBlockEnd: 80 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link href="/">Home</Link> / <Link href="/shop/">Shop</Link> / {m.shop}</nav>
      <header className="maker-hero">
        {m.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={m.photo} alt={m.shop} width={120} height={120} />
          : <span className="maker-initial big" aria-hidden="true">{(m.name || m.shop).slice(0, 1).toUpperCase()}</span>}
        <div>
          <h1 className="display">{m.shop}</h1>
          <p className="maker-meta">
            {m.name && <span>by <b>{m.name}</b></span>}
            <span>📍 {m.district}{m.state ? `, ${m.state}` : ""}</span>
            {m.craft && <span>✋ {m.craft}</span>}
            {m.since && <span>On Insi House since {new Date(m.since).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>}
          </p>
          {m.story && <p className="maker-story">{m.story}</p>}
          {m.holiday && <p className="infobox soon"><b>🌙 This maker is on a short break</b><span className="muted">You can still save gifts to your wishlist.</span></p>}
        </div>
      </header>
      <div className="section-head"><h2 className="display">{data.products.length} handmade {data.products.length === 1 ? "piece" : "pieces"}</h2></div>
      {data.products.length
        ? <div className="grid">{data.products.map((p) => <ProductCard key={p.slug} p={p} />)}</div>
        : <p className="muted">New pieces are coming soon.</p>}
    </div>
  );
}

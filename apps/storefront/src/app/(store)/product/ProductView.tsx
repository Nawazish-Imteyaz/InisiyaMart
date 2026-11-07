"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatInr, formatPrice, getOccasion, HOUSE_MAKER_SLUG, makerLink, occasionLink, type Product } from "@/data/catalog";
import { offPercent, ProductCard } from "@/components/ProductCard";
import { WishButton } from "@/components/WishButton";
import { RecentlyViewed, ShareButton } from "@/components/ProductExtras";
import { ProductArt } from "@/components/ProductArt";
import { PincodeCheck } from "@/components/PincodeCheck";
import { AddToCart } from "@/components/AddToCart";
import { ChatIcon } from "@/components/Icons";
import { whatsappLink } from "@/lib/site";

const darkTones = new Set(["ink", "plum", "dusty"]);
const MADE_BY: Record<string, string> = { me: "Made by the maker herself / himself", family: "Made by the maker's family", group: "Made by a group of makers" };

interface Data { product: Product; fromMaker: Product[]; sameCraft: Product[]; sameDistrict: Product[] }

export function ProductView({ fallback }: { fallback: Product[] }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const read = () => setSlug(new URLSearchParams(window.location.search).get("s") ?? "");
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  useEffect(() => {
    if (slug === null) return;
    if (!slug) { setMissing(true); return; }
    let alive = true;
    setData(null);
    setMissing(false);
    fetch(`/api/products/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.ok) return (await r.json()) as Data;
        if (r.status === 404 && (r.headers.get("content-type") ?? "").includes("json")) return null;
        throw new Error("api");
      })
      .catch(() => {
        // No live API (offline preview): use the catalogue built into the site.
        const p = fallback.find((x) => x.slug === slug);
        return p ? { product: p, fromMaker: fallback.filter((x) => x.slug !== slug && x.category === p.category).slice(0, 8), sameCraft: [], sameDistrict: [] } : null;
      })
      .then((d) => { if (!alive) return; if (d) { setData(d); document.title = `${d.product.name} · Insi House`; } else setMissing(true); });
    return () => { alive = false; };
  }, [slug, fallback]);

  if (missing) {
    return (
      <div className="container" style={{ paddingBlock: 80, textAlign: "center" }}>
        <h1 className="display">This gift is not available</h1>
        <p className="muted">It may be sold out or the maker may have removed it.</p>
        <Link href="/shop/" className="btn btn-glow">See all handmade gifts</Link>
      </div>
    );
  }
  if (!data) return <div className="container" style={{ paddingBlock: 80 }}><div className="pdp-skeleton" aria-label="Loading" /></div>;

  const p = data.product;
  const m = p.maker;
  const house = !m || m.slug === HOUSE_MAKER_SLUG;
  const place = m?.district ? `${m.district}${m.state ? `, ${m.state}` : ""}` : "Azamgarh";
  const canBuy = house && p.inStock && p.priceInr !== null;
  const orderText = `Hello Insi House! I'd like to order: ${p.name}${!house && m ? ` (from ${m.shop})` : ""}. My PIN code is ______.`;
  const backText = `Hello Insi House! Please tell me when ${p.name} is back in stock.`;

  return (
    <div className="container" style={{ paddingBlockEnd: 80 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop/">Shop</Link>{m && !house && <> / <Link href={makerLink(m.slug)}>{m.shop}</Link></>} / {p.name}
      </nav>

      <div className="pdp">
        {p.images.length > 0 ? (
          <div className="pdp-gallery" style={{ flex: "1 1 420px", minInlineSize: 0 }}>
            <div className="pdp-slides" tabIndex={0} aria-label={`${p.name} photos`}>
              {p.images.map((src, i) => (
                <div key={src} id={`photo-${i + 1}`} className={`pdp-media arch tone-${p.tone}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${p.name}, photo ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
                </div>
              ))}
            </div>
            {p.images.length > 1 && (
              <div className="pdp-thumbs">
                {p.images.map((src, i) => (
                  <a key={src} href={`#photo-${i + 1}`} aria-label={`Show photo ${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={`pdp-media arch tone-${p.tone}`}>
            <ProductArt art={p.art} size={300} light={darkTones.has(p.tone)} />
            <span className="ph-label">product photo coming soon</span>
          </div>
        )}

        <div className="pdp-info">
          <div className="pdp-top">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span className="pill">{p.badge}</span>
              {p.collection && <span className="pill">{p.collection} collection</span>}
              {p.madeToOrderDays ? <span className="pill">Made to order · {p.madeToOrderDays} days</span> : null}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <WishButton slug={p.slug} name={p.name} big />
              <ShareButton name={p.name} />
            </div>
          </div>
          <div>
            <h1 className="display" style={{ fontSize: "clamp(36px, 4.8vw, 52px)" }}>{p.name}</h1>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{p.technique || p.craft} · handmade in {place}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: "var(--plum)" }}>{formatPrice(p)}</span>
            {p.mrpInr !== null && p.priceInr !== null && p.mrpInr > p.priceInr && <s className="muted" style={{ fontSize: 17 }}>{formatInr(p.mrpInr)}</s>}
            {offPercent(p) > 0 && <span className="off big">{offPercent(p)}% off</span>}
            {p.priceInr !== null && <span className="muted" style={{ fontSize: 13 }}>incl. of all taxes</span>}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>{p.summary}</p>

          {m && !house && <MakerCard m={m} />}

          {p.personalisable && (
            <div className="infobox" style={{ background: "linear-gradient(120deg, #fff1e0, #ffe3ec)", borderColor: "transparent" }}>
              <b>✦ Can be personalised</b>
              <span className="muted">Add a name in English, Hindi or Urdu. Just tell us on WhatsApp.</span>
            </div>
          )}

          {!p.inStock && <span className="stock-out">Out of stock right now</span>}
          {canBuy && <AddToCart slug={p.slug} name={p.name} price={formatPrice(p)} />}
          {!house && p.inStock && (
            <div className="infobox soon">
              <b>🛍️ Buying from maker shops opens very soon</b>
              <span className="muted">Save it to your wishlist ♥ and we&apos;ll be ready shortly. Want it now? Ask us on WhatsApp.</span>
            </div>
          )}
          <a className={`btn ${canBuy ? "btn-outline" : "btn-glow"}`} href={whatsappLink(!p.inStock ? backText : orderText)} target="_blank" rel="noopener noreferrer">
            <ChatIcon size={20} /> {!p.inStock ? "Tell me when it’s back" : p.priceInr === null ? "Ask price on WhatsApp" : canBuy ? "Order on WhatsApp instead" : "Ask about this gift"}
          </a>

          {house && <PincodeCheck />}

          <ul className="trust-row" aria-label="Why shop with us">
            <li><b>✋</b>Handmade in {m?.district || "Azamgarh"}</li>
            <li><b>🇮🇳</b>Made in India</li>
            <li><b>🔒</b>Secure UPI payment</li>
            <li><b>🚚</b>Delivered across India</li>
          </ul>

          {p.occasions.length > 0 && (
            <div className="pdp-occ">
              <b>Perfect for</b>
              <div className="chips" style={{ margin: 0 }}>
                {p.occasions.map((s) => getOccasion(s)).filter((o) => !!o).map((o) => (
                  <Link key={o!.slug} href={occasionLink(o!.slug)} className={`chip-link k-${o!.color}`}>{o!.name}</Link>
                ))}
              </div>
            </div>
          )}

          <div className="details">
            <details open>
              <summary>Who made it</summary>
              <p>
                {MADE_BY[p.madeBy ?? ""] ?? "Handmade"}{m && !house ? ` · ${m.shop}, ${place}` : " · our family in Azamgarh, Uttar Pradesh"}.
                {p.technique ? ` Craft: ${p.technique}.` : ""} Small differences between pieces are natural: that is what makes each one unique.
              </p>
            </details>
            <details>
              <summary>Size &amp; materials</summary>
              <p style={{ whiteSpace: "pre-line" }}>{[p.materials ? `Materials: ${p.materials}` : "", p.details].filter(Boolean).join("\n") || "Ask us on WhatsApp for size and material details."}</p>
            </details>
            <details>
              <summary>Delivery</summary>
              <p>Delivered across India with tracking. {p.madeToOrderDays ? `This piece is made after you order: it takes about ${p.madeToOrderDays} days before it ships.` : "Delivery time is confirmed when you order."} Country of origin: India.</p>
            </details>
          </div>
        </div>
      </div>

      <Rail title={m && !house ? `More from ${m.shop}` : "More from this collection"} items={data.fromMaker} more={m && !house ? makerLink(m.slug) : undefined} />
      <Rail title="Same craft, other makers" items={data.sameCraft} />
      <Rail title={`Also handmade in ${m?.district || "this region"}`} items={data.sameDistrict} />
      <RecentlyViewed current={p.slug} products={[...fallback, ...data.fromMaker, ...data.sameCraft, ...data.sameDistrict]} />
    </div>
  );
}

function MakerCard({ m }: { m: NonNullable<Product["maker"]> }) {
  return (
    <Link href={makerLink(m.slug)} className="maker-card">
      {m.photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={m.photo} alt="" width={56} height={56} />
        : <span className="maker-initial" aria-hidden="true">{(m.name || m.shop).slice(0, 1).toUpperCase()}</span>}
      <span>
        <small>Made by</small>
        <b>{m.name}{m.name && m.shop ? " · " : ""}{m.shop}</b>
        <span className="muted">{[m.craft, `${m.district}${m.state ? `, ${m.state}` : ""}`].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="maker-go" aria-hidden="true">Visit shop →</span>
    </Link>
  );
}

function Rail({ title, items, more }: { title: string; items: Product[]; more?: string }) {
  if (!items.length) return null;
  return (
    <section style={{ paddingBlockStart: 64 }}>
      <div className="section-head"><h2 className="display">{title}</h2>{more && <Link href={more} className="link-arrow">See the shop →</Link>}</div>
      <div className="rail" tabIndex={0} aria-label={`${title}, scroll sideways`}>
        {items.map((r) => <ProductCard key={r.slug} p={r} />)}
      </div>
    </section>
  );
}

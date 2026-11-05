import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInr, formatPrice, getOccasion, getProduct, occasionLink, products } from "@/data/catalog";
import { offPercent, ProductCard } from "@/components/ProductCard";
import { WishButton } from "@/components/WishButton";
import { RecentlyViewed, ShareButton } from "@/components/ProductExtras";
import { ProductArt } from "@/components/ProductArt";
import { PincodeCheck } from "@/components/PincodeCheck";
import { AddToCart } from "@/components/AddToCart";
import { Reveal } from "@/components/Motion";
import { ChatIcon } from "@/components/Icons";
import { whatsappLink } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  // A static export needs at least one page; "_" renders the 404 page when there are no products.
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = getProduct(slug);
  return p ? { title: p.name, description: p.summary } : {};
}

const darkTones = new Set(["ink", "plum", "dusty"]);

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) notFound();

  const orderText = `Hello Insi House! I'd like to order: ${p.name}. My PIN code is ______. Please share the price and delivery date.`;
  const backText = `Hello Insi House! Please tell me when ${p.name} is back in stock.`;
  const related = products.filter((x) => x.slug !== p.slug && x.category === p.category).concat(products.filter((x) => x.category !== p.category)).slice(0, 4);

  return (
    <div className="container" style={{ paddingBlockEnd: 80 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop/">Shop</Link> / {p.name}
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
          <Reveal className={`pdp-media arch tone-${p.tone}`}>
            <ProductArt art={p.art} size={300} light={darkTones.has(p.tone)} />
            <span className="ph-label">product photo coming soon</span>
          </Reveal>
        )}

        <div className="pdp-info">
          <div className="pdp-top">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span className="pill">{p.badge}</span>
              {p.collection && <span className="pill">{p.collection} collection</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <WishButton slug={p.slug} name={p.name} big />
              <ShareButton name={p.name} />
            </div>
          </div>
          <div>
            <h1 className="display" style={{ fontSize: "clamp(36px, 4.8vw, 52px)" }}>{p.name}</h1>
            <Link href="/story/" style={{ fontSize: 15, fontWeight: 700 }}>{p.craft} · handmade in Azamgarh</Link>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: "var(--plum)" }}>{formatPrice(p)}</span>
            {p.mrpInr !== null && p.priceInr !== null && p.mrpInr > p.priceInr && <s className="muted" style={{ fontSize: 17 }}>{formatInr(p.mrpInr)}</s>}
            {offPercent(p) > 0 && <span className="off big">{offPercent(p)}% off</span>}
            {p.priceInr !== null && <span className="muted" style={{ fontSize: 13 }}>incl. of all taxes</span>}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>{p.summary}</p>

          {p.personalisable && (
            <div className="infobox" style={{ background: "linear-gradient(120deg, #fff1e0, #ffe3ec)", borderColor: "transparent" }}>
              <b>✦ Can be personalised</b>
              <span className="muted">Add a name in English, Hindi or Urdu. Just tell us on WhatsApp.</span>
            </div>
          )}

          {!p.inStock && <span className="stock-out">Out of stock right now</span>}
          {p.inStock && p.priceInr !== null && <AddToCart slug={p.slug} name={p.name} price={formatPrice(p)} />}
          <a className={`btn ${p.inStock && p.priceInr !== null ? "btn-outline" : "btn-glow"}`} href={whatsappLink(!p.inStock ? backText : orderText)} target="_blank" rel="noopener noreferrer">
            <ChatIcon size={20} /> {!p.inStock ? "Tell me when it’s back" : p.priceInr === null ? "Ask price on WhatsApp" : "Order on WhatsApp instead"}
          </a>

          <PincodeCheck />

          <ul className="trust-row" aria-label="Why shop with us">
            <li><b>✋</b>Handmade in Azamgarh</li>
            <li><b>🎁</b>Gift-wrapped with a card</li>
            <li><b>🔒</b>Secure UPI payment</li>
            <li><b>🚚</b>Delivered across India</li>
          </ul>

          {p.occasions.length > 0 && (
            <div className="pdp-occ">
              <b>Perfect for</b>
              <div className="chips" style={{ margin: 0 }}>
                {p.occasions.map((slug) => getOccasion(slug)).filter((o) => !!o).map((o) => (
                  <Link key={o!.slug} href={occasionLink(o!.slug)} className={`chip-link k-${o!.color}`}>{o!.name}</Link>
                ))}
              </div>
            </div>
          )}

          <Link href={`/events/?product=${p.slug}`} className="bulk-link">Need 20 or more for a wedding, haldi or office? <b>Get a bulk price →</b></Link>

          <div className="infobox">
            <b>How ordering works</b>
            <span className="muted">1. Add to cart and place your order (or message us on WhatsApp) · 2. Pay by UPI: GPay, PhonePe or Paytm · 3. We gift-wrap it by hand · 4. We ship with tracking. Follow it on <a href="/track/">Track your order</a>.</span>
          </div>

          <div className="details">
            <details open>
              <summary>Story of this craft</summary>
              <p>Every piece is made by hand by our family in Azamgarh, Uttar Pradesh, a region known for Nizamabad black pottery and Mubarakpur silk. Small variations are natural and make each gift unique.</p>
            </details>
            <details>
              <summary>Size &amp; materials</summary>
              <p style={{ whiteSpace: "pre-line" }}>{p.details || "Size, weight and materials will be added soon. Ask us on WhatsApp for details."}</p>
            </details>
            <details>
              <summary>Delivery &amp; packing</summary>
              <p>We deliver to every PIN code in India with tracking. Fragile pieces are double-boxed. Delivery time is confirmed when you order.</p>
            </details>
          </div>
        </div>
      </div>

      <section style={{ paddingBlockStart: 80 }}>
        <Reveal className="section-head"><h2 className="display">You may also love</h2></Reveal>
        <div className="grid">
          {related.map((r) => <ProductCard key={r.slug} p={r} />)}
        </div>
      </section>
      <RecentlyViewed current={p.slug} products={products} />
    </div>
  );
}

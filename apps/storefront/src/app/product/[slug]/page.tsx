import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice, getProduct, products } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";
import { ChatIcon } from "@/components/Icons";
import { whatsappLink } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = getProduct(slug);
  return p ? { title: p.name, description: p.summary } : {};
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) notFound();

  const orderText = `Hello Insi House! I'd like to order: ${p.name}. Please share the price and delivery time to my country.`;
  const related = products.filter((x) => x.slug !== p.slug && x.craft === p.craft).concat(products.filter((x) => x.craft !== p.craft)).slice(0, 4);

  return (
    <div className="container" style={{ paddingBlockEnd: 72 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop/">Shop</Link> / {p.name}
      </nav>

      <div className="pdp">
        <div className={`pdp-media arch ph tone-${p.tone}`}>[{p.name}: main photo]</div>

        <div className="pdp-info">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span className="pill">{p.badge}</span>
            <span className="pill">{p.collection} collection</span>
          </div>
          <div>
            <h1 className="display" style={{ fontSize: "clamp(34px, 4.5vw, 46px)" }}>{p.name}</h1>
            <Link href="/story/" style={{ fontSize: 15 }}>{p.craft} · handmade in Azamgarh</Link>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{formatPrice(p)}</div>
          <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>{p.summary}</p>

          {p.personalisable && (
            <div className="infobox" style={{ background: "var(--blush)", borderColor: "var(--blush)" }}>
              <b>Can be personalised</b>
              <span className="muted">Add a name in English, Urdu or Arabic. Just tell us on WhatsApp.</span>
            </div>
          )}

          <a className="btn" href={whatsappLink(orderText)} target="_blank" rel="noopener noreferrer">
            <ChatIcon size={20} /> Order on WhatsApp
          </a>

          <div className="infobox">
            <b>How ordering works</b>
            <span className="muted">1. Send us this gift on WhatsApp · 2. We confirm price &amp; delivery to your country · 3. You pay with a secure link · 4. We wrap it and ship with tracking.</span>
          </div>

          <div className="details">
            <details open>
              <summary>Story of this craft</summary>
              <p>Every piece is made by hand by our family in Azamgarh, Uttar Pradesh, a region known for Nizamabad black pottery and Mubarakpur silk. Small variations are natural and make each gift unique.</p>
            </details>
            <details>
              <summary>Size &amp; materials</summary>
              <p>[Size, weight and materials will be added for each product.]</p>
            </details>
            <details>
              <summary>Delivery</summary>
              <p>We deliver to Kuwait, Saudi Arabia, UAE, Qatar, Bahrain and Oman, with tracking on WhatsApp. Delivery time is confirmed when you order.</p>
            </details>
          </div>
        </div>
      </div>

      <section style={{ paddingBlockStart: 72 }}>
        <div className="section-head"><h2 className="display">You may also love</h2></div>
        <div className="grid">
          {related.map((r) => <ProductCard key={r.slug} p={r} />)}
        </div>
      </section>
    </div>
  );
}

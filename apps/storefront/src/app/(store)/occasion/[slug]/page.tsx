import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryGradients, getOccasion, occasions, products } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";
import { OccasionArt, OccasionTile } from "@/components/OccasionTile";
import { Reveal } from "@/components/Motion";
import { ChatIcon } from "@/components/Icons";
import { whatsappLink } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return occasions.length ? occasions.map((o) => ({ slug: o.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const o = getOccasion((await params).slug);
  return o ? { title: `${o.name} gifts`, description: `${o.blurb} Handmade in Azamgarh, delivered across India.` } : {};
}

export default async function OccasionPage({ params }: Params) {
  const o = getOccasion((await params).slug);
  if (!o) notFound();
  const list = products.filter((p) => p.occasions.includes(o.slug));
  const list2 = [...list.filter((p) => p.inStock), ...list.filter((p) => !p.inStock)];
  const wedding = o.group === "wedding";
  const others = occasions.filter((x) => x.slug !== o.slug && x.group === o.group).concat(occasions.filter((x) => x.group !== o.group)).slice(0, 6);

  return (
    <div className="container" style={{ paddingBlockEnd: 80 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link href="/">Home</Link> / <Link href="/occasions/">Occasions</Link> / {o.name}</nav>
      <section className="occ-banner" style={{ background: o.image ? `linear-gradient(100deg, rgba(43,27,34,.85), rgba(43,27,34,.2)), url(${o.image}) center/cover` : categoryGradients[o.color] }}>
        <div className="occ-banner-copy">
          <span className="eyebrow" style={{ color: "#fff", opacity: 0.9 }}>{wedding ? "Shaadi season" : o.group === "festival" ? "Festival gifting" : "Celebrate"}</span>
          <h1 className="display">{o.name} gifts</h1>
          <p>{o.blurb} Every piece is made by hand in Azamgarh and gift-wrapped with your message.</p>
          <div className="row-btns">
            <a href="#gifts" className="btn btn-light">See {list.length ? `${list.length} gift${list.length === 1 ? "" : "s"}` : "ideas"}</a>
            {wedding
              ? <Link href={`/events/?o=${o.slug}`} className="btn btn-outline on-dark">Bulk &amp; return gifts →</Link>
              : <a className="btn btn-outline on-dark" href={whatsappLink(`Hello Insi House! I'm looking for a ${o.name} gift. Budget: ₹___`)} target="_blank" rel="noopener noreferrer"><ChatIcon size={18} /> Help me choose</a>}
          </div>
        </div>
        <div className="occ-banner-art" aria-hidden="true">
          {o.urdu && <span className="urdu" lang="ur" dir="rtl">{o.urdu}</span>}
          {!o.image && <OccasionArt slug={o.slug} size={150} />}
        </div>
      </section>

      <section id="gifts" style={{ paddingBlockStart: 48 }}>
        {list2.length ? (
          <div className="grid">{list2.map((p) => <ProductCard key={p.slug} p={p} />)}</div>
        ) : (
          <div className="empty-state">
            <b>Our {o.name} pieces are made to order.</b>
            <span className="muted">Tell us what you need and how many, and we&apos;ll send ideas and prices on WhatsApp.</span>
            <Link href={`/events/?o=${o.slug}`} className="btn btn-glow">Tell us what you need</Link>
          </div>
        )}
      </section>

      {wedding && (
        <Reveal>
          <section className="bulk-band">
            <div>
              <span className="eyebrow">For your {o.name.toLowerCase()} ceremony</span>
              <h2 className="display">Return gifts &amp; favours, handmade for every guest</h2>
              <p className="muted">Matching boxes, your names on the card, and colours to suit the ceremony. Tell us the date, the number of guests and your budget.</p>
            </div>
            <Link href={`/events/?o=${o.slug}`} className="btn btn-glow">Get a quote →</Link>
          </section>
        </Reveal>
      )}

      <section style={{ paddingBlockStart: 64 }}>
        <Reveal className="section-head"><h2 className="display">More occasions</h2><Link href="/occasions/" className="link-more">See all →</Link></Reveal>
        <div className="occasions">{others.map((x) => <OccasionTile key={x.slug} o={x} />)}</div>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { occasionGroups, occasions, products } from "@/data/catalog";
import { OccasionTile } from "@/components/OccasionTile";
import { Reveal } from "@/components/Motion";

export const metadata: Metadata = {
  title: "Shop by occasion",
  description: "Handmade gifts for haldi, mehndi, nikah and weddings, birthdays, Eid, Diwali and Raksha Bandhan. Made in Azamgarh, delivered across India.",
};

export default function OccasionsPage() {
  return (
    <div className="container" style={{ paddingBlockEnd: 80 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link href="/">Home</Link> / Occasions</nav>
      <div className="cta occ-hero">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxInlineSize: 680 }}>
          <span className="eyebrow">Every celebration, handmade</span>
          <h1 className="display" style={{ fontSize: "clamp(40px, 5.5vw, 60px)" }}>Shop by <span className="grad-text">occasion</span></h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6, fontSize: 17 }}>From haldi and mehndi to Eid, Diwali and birthdays. Pick the moment, we&apos;ll handle the gift.</p>
        </div>
        <Link href="/events/" className="btn btn-glow">Planning a wedding? Bulk orders →</Link>
      </div>
      {occasionGroups.map((g) => {
        const list = occasions.filter((o) => o.group === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id} style={{ paddingBlockStart: 48 }}>
            <Reveal className="section-head">
              <h2 className="display">{g.title} <span className="urdu" lang="ur" dir="rtl" style={{ color: "var(--gold)", fontSize: "0.6em" }}>{g.urdu}</span></h2>
            </Reveal>
            <div className="occasions">
              {list.map((o, i) => (
                <Reveal key={o.slug} delay={i * 60}>
                  <OccasionTile o={o} count={products.filter((p) => p.occasions.includes(o.slug)).length} />
                </Reveal>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

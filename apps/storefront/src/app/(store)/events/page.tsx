import type { Metadata } from "next";
import Link from "next/link";
import { occasionLink, occasions } from "@/data/catalog";
import { OccasionArt } from "@/components/OccasionTile";
import { Reveal } from "@/components/Motion";
import { EnquiryForm } from "./EnquiryForm";

export const metadata: Metadata = {
  title: "Weddings, haldi, mehndi & bulk gifts",
  description: "Handmade return gifts and favours for haldi, mehndi, nikah and weddings, and bulk or corporate gifting. Made in Azamgarh, delivered across India.",
};

const steps = [
  { t: "Tell us the event", d: "Date, number of guests, budget and the look you want." },
  { t: "Get ideas & a quote", d: "We send photos, samples and prices on WhatsApp." },
  { t: "We make every piece", d: "Handmade in Azamgarh, in your colours, with your names on the card." },
  { t: "Packed & delivered", d: "Boxed, labelled and shipped to your venue or home." },
];

export default function EventsPage() {
  const wedding = occasions.filter((o) => o.group === "wedding");
  return (
    <div className="container" style={{ paddingBlockEnd: 80 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link href="/">Home</Link> / Weddings &amp; events</nav>
      <section className="events-hero">
        <div className="events-copy">
          <span className="eyebrow">Shaadi · Haldi · Mehndi · Nikah</span>
          <h1 className="display">Handmade gifts for your <span className="grad-text">big days</span></h1>
          <p className="muted">Return gifts your guests will keep, trousseau pieces for the bride, and hampers for both families. Made by hand by our family in Azamgarh.</p>
          <div className="events-tiles">
            {wedding.map((o) => (
              <Link key={o.slug} href={occasionLink(o.slug)} className={`events-tile k-${o.color}`}>
                <OccasionArt slug={o.slug} size={40} />
                <span>{o.name}</span>
              </Link>
            ))}
          </div>
          <ol className="events-steps">
            {steps.map((s, i) => (
              <Reveal key={s.t} delay={i * 80}>
                <li><span className="num">{i + 1}</span><span><b>{s.t}</b><small>{s.d}</small></span></li>
              </Reveal>
            ))}
          </ol>
        </div>
        <div className="events-form"><EnquiryForm occasions={occasions} /></div>
      </section>
    </div>
  );
}

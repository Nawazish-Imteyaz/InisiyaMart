import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Our story" };

const steps = [
  { n: "01", title: "Shaped by hand", text: "Clay is shaped or silk is woven by our family in Azamgarh." },
  { n: "02", title: "Finished with care", text: "Etching, polishing or embroidery takes days, not minutes." },
  { n: "03", title: "Wrapped as a gift", text: "Packed safely, with your message card inside." },
  { n: "04", title: "Delivered across India", text: "Shipped with tracking to her door, in any city or town in India." },
];

export default function StoryPage() {
  return (
    <>
      <section className="band">
        <div className="container" style={{ maxInlineSize: 960, paddingBlock: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center" }}>
          <span className="urdu" dir="rtl" lang="ur" style={{ color: "var(--gold)", fontSize: 28 }}>{site.taglineUrdu}</span>
          <h1 className="display" style={{ fontSize: "clamp(40px, 6vw, 60px)" }}>Made by hand, in the heart of Azamgarh</h1>
          <p style={{ color: "var(--rose-tint)", fontSize: 18, lineHeight: 1.7, margin: 0, maxInlineSize: 720 }}>
            Insi House is named after our niece, Insiya, whose name means warmth and closeness. That is what we want every gift to carry.
          </p>
        </div>
      </section>

      <section className="section container">
        <div className="band-row">
          <div className="ph arch tone-rose" style={{ flex: "1 1 380px", blockSize: 460 }}>[Family photo in the workshop]</div>
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 16 }}>
            <span className="eyebrow">Our family</span>
            <h2 className="display" style={{ fontSize: "clamp(32px, 4vw, 44px)" }}>[How our family started making these crafts]</h2>
            <p className="muted" style={{ fontSize: 17, lineHeight: 1.75, margin: 0 }}>
              [Your story in your own words: which town or village in Azamgarh, how many years, who makes what, and why you started Insi House.]
            </p>
          </div>
        </div>
      </section>

      <section className="tone-blush">
        <div className="container section">
          <h2 className="display" style={{ fontSize: "clamp(32px, 4vw, 44px)", textAlign: "center", color: "var(--ink)", marginBlockEnd: 40 }}>The crafts of Azamgarh</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
            <article style={{ background: "#fff", borderRadius: 24, overflow: "hidden" }}>
              <div className="ph tone-ink" style={{ blockSize: 260 }}>[Photo: black pottery close-up]</div>
              <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 10, color: "var(--ink)" }}>
                <h3 className="display" style={{ fontSize: 30 }}>Nizamabad black pottery</h3>
                <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Glossy black clay from the town of Nizamabad, with patterns etched by hand and filled with silver colour. A craft passed down through generations.</p>
                <Link href="/shop/" style={{ fontWeight: 700 }}>Shop black pottery →</Link>
              </div>
            </article>
            <article style={{ background: "#fff", borderRadius: 24, overflow: "hidden" }}>
              <div className="ph tone-dusty" style={{ blockSize: 260 }}>[Photo: silk on the handloom]</div>
              <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 10, color: "var(--ink)" }}>
                <h3 className="display" style={{ fontSize: 30 }}>Mubarakpur silk</h3>
                <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Mubarakpur&apos;s weavers are part of the famous Banarasi tradition, creating rich silk with zari thread on handlooms.</p>
                <Link href="/shop/" style={{ fontWeight: 700 }}>Shop silk &amp; dupattas →</Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section container">
        <h2 className="display" style={{ fontSize: "clamp(32px, 4vw, 44px)", marginBlockEnd: 32 }}>How each gift is made</h2>
        <ol className="grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {steps.map((s) => (
            <li key={s.n} style={{ borderBlockStart: "2px solid var(--rose)", paddingBlockStart: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="display" style={{ fontSize: 40, color: "var(--plum)" }}>{s.n}</span>
              <b style={{ fontSize: 18 }}>{s.title}</b>
              <span className="muted" style={{ lineHeight: 1.6 }}>{s.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

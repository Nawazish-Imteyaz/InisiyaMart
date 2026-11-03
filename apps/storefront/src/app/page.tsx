import Link from "next/link";
import { collections, occasions, products } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";
import { CardIcon, GiftIcon, HeartIcon, TruckIcon } from "@/components/Icons";
import { site, whatsappLink } from "@/lib/site";

const features = [
  { icon: <HeartIcon />, title: "Handmade by our family", text: "Every piece is made by hand in Azamgarh, never mass-produced." },
  { icon: <GiftIcon />, title: "Wrapped as a gift", text: "Elegant packaging and a personal message card in English, Arabic or Urdu." },
  { icon: <TruckIcon />, title: "Delivered across the GCC", text: "Kuwait, Saudi Arabia, UAE, Qatar, Bahrain and Oman, with tracking on WhatsApp." },
  { icon: <CardIcon />, title: "Easy ordering", text: "Order on WhatsApp and pay securely with the payment link we send you." },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-row">
          <div className="hero-copy">
            <span className="eyebrow">Handmade · Gift-ready · Made with love</span>
            <h1 className="display">Gifts she&apos;ll treasure, handmade in Azamgarh</h1>
            <p className="muted" style={{ fontSize: 18, lineHeight: 1.6, margin: 0, maxInlineSize: 520 }}>
              Black pottery, Mubarakpur silk and hand-crafted décor, made by our family and wrapped as a gift, with your personal message inside.
            </p>
            <div className="row-btns">
              <Link href="/shop/" className="btn">Shop gifts</Link>
              <a className="btn btn-outline" href={whatsappLink("Hello Insi House! Can you help me choose a gift?")} target="_blank" rel="noopener noreferrer">Help me choose</a>
            </div>
            <div className="checks">
              <span>✓ Handmade by our family</span>
              <span>✓ Personal gift message</span>
              <span>✓ Delivered across the GCC</span>
            </div>
          </div>
          <div className="hero-media">
            <div className="hero-frame arch ph tone-rose">[Hero photo: gift box with black pottery vase and a silk dupatta]</div>
            <div className="hero-note">
              <div className="eyebrow" style={{ fontSize: 11 }}>Personal message card</div>
              <div className="display" style={{ fontSize: 20, fontStyle: "italic", fontWeight: 500 }}>&ldquo;For you, with love&rdquo;</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <h2 className="display">Shop by occasion</h2>
          <Link href="/shop/" style={{ fontWeight: 700 }}>See all gifts →</Link>
        </div>
        <div className="grid-sm">
          {occasions.map((o) => (
            <Link key={o.name} href="/shop/" className="occasion">
              <span className={`ph arch tone-${o.tone}`}>[photo]</span>
              {o.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="container" style={{ paddingBlockEnd: 72 }}>
        <div className="section-head">
          <div>
            <h2 className="display">Our collections</h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>Named with words loved in both Urdu and Arabic.</p>
          </div>
        </div>
        <div className="grid">
          {collections.map((c) => (
            <Link key={c.name} href="/shop/" className={`collection tone-${c.tone}`}>
              <span className="urdu" dir="rtl" lang="ur" style={{ textAlign: "start" }}>{c.urdu}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="name">{c.name}</span>
                <span style={{ fontSize: 14, opacity: 0.85 }}>{c.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container" style={{ paddingBlockEnd: 72 }}>
        <div className="section-head">
          <h2 className="display">Loved gifts</h2>
          <Link href="/shop/" style={{ fontWeight: 700 }}>Shop all →</Link>
        </div>
        <div className="grid">
          {products.slice(0, 4).map((p) => <ProductCard key={p.slug} p={p} />)}
        </div>
      </section>

      <section className="band section">
        <div className="container band-row">
          <div className="band-copy">
            <span className="urdu" dir="rtl" lang="ur" style={{ color: "var(--gold)", fontSize: 22, textAlign: "start" }}>{site.taglineUrdu}</span>
            <h2 className="display" style={{ fontSize: "clamp(34px, 5vw, 48px)" }}>Every piece carries a story</h2>
            <p>From the black clay of Nizamabad to the silk looms of Mubarakpur, our family has grown up with Azamgarh&apos;s crafts. Each gift is made by hand, so no two are exactly alike.</p>
            <Link href="/story/" className="btn btn-light" style={{ alignSelf: "flex-start" }}>Meet the makers</Link>
          </div>
          <div className="band-media">
            <div className="ph arch tone-ink">[Photo: black pottery being etched]</div>
            <div className="ph arch tone-dusty" style={{ marginBlockStart: 40 }}>[Photo: silk on the loom]</div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="grid">
          {features.map((f) => (
            <div key={f.title} className="feature">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

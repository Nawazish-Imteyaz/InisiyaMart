import Link from "next/link";
import { categories, categoryGradients, collections, occasionLink, occasions, products, shopLink } from "@/data/catalog";
import { OccasionArt, OccasionTile } from "@/components/OccasionTile";
import { ProductCard } from "@/components/ProductCard";
import { ProductArt } from "@/components/ProductArt";
import { HeroStage } from "@/components/HeroStage";
import { Reveal, Tilt } from "@/components/Motion";
import { CardIcon, ChatIcon, GiftIcon, HeartIcon, TruckIcon } from "@/components/Icons";
import { site, whatsappLink } from "@/lib/site";

const marquee = [
  "Handmade in Azamgarh",
  "Nizamabad black pottery",
  "Mubarakpur silk",
  "Gift-wrapped with love",
  "Delivered across India",
  "Personalised gifts",
  "Pay by UPI",
];

const steps = [
  { title: "Choose a gift", text: "Pick from pottery, silk, décor and hampers, or ask us to help you choose.", color: "var(--rani)" },
  { title: "Make it personal", text: "Add a name, a message card in English, Hindi or Urdu, and gift wrap.", color: "var(--marigold)" },
  { title: "We wrap & deliver", text: "Packed safely by hand and delivered to any PIN code in India, with tracking.", color: "var(--peacock)" },
];

const features = [
  { icon: <HeartIcon />, title: "Handmade by our family", text: "Every piece is made by hand in Azamgarh, never mass-produced.", bg: "var(--rani)" },
  { icon: <GiftIcon />, title: "Ready to gift", text: "Beautiful packaging with your personal message card.", bg: "var(--marigold)" },
  { icon: <TruckIcon />, title: "Delivered across India", text: "Safe, tracked delivery to metros, towns and villages.", bg: "var(--peacock)" },
  { icon: <CardIcon />, title: "Easy payment", text: "Pay by UPI, card or net banking with a secure link.", bg: "var(--plum)" },
];

export default function Home() {
  const marqueeItems = [...marquee, ...marquee];
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <span className="blob b1" aria-hidden="true" />
        <span className="blob b2" aria-hidden="true" />
        <span className="blob b3" aria-hidden="true" />
        <div className="container hero-row">
          <div className="hero-copy">
            <span className="eyebrow">Handmade · Personalised · Made with love</span>
            <h1 className="display">
              Gifts she&apos;ll <span className="grad-text">treasure</span>, handmade in Azamgarh
            </h1>
            <p className="lead">
              Black pottery from Nizamabad, silk from Mubarakpur and hand-crafted décor, made by our family, wrapped as a gift and {site.delivery.toLowerCase()}.
            </p>
            <div className="row-btns">
              <Link href="/shop/" className="btn btn-glow">Shop gifts</Link>
              <a className="btn btn-outline" href={whatsappLink("Hello Insi House! Can you help me choose a gift?")} target="_blank" rel="noopener noreferrer">
                <ChatIcon size={18} /> Help me choose
              </a>
            </div>
            <div className="trust">
              <span><i style={{ background: "var(--rani)" }} />Handmade</span>
              <span><i style={{ background: "var(--marigold)" }} />Personalised</span>
              <span><i style={{ background: "var(--peacock)" }} />All-India delivery</span>
              <span><i style={{ background: "var(--lilac)" }} />UPI payments</span>
            </div>
          </div>
          <HeroStage />
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee" aria-label={marquee.join(", ")}>
        <div className="marquee-track" aria-hidden="true">
          {marqueeItems.map((m, i) => (
            <span key={i}>{m}<span className="star">✦</span></span>
          ))}
        </div>
      </div>

      {/* CATEGORIES */}
      <section className="section container">
        <Reveal className="section-head">
          <h2 className="display">What are you looking for?</h2>
          <Link href="/shop/" className="link-more">Shop all gifts →</Link>
        </Reveal>
        <div className="cats">
          {categories.slice(0, 8).map((c, i) => (
            <Reveal key={c.slug} delay={i * 90}>
              <Tilt>
                <Link
                  href={shopLink(c.slug)}
                  className={`cat${c.image ? " has-photo" : ""}`}
                  style={{ background: c.image ? `linear-gradient(180deg, transparent 35%, rgba(43,27,34,.78)), url(${c.image}) center/cover` : categoryGradients[c.color] }}
                >
                  {!c.image && <span className="cat-art pop"><ProductArt art={c.art} size={140} light /></span>}
                  <h3>{c.name}</h3>
                  <span>{c.sub ? `${c.sub} · ` : ""}Shop now →</span>
                </Link>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </section>

      {/* OCCASIONS */}
      <section className="container" style={{ paddingBlockEnd: 72 }}>
        <Reveal className="section-head">
          <div>
            <span className="eyebrow">Celebrate every moment</span>
            <h2 className="display" style={{ marginBlockStart: 8 }}>Shop by occasion</h2>
          </div>
          <Link href="/occasions/" className="link-more">All occasions →</Link>
        </Reveal>
        <div className="occasions">
          {occasions.filter((o) => o.group !== "wedding").slice(0, 8).map((o, i) => (
            <Reveal key={o.slug} delay={i * 60}><OccasionTile o={o} /></Reveal>
          ))}
        </div>
      </section>

      {/* SHAADI SEASON */}
      <section className="container" style={{ paddingBlockEnd: 80 }}>
        <Reveal>
          <div className="shaadi">
            <div className="shaadi-copy">
              <span className="urdu" lang="ur" dir="rtl">شادی مبارک</span>
              <h2 className="display">Haldi, mehndi &amp; nikah, handmade</h2>
              <p>Return gifts your guests will keep, trousseau pieces for the bride and hampers for both families. Made to order in your colours, with your names on every card.</p>
              <div className="row-btns">
                <Link href="/events/" className="btn btn-light">Get a wedding quote</Link>
                <Link href="/occasion/return-gifts/" className="btn btn-outline on-dark">Return gift ideas</Link>
              </div>
            </div>
            <div className="shaadi-tiles">
              {occasions.filter((o) => o.group === "wedding").slice(0, 4).map((o) => (
                <Link key={o.slug} href={occasionLink(o.slug)} className={`shaadi-tile k-${o.color}`}>
                  <OccasionArt slug={o.slug} size={54} />
                  <b>{o.name}</b>
                  {o.urdu && <span className="urdu" lang="ur" dir="rtl">{o.urdu}</span>}
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* TRENDING RAIL */}
      <section className="container" style={{ paddingBlockEnd: 80 }}>
        <Reveal className="section-head">
          <h2 className="display">Trending gifts <span className="grad-text">✦</span></h2>
          <Link href="/shop/" className="link-more">See all →</Link>
        </Reveal>
        <Reveal>
          <div className="rail" tabIndex={0} aria-label="Trending gifts, scroll sideways">
            {products.slice(0, 12).map((p) => <ProductCard key={p.slug} p={p} />)}
          </div>
        </Reveal>
      </section>

      {/* COLLECTIONS */}
      <section className="container" style={{ paddingBlockEnd: 80 }}>
        <Reveal className="section-head">
          <div>
            <h2 className="display">Our collections</h2>
            <p className="muted" style={{ margin: "8px 0 0" }}>Named with beautiful Urdu words.</p>
          </div>
        </Reveal>
        <div className="grid">
          {collections.map((c, i) => (
            <Reveal key={c.name} delay={i * 90}>
              <Tilt max={6}>
                <Link href="/shop/" className={`collection ${c.cls}`}>
                  <span className="urdu pop" dir="rtl" lang="ur">{c.urdu}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="name">{c.name}</span>
                    <span style={{ fontSize: 14, opacity: 0.9 }}>{c.desc}</span>
                  </span>
                </Link>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container" style={{ paddingBlockEnd: 80 }}>
        <Reveal className="section-head"><h2 className="display">Gifting in 3 easy steps</h2></Reveal>
        <div className="steps">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <div className="step">
                <span className="num" style={{ background: s.color }}>{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* STORY */}
      <section className="band section">
        <div className="container band-row">
          <Reveal className="band-copy">
            <span className="urdu" dir="rtl" lang="ur" style={{ color: "var(--gold)", fontSize: 24, textAlign: "start" }}>{site.taglineUrdu}</span>
            <h2 className="display" style={{ fontSize: "clamp(36px, 5vw, 54px)" }}>Every piece carries a story</h2>
            <p>From the black clay of Nizamabad to the silk looms of Mubarakpur, our family has grown up with Azamgarh&apos;s crafts. Each gift is made by hand, so no two are exactly alike.</p>
            <Link href="/story/" className="btn btn-light" style={{ alignSelf: "flex-start" }}>Meet the makers</Link>
          </Reveal>
          <Reveal className="band-media" delay={150}>
            <div className="arch tone-ink"><ProductArt art="pot" size={150} light /></div>
            <div className="arch tone-dusty" style={{ marginBlockStart: 40 }}><ProductArt art="fabric" size={150} light /></div>
          </Reveal>
        </div>
      </section>

      {/* 3D WORDMARK */}
      <section className="word3d-wrap" aria-label={site.name}>
        <Reveal>
          <span className="word3d" aria-hidden="true">INSI HOUSE</span>
          <div className="urdu grad-text" dir="rtl" lang="ur" style={{ fontSize: "clamp(26px, 4vw, 44px)", marginBlockStart: 8 }}>{site.urdu}</div>
        </Reveal>
      </section>

      {/* FEATURES */}
      <section className="container" style={{ paddingBlockEnd: 72 }}>
        <div className="grid">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="feature">
                <div className="feature-icon" style={{ background: f.bg }}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container" style={{ paddingBlockEnd: 88 }}>
        <Reveal>
          <div className="cta">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxInlineSize: 600 }}>
              <h2 className="display" style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>Not sure what to gift?</h2>
              <p className="muted" style={{ margin: 0, fontSize: 17 }}>Tell us who it&apos;s for and your budget, and we&apos;ll suggest the perfect handmade gift.</p>
            </div>
            <a className="btn btn-glow" href={whatsappLink("Hello Insi House! Please suggest a gift. It's for: ___ , budget: ₹___")} target="_blank" rel="noopener noreferrer">
              <ChatIcon size={18} /> Ask us on WhatsApp
            </a>
          </div>
        </Reveal>
      </section>
    </>
  );
}

import Link from "next/link";
import { LogoMark } from "./Logo";
import { MenuIcon } from "./Icons";
import { CartButton } from "./CartButton";
import { AccountLink, SearchButton, WishlistLink, type SearchItem } from "./HeaderTools";
import { site, whatsappLink } from "@/lib/site";
import { categories, formatPrice, occasionLink, occasions, products, shopLink } from "@/data/catalog";

const links = [
  { href: "/shop/", label: "Shop all" },
  ...categories.slice(0, 3).map((c) => ({ href: shopLink(c.slug), label: c.name })),
  { href: "/occasions/", label: "Occasions" },
  { href: "/events/", label: "Weddings" },
];
const mobileExtra = [
  ...categories.slice(3).map((c) => ({ href: shopLink(c.slug), label: c.name })),
  { href: "/wishlist/", label: "My wishlist" },
  { href: "/track/", label: "Track order" },
  { href: "/story/", label: "Our story" },
];

const occName = new Map(occasions.map((o) => [o.slug, o.name]));
const searchItems: SearchItem[] = products.map((p) => ({
  slug: p.slug,
  name: p.name,
  craft: p.craft,
  price: formatPrice(p),
  image: p.images[0] ?? null,
  words: [p.summary, p.collection, p.badge, ...p.occasions.map((o) => occName.get(o) ?? o)].join(" ").toLowerCase(),
}));
const quick = [
  ...occasions.filter((o) => o.group === "wedding").slice(0, 3).map((o) => ({ label: o.name, href: occasionLink(o.slug) })),
  ...categories.slice(0, 3).map((c) => ({ label: c.name, href: shopLink(c.slug) })),
  { label: "Under ₹999", href: "/shop/?price=0-999" },
];

export function Header() {
  return (
    <>
      {site.announcement && <div className="topbar">{site.announcement}</div>}
      <header className="header">
        <div className="container header-row">
          <details className="mobile-menu">
            <summary className="icon-btn" aria-label="Menu"><MenuIcon /></summary>
            <nav aria-label="Mobile">
              {[...links, ...mobileExtra].map((l) => (
                <Link key={l.label} href={l.href}>{l.label}</Link>
              ))}
              <a href={whatsappLink("Hello Insi House! I'd like to order a gift.")} target="_blank" rel="noopener noreferrer">Order on WhatsApp</a>
            </nav>
          </details>

          <Link href="/" className="logo" aria-label={`${site.name} home`}>
            <LogoMark />
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span className="logo-word">INSI HOUSE</span>
              <span className="logo-urdu" dir="rtl" lang="ur" style={{ textAlign: "start" }}>{site.urdu}</span>
            </span>
          </Link>

          <nav className="nav desktop" aria-label="Main">
            {links.map((l) => (
              <Link key={l.label} href={l.href}>{l.label}</Link>
            ))}
          </nav>

          <div className="header-actions">
            <SearchButton items={searchItems} quick={quick} />
            <WishlistLink />
            <AccountLink />
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}

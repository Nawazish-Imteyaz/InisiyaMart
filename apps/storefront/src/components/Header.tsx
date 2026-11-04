import Link from "next/link";
import { LogoMark } from "./Logo";
import { ChatIcon, MenuIcon } from "./Icons";
import { CartButton } from "./CartButton";
import { site, whatsappLink } from "@/lib/site";
import { categories, shopLink } from "@/data/catalog";

const links = [
  { href: "/shop/", label: "Shop all" },
  ...categories.slice(0, 4).map((c) => ({ href: shopLink(c.slug), label: c.name })),
  { href: "/story/", label: "Our story" },
  { href: "/track/", label: "Track order", mobileOnly: true },
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
              {links.map((l) => (
                <Link key={l.label} href={l.href}>{l.label}</Link>
              ))}
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
            {links.filter((l) => !("mobileOnly" in l)).map((l) => (
              <Link key={l.label} href={l.href}>{l.label}</Link>
            ))}
          </nav>

          <div className="header-actions">
            <a className="btn btn-glow hide-sm" style={{ minBlockSize: 44, paddingInline: 18, fontSize: 14 }} href={whatsappLink("Hello Insi House! I'd like to order a gift.")} target="_blank" rel="noopener noreferrer">
              Order on WhatsApp
            </a>
            <a className="icon-btn" aria-label="Chat on WhatsApp" href={whatsappLink("Hello Insi House!")} target="_blank" rel="noopener noreferrer">
              <ChatIcon size={22} />
            </a>
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}

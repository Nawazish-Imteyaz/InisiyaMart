import Link from "next/link";
import { LogoMark } from "./Logo";
import { ChatIcon, MenuIcon } from "./Icons";
import { site, whatsappLink } from "@/lib/site";

const links = [
  { href: "/shop/", label: "Shop all" },
  { href: "/shop/", label: "Gifts for her" },
  { href: "/shop/", label: "Black pottery" },
  { href: "/shop/", label: "Silk & dupattas" },
  { href: "/shop/", label: "Gift sets" },
  { href: "/story/", label: "Our story" },
];

export function Header() {
  return (
    <>
      <div className="topbar">
        Preview website · <Link href="/designs/" style={{ color: "inherit", fontWeight: 700 }}>Help us choose the design →</Link>
      </div>
      <header className="header">
        <div className="container header-row" style={{ position: "relative" }}>
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
            {links.map((l) => (
              <Link key={l.label} href={l.href}>{l.label}</Link>
            ))}
          </nav>

          <div className="header-actions">
            <a className="btn hide-sm" style={{ minBlockSize: 44, paddingInline: 18, fontSize: 14 }} href={whatsappLink("Hello Insi House! I'd like to order a gift.")} target="_blank" rel="noopener noreferrer">
              Order on WhatsApp
            </a>
            <a className="icon-btn" aria-label="Chat on WhatsApp" href={whatsappLink("Hello Insi House!")} target="_blank" rel="noopener noreferrer">
              <ChatIcon size={22} />
            </a>
          </div>
        </div>
      </header>
    </>
  );
}

import Link from "next/link";
import { ChatIcon } from "./Icons";
import { site, whatsappLink } from "@/lib/site";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <span className="logo-word" style={{ color: "var(--ivory)", fontSize: 26 }}>INSI HOUSE</span>
            <span className="urdu" dir="rtl" lang="ur" style={{ color: "var(--gold)", fontSize: 16, textAlign: "start" }}>{site.urdu}</span>
            <span>{site.tagline}, delivered across the GCC.</span>
          </div>
          <nav className="footer-col" aria-label="Shop">
            <b>Shop</b>
            <Link href="/shop/">All gifts</Link>
            <Link href="/shop/">Black pottery</Link>
            <Link href="/shop/">Silk &amp; dupattas</Link>
            <Link href="/shop/">Gift sets</Link>
          </nav>
          <nav className="footer-col" aria-label="About">
            <b>About</b>
            <Link href="/story/">Our story</Link>
            <Link href="/story/">Meet the makers</Link>
            <Link href="/story/">The crafts of Azamgarh</Link>
          </nav>
          <div className="footer-col">
            <b>Order &amp; help</b>
            <span>We take orders on WhatsApp and send you a secure payment link.</span>
            <a className="btn btn-light" style={{ alignSelf: "flex-start", minBlockSize: 44, paddingInline: 20, fontSize: 14 }} href={whatsappLink("Hello Insi House!")} target="_blank" rel="noopener noreferrer">
              <ChatIcon size={18} /> Chat on WhatsApp
            </a>
            {site.email && <a href={`mailto:${site.email}`}>{site.email}</a>}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {site.name}</span>
          <span>Delivering to {site.countries.join(" · ")}</span>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { ChatIcon } from "./Icons";
import { site, whatsappLink } from "@/lib/site";
import { categories, shopLink } from "@/data/catalog";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <span className="logo-word" style={{ color: "#fff", fontSize: 26 }}>INSI HOUSE</span>
            <span className="urdu" dir="rtl" lang="ur" style={{ color: "var(--gold)", fontSize: 16, textAlign: "start" }}>{site.urdu}</span>
            <span>{site.tagline}. {site.delivery}.</span>
          </div>
          <nav className="footer-col" aria-label="Shop">
            <b>Shop</b>
            <Link href="/shop/">All gifts</Link>
            {categories.slice(0, 4).map((c) => <Link key={c.slug} href={shopLink(c.slug)}>{c.name}</Link>)}
          </nav>
          <nav className="footer-col" aria-label="About">
            <b>About</b>
            <Link href="/story/">Our story</Link>
            <Link href="/story/">Meet the makers</Link>
            <Link href="/story/">The crafts of Azamgarh</Link>
          </nav>
          <div className="footer-col">
            <b>Order &amp; help</b>
            <span>Order online or on WhatsApp and pay easily by UPI.</span>
            <Link href="/track/">Track your order</Link>
            <Link href="/policies/shipping-returns/">Shipping &amp; returns</Link>
            <Link href="/policies/privacy/">Privacy policy</Link>
            <Link href="/policies/terms/">Terms of sale</Link>
            <a className="btn btn-light" style={{ alignSelf: "flex-start", minBlockSize: 44, paddingInline: 20, fontSize: 14 }} href={whatsappLink("Hello Insi House!")} target="_blank" rel="noopener noreferrer">
              <ChatIcon size={18} /> Chat on WhatsApp
            </a>
            {site.email && <a href={`mailto:${site.email}`}>{site.email}</a>}
            {site.instagram && <a href={`https://instagram.com/${site.instagram}`} target="_blank" rel="noopener noreferrer">Instagram @{site.instagram}</a>}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {site.name} · Made with love in Azamgarh, Uttar Pradesh</span>
          <span>Pay by UPI · GPay · PhonePe · Paytm</span>
        </div>
      </div>
    </footer>
  );
}

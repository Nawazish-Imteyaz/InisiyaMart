import Link from "next/link";
import { site, whatsappLink } from "@/lib/site";

/** Shared layout for policy pages. `Todo` marks details the owner still has to confirm (TODO(owner)). */
export function Policy({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="container policy">
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link href="/">Home</Link> / {title}</nav>
      <h1 className="display">{title}</h1>
      <p className="muted">Last updated 4 November 2026</p>
      {children}
      <h2>Contact us</h2>
      <p>
        Questions about this page or your order: <a href={whatsappLink(`Hello ${site.name}! I have a question about your ${title.toLowerCase()}.`)} target="_blank" rel="noopener noreferrer">message us on WhatsApp</a>
        {site.email && <> or email <a href={`mailto:${site.email}`}>{site.email}</a></>}.
      </p>
      <p className="muted" style={{ fontSize: 14 }}>
        See also: <Link href="/policies/privacy/">Privacy policy</Link> · <Link href="/policies/shipping-returns/">Shipping &amp; returns</Link> · <Link href="/policies/terms/">Terms of sale</Link>
      </p>
    </article>
  );
}

export function Todo({ children }: { children: React.ReactNode }) {
  return <span className="todo">{children}</span>;
}

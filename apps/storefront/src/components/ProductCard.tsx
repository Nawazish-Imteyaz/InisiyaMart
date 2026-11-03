import Link from "next/link";
import { formatPrice, type Product } from "@/data/catalog";

export function ProductCard({ p }: { p: Product }) {
  const href = `/product/${p.slug}/`;
  return (
    <div className="product">
      <Link href={href} className={`product-media ph tone-${p.tone}`} aria-label={p.name}>
        <span className="badge">{p.badge}</span>
        <span>[{p.name} photo]</span>
      </Link>
      <Link href={href} className="product-name">{p.name}</Link>
      <span className="muted" style={{ fontSize: 13, marginBlockStart: -4 }}>{p.craft} · {p.collection}</span>
      <span className="product-price">{formatPrice(p)}</span>
    </div>
  );
}

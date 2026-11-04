import Link from "next/link";
import { formatInr, formatPrice, type Product } from "@/data/catalog";
import { ProductArt } from "./ProductArt";

const darkTones = new Set(["ink", "plum", "dusty"]);

export function ProductCard({ p }: { p: Product }) {
  const href = `/product/${p.slug}/`;
  const photo = p.images[0];
  return (
    <div className={`product${p.inStock ? "" : " is-out"}`}>
      <Link href={href} className={`product-media tone-${p.tone}`} aria-label={p.name}>
        <span className="badge">{p.inStock ? p.badge : "Out of stock"}</span>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="product-photo" src={photo} alt="" loading="lazy" decoding="async" />
        ) : (
          <>
            <ProductArt art={p.art} size={130} light={darkTones.has(p.tone)} />
            <span className="ph-label">photo coming soon</span>
          </>
        )}
      </Link>
      <Link href={href} className="product-name">{p.name}</Link>
      <span className="muted" style={{ fontSize: 13, marginBlockStart: -4 }}>{p.craft}{p.collection ? ` · ${p.collection}` : ""}</span>
      <span className="product-price">
        {formatPrice(p)}
        {p.mrpInr !== null && p.priceInr !== null && p.mrpInr > p.priceInr && (
          <s className="muted" style={{ fontSize: 13, fontWeight: 600, marginInlineStart: 8 }}>{formatInr(p.mrpInr)}</s>
        )}
      </span>
    </div>
  );
}

import Link from "next/link";
import { formatInr, formatPrice, HOUSE_MAKER_SLUG, productLink, type Product } from "@/data/catalog";
import { ProductArt } from "./ProductArt";
import { WishButton } from "./WishButton";

const darkTones = new Set(["ink", "plum", "dusty"]);

export function offPercent(p: Product): number {
  return p.mrpInr !== null && p.priceInr !== null && p.mrpInr > p.priceInr ? Math.round(((p.mrpInr - p.priceInr) / p.mrpInr) * 100) : 0;
}

export function ProductCard({ p }: { p: Product }) {
  const href = productLink(p.slug);
  const photo = p.images[0];
  const off = offPercent(p);
  return (
    <div className={`product${p.inStock ? "" : " is-out"}`}>
      <Link href={href} className={`product-media tone-${p.tone}`} aria-label={p.name}>
        <span className="badge">{p.inStock ? p.badge : "Out of stock"}</span>
        {photo && p.images[1] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="product-photo alt" src={p.images[1]} alt="" loading="lazy" decoding="async" />
        )}
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
      <WishButton slug={p.slug} name={p.name} />
      <Link href={href} className="product-name">{p.name}</Link>
      <span className="muted" style={{ fontSize: 13, marginBlockStart: -4 }}>
        {p.maker && p.maker.slug !== HOUSE_MAKER_SLUG ? <>by {p.maker.shop}{p.maker.district ? ` · ${p.maker.district}` : ""}</> : <>{p.craft}{p.collection ? ` · ${p.collection}` : ""}</>}
      </span>
      <span className="product-price">
        {formatPrice(p)}
        {p.mrpInr !== null && p.priceInr !== null && p.mrpInr > p.priceInr && (
          <s className="muted" style={{ fontSize: 13, fontWeight: 600, marginInlineStart: 8 }}>{formatInr(p.mrpInr)}</s>
        )}
        {off > 0 && <span className="off">{off}% off</span>}
      </span>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ShopGrid } from "./ShopGrid";

export const metadata: Metadata = { title: "Shop handmade gifts" };

export default function ShopPage() {
  return (
    <div className="container" style={{ paddingBlockEnd: 72 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link href="/">Home</Link> / Shop</nav>
      <div className="tone-blush" style={{ borderRadius: 24, padding: "36px 32px", marginBlockEnd: 28 }}>
        <h1 className="display" style={{ fontSize: "clamp(38px, 5vw, 52px)", color: "var(--ink)" }}>Gifts for her</h1>
        <p style={{ margin: "8px 0 0", maxInlineSize: 640, lineHeight: 1.6 }}>
          For sisters, mothers, friends and you. Silk she&apos;ll wear, décor she&apos;ll keep, and gift sets she&apos;ll remember.
        </p>
      </div>
      <ShopGrid />
    </div>
  );
}

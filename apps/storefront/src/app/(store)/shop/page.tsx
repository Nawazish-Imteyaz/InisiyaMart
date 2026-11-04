import type { Metadata } from "next";
import Link from "next/link";
import { ShopGrid } from "./ShopGrid";
import { categories, products } from "@/data/catalog";

export const metadata: Metadata = { title: "Shop handmade gifts" };

export default function ShopPage() {
  return (
    <div className="container" style={{ paddingBlockEnd: 80 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link href="/">Home</Link> / Shop</nav>
      <div className="cta" style={{ marginBlockEnd: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxInlineSize: 680 }}>
          <span className="eyebrow">Handmade in Azamgarh · Delivered across India</span>
          <h1 className="display" style={{ fontSize: "clamp(40px, 5.5vw, 60px)" }}>
            Gifts for <span className="grad-text">her</span>, and everyone you love
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6, fontSize: 17 }}>
            Silk she&apos;ll wear, décor she&apos;ll keep, and hampers she&apos;ll remember. For sisters, mothers, friends and teachers.
          </p>
        </div>
      </div>
      <ShopGrid products={products} categories={categories} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { products } from "@/data/catalog";
import { Wishlist } from "../account/AccountApp";

export const metadata: Metadata = { title: "My wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="container" style={{ paddingBlockEnd: 80 }}>
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link href="/">Home</Link> / Wishlist</nav>
      <Wishlist products={products} />
      <p className="muted" style={{ marginBlockStart: 28 }}><Link href="/account/">Log in</Link> to keep your wishlist on every phone and computer.</p>
    </div>
  );
}

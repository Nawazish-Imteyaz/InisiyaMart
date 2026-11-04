import type { Metadata } from "next";
import { products, settings } from "@/data/catalog";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container" style={{ paddingBlock: "32px 80px" }}>
      <CartView products={products} settings={settings} />
    </div>
  );
}

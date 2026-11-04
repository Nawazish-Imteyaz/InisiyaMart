import type { Metadata } from "next";
import { products, settings } from "@/data/catalog";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container" style={{ paddingBlock: "32px 80px" }}>
      <CheckoutForm products={products} settings={settings} />
    </div>
  );
}

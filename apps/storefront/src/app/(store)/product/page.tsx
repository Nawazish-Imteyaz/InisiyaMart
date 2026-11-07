import type { Metadata } from "next";
import { Suspense } from "react";
import { products } from "@/data/catalog";
import { ProductView } from "./ProductView";

// One page for every product (marketplace: sellers add products all day, so pages load live: /product/?s=<slug>).
// Old links /product/<slug>/ are redirected here by functions/product/[slug].ts, which also sets the title for Google.
export const metadata: Metadata = { title: "Handmade gift" };

export default function ProductPage() {
  return (
    <Suspense>
      <ProductView fallback={products} />
    </Suspense>
  );
}

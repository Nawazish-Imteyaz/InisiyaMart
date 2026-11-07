import type { Metadata } from "next";
import { Suspense } from "react";
import { MakerView } from "./MakerView";

// A maker's shop: /maker/?s=<shop-slug>. Loads live so new products show at once.
export const metadata: Metadata = { title: "Maker shop" };

export default function MakerPage() {
  return <Suspense><MakerView /></Suspense>;
}

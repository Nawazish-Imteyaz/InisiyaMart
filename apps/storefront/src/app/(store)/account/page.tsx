import type { Metadata } from "next";
import { products } from "@/data/catalog";
import { AccountApp } from "./AccountApp";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="container" style={{ paddingBlock: "28px 80px" }}>
      <AccountApp products={products} />
    </div>
  );
}

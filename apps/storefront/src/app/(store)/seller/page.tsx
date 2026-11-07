import type { Metadata } from "next";
import { SellerApp } from "./SellerApp";

export const metadata: Metadata = { title: "Seller dashboard", robots: { index: false } };

export default function SellerPage() {
  return (
    <div className="container" style={{ paddingBlock: "24px 80px" }}>
      <SellerApp />
    </div>
  );
}

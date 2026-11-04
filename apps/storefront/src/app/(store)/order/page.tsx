import type { Metadata } from "next";
import { OrderStatus } from "./OrderStatus";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default function OrderPage() {
  return (
    <div className="container" style={{ paddingBlock: "32px 80px" }}>
      <OrderStatus mode="placed" />
    </div>
  );
}

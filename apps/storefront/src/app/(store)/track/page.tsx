import type { Metadata } from "next";
import { OrderStatus } from "../order/OrderStatus";

export const metadata: Metadata = { title: "Track your order", description: "Track your Insi House order with your order number and mobile number." };

export default function TrackPage() {
  return (
    <div className="container" style={{ paddingBlock: "32px 80px" }}>
      <OrderStatus mode="track" />
    </div>
  );
}

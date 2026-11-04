import type { Metadata } from "next";
import { Policy, Todo } from "../Policy";

export const metadata: Metadata = { title: "Shipping & returns" };

export default function ShippingReturns() {
  return (
    <Policy title="Shipping & returns">
      <h2>Delivery across India</h2>
      <ul>
        <li>We deliver to PIN codes across India through trusted courier partners, with a tracking number.</li>
        <li>Every gift is packed by hand. Fragile pieces like pottery are double-boxed.</li>
        <li>Dispatch time: <Todo>[e.g. within 2–4 working days, owner to confirm]</Todo>. Personalised items may take longer; we tell you before you pay.</li>
        <li>Delivery charges are shown at checkout, or confirmed with you on WhatsApp before you pay.</li>
        <li>Track your parcel any time on the <a href="/track/">Track your order</a> page.</li>
      </ul>

      <h2>Handmade, so each piece is unique</h2>
      <p>Our products are made by hand in Azamgarh. Small differences in colour, etching or weave from the photos are natural and are not defects.</p>

      <h2>Damaged in transit</h2>
      <p>If your gift arrives damaged, message us on WhatsApp with photos of the parcel and the item within <Todo>[e.g. 48 hours, owner to confirm]</Todo> of delivery. <Todo>[What we offer: replacement or refund, owner to confirm]</Todo>.</p>

      <h2>Returns and cancellations</h2>
      <ul>
        <li>Cancel before dispatch: <Todo>[full refund? owner to confirm]</Todo>.</li>
        <li>Returns after delivery: <Todo>[allowed or not, time window, who pays return shipping: owner to confirm]</Todo>.</li>
        <li>Personalised items cannot be returned unless they arrive damaged or wrong.</li>
        <li>Refunds go back to the UPI account you paid from, within <Todo>[number of days, owner to confirm]</Todo>.</li>
      </ul>
    </Policy>
  );
}

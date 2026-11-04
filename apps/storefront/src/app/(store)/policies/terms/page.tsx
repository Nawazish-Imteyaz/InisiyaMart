import type { Metadata } from "next";
import { Policy, Todo } from "../Policy";

export const metadata: Metadata = { title: "Terms of sale" };

export default function Terms() {
  return (
    <Policy title="Terms of sale">
      <h2>Who we are</h2>
      <p>Insi House is run by our family in Azamgarh, Uttar Pradesh, India. Business name and address: <Todo>[owner to add]</Todo>. GSTIN: <Todo>[owner to add, if registered]</Todo>.</p>

      <h2>Prices and payment</h2>
      <ul>
        <li>All prices are in Indian Rupees (₹) and include GST where it applies.</li>
        <li>You pay by UPI after placing the order. Your order is confirmed once we receive the payment, or when we agree cash on delivery with you.</li>
        <li>If a price on the website is wrong, we will tell you before you pay, and you can cancel.</li>
      </ul>

      <h2>Orders</h2>
      <ul>
        <li>Placing an order is an offer to buy. We confirm it on WhatsApp or by phone.</li>
        <li>Stock is limited because every piece is handmade. If something sells out after you order, we will offer a similar piece or a full refund.</li>
        <li>Delivery, returns and refunds follow our <a href="/policies/shipping-returns/">Shipping &amp; returns</a> policy.</li>
      </ul>

      <h2>Photos and designs</h2>
      <p>Photos, text and designs on this website belong to Insi House. Please ask before using them.</p>
    </Policy>
  );
}

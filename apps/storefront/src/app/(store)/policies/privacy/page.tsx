import type { Metadata } from "next";
import { Policy, Todo } from "../Policy";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <Policy title="Privacy policy">
      <p>Insi House is a family business in Azamgarh, Uttar Pradesh. We collect only what we need to make and deliver your gift, and we never sell your details. This policy follows India&apos;s Digital Personal Data Protection Act, 2023.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>When you order:</b> your name, mobile number, delivery address, city, state and PIN code, and optionally your email.</li>
        <li><b>Your order:</b> the gifts you choose, your gift message and notes, and the UPI reference number if you send it to us.</li>
        <li><b>Basic technical data:</b> your device&apos;s IP address with each order, used only to stop spam orders.</li>
        <li><b>On your own device:</b> your cart and delivery details are saved in your browser so you don&apos;t retype them. You can clear them from your browser settings at any time.</li>
      </ul>
      <p>We do not use advertising or tracking cookies.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>To make, pack and deliver your order, and to write your gift card.</li>
        <li>To send you order updates on WhatsApp or by phone.</li>
        <li>To check your payment and keep the records Indian tax law (GST) requires.</li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li><b>Courier partners</b> (for example Delhivery, DTDC or India Post) receive your name, phone and address to deliver your parcel.</li>
        <li><b>Payments</b> happen in your own UPI app. We never see your bank details or UPI PIN.</li>
        <li><b>Hosting:</b> our website and order records are stored securely with Cloudflare.</li>
        <li>Government authorities, only when the law requires it.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>Order records are kept for as long as Indian tax and consumer law requires. After that we delete them. Spam-check data (IP address) is not used for anything else.</p>

      <h2>Your rights</h2>
      <p>You can ask us to show, correct or delete your personal data, or withdraw your consent, by messaging us on WhatsApp. We reply within <Todo>[number of days, to be confirmed]</Todo>. We may need to keep order records the law requires.</p>

      <h2>Grievance officer</h2>
      <p>Name: <Todo>[owner to add]</Todo> · Contact: <Todo>[phone / email, owner to add]</Todo>.</p>
    </Policy>
  );
}

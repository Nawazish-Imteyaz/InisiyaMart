import type { Metadata } from "next";
import Link from "next/link";
import { whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sell your handmade work",
  description: "Open your free shop on Insi House. 0% commission. Sell your handmade work to buyers across India, from your phone.",
};

const STEPS = [
  ["📱", "Log in with your mobile number", "No email needed."],
  ["🏪", "Name your shop", "Tell buyers what you make and where you are from."],
  ["📷", "Add your first product", "2–3 photos from your phone, a price, done."],
  ["💸", "Add your UPI ID", "Buyers pay you directly. 0% commission."],
  ["✅", "We check and open your shop", "Usually within 1–2 days."],
];

export default function SellPage() {
  return (
    <div className="container" style={{ paddingBlock: "32px 80px" }}>
      <section className="sell-hero">
        <p className="eyebrow">For makers across India</p>
        <h1 className="display">Your hands make magic.<br />Let India buy it.</h1>
        <p className="lead">Embroidery, pottery, crochet, paintings, jewellery, home décor… If you make it by hand, you can sell it on Insi House: free, simple, from your phone.</p>
        <div className="row-btns">
          <Link href="/seller/" className="btn btn-glow">Open my free shop →</Link>
          <a className="btn btn-outline" href={whatsappLink("Hello Insi House! I want to sell my handmade products. Please help me open a shop.")} target="_blank" rel="noopener noreferrer">Need help? WhatsApp us</a>
        </div>
        <ul className="sell-points">
          <li><b>0%</b> commission</li>
          <li><b>5 min</b> to open a shop</li>
          <li><b>Private</b> phone & address</li>
          <li><b>Handmade</b> only</li>
        </ul>
      </section>
      <section style={{ paddingBlockStart: 56 }}>
        <div className="section-head"><h2 className="display">How it works</h2></div>
        <ol className="sell-steps">
          {STEPS.map(([icon, title, text]) => <li key={title}><span aria-hidden="true">{icon}</span><b>{title}</b><small>{text}</small></li>)}
        </ol>
      </section>
      <section className="sell-who">
        <h2 className="display">Who can sell?</h2>
        <p>Women and girls working from home, students, artisans in villages and cities, self-help groups and craft families. GST is <b>not</b> needed to start. If you can make it by hand and take a photo, you can sell.</p>
        <Link href="/seller/" className="btn btn-glow">Start now →</Link>
      </section>
    </div>
  );
}

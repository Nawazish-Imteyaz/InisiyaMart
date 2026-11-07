"use client";

import { useState } from "react";
import { formatInr, settings } from "@/data/catalog";
import { isLocalPin } from "@/lib/live";

// Stage A: validates the PIN code and explains delivery. Real serviceability + dates come with Shiprocket (Stage B).
export function PincodeCheck() {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^[1-9][0-9]{5}$/.test(pin)) {
      if (isLocalPin(settings, pin)) {
        const free = settings.local_free_above ? ` Free above ${formatInr(Number(settings.local_free_above))}.` : "";
        const fee = Number(settings.local_fee) === 0 ? "Free delivery." : `Delivery ${formatInr(Number(settings.local_fee))}.${free}`;
        setMsg({ ok: true, text: `🛵 ${settings.local_label || "Our own delivery team"} delivers to ${pin}. ${fee}` });
      } else {
        const fee = settings.shipping_fee === "" ? "The delivery charge is shown at checkout." : Number(settings.shipping_fee) === 0 ? "Free delivery." : `Delivery ${formatInr(Number(settings.shipping_fee))}${settings.free_shipping_above ? `, free above ${formatInr(Number(settings.free_shipping_above))}` : ""}.`;
        setMsg({ ok: true, text: `🚚 We deliver to ${pin} by courier, with tracking. ${fee} Your delivery date is confirmed when you order.` });
      }
    } else {
      setMsg({ ok: false, text: "Please enter a valid 6-digit PIN code." });
    }
  };

  return (
    <form className="infobox" onSubmit={check}>
      <label htmlFor="pin" style={{ fontWeight: 800 }}>Check delivery to your PIN code</label>
      <div className="field-row">
        <input id="pin" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="e.g. 276001" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <button type="submit" className="btn" style={{ minBlockSize: 48, paddingInline: 20 }}>Check</button>
      </div>
      {msg && (
        <span role="status" style={{ color: msg.ok ? "var(--peacock)" : "var(--rani)", fontWeight: 700 }}>
          {msg.text}
        </span>
      )}
    </form>
  );
}

"use client";

// Shopping cart kept in the customer's browser (localStorage). The server re-checks prices and stock at checkout.
import { useEffect, useState } from "react";

export interface CartLine { slug: string; qty: number }
const KEY = "ih-cart-v1";
const EVENT = "ih-cart";
export const MAX_QTY = 10;

function read(): CartLine[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((l) => typeof l?.slug === "string" && Number.isInteger(l?.qty) && l.qty > 0).slice(0, 20) : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* private mode: cart lasts this page only */ }
  window.dispatchEvent(new Event(EVENT));
}

export const cart = {
  get: read,
  add(slug: string, qty = 1) {
    const lines = read();
    const l = lines.find((x) => x.slug === slug);
    if (l) l.qty = Math.min(MAX_QTY, l.qty + qty);
    else lines.push({ slug, qty: Math.min(MAX_QTY, qty) });
    write(lines);
  },
  set(slug: string, qty: number) {
    write(qty <= 0 ? read().filter((l) => l.slug !== slug) : read().map((l) => (l.slug === slug ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)));
  },
  clear() { write([]); },
};

/** Cart lines, kept in sync across tabs and components. `ready` is false until the browser copy is read. */
export function useCart(): { lines: CartLine[]; ready: boolean; count: number } {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setLines(read());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return { lines, ready, count: lines.reduce((s, l) => s + l.qty, 0) };
}

/** Last placed order, so the confirmation page can show it after checkout. */
export interface PlacedOrder { number: string; phone: string; total: number; shipping: number | null; upi_id: string }
export function saveLastOrder(o: PlacedOrder) {
  try { sessionStorage.setItem("ih-last-order", JSON.stringify(o)); } catch { /* ignore */ }
}
export function readLastOrder(): PlacedOrder | null {
  try { return JSON.parse(sessionStorage.getItem("ih-last-order") ?? "null"); } catch { return null; }
}

/** upi:// link that opens GPay / PhonePe / Paytm with the amount filled in. */
export function upiLink(upiId: string, amount: number, orderNumber: string): string {
  const p = new URLSearchParams({ pa: upiId, pn: "Insi House", am: amount.toFixed(2), cu: "INR", tn: `Order ${orderNumber}` });
  return `upi://pay?${p.toString().replace(/\+/g, "%20")}`;
}

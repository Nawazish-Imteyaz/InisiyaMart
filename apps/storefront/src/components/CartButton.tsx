"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart/" className="icon-btn cart-btn" aria-label={ready && count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </svg>
      {ready && count > 0 && <span className="cart-count">{count > 9 ? "9+" : count}</span>}
    </Link>
  );
}

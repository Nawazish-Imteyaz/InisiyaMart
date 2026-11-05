"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cart, MAX_QTY } from "@/lib/cart";

export function AddToCart({ slug, name, price }: { slug: string; name: string; price?: string }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function add() {
    cart.add(slug, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }
  const buyNow = () => { cart.add(slug, qty); router.push("/checkout/"); };

  return (
    <>
      <div className="buy-box">
        <div className="qty" role="group" aria-label={`Quantity of ${name}`}>
          <button type="button" aria-label="One less" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span aria-live="polite">{qty}</span>
          <button type="button" aria-label="One more" disabled={qty >= MAX_QTY} onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}>+</button>
        </div>
        <button type="button" className="btn btn-outline buy-add" onClick={add}>{added ? "✓ Added to cart" : "Add to cart"}</button>
        <button type="button" className="btn btn-glow buy-now" onClick={buyNow}>Buy now</button>
        {added && <a href="/cart/" className="buy-view" role="status">View cart →</a>}
      </div>
      {/* Phones: always-visible buy bar at the bottom of the screen. */}
      <div className="buy-sticky" aria-hidden="false">
        {price && <span className="bs-price">{price}</span>}
        <button type="button" className="btn btn-outline" onClick={add}>{added ? "✓ Added" : "Add to cart"}</button>
        <button type="button" className="btn btn-glow" onClick={buyNow}>Buy now</button>
      </div>
    </>
  );
}

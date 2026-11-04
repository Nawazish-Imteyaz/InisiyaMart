"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cart, MAX_QTY } from "@/lib/cart";

export function AddToCart({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function add() {
    cart.add(slug, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="buy-box">
      <div className="qty" role="group" aria-label={`Quantity of ${name}`}>
        <button type="button" aria-label="One less" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
        <span aria-live="polite">{qty}</span>
        <button type="button" aria-label="One more" onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}>+</button>
      </div>
      <button type="button" className="btn btn-outline buy-add" onClick={add}>{added ? "✓ Added to cart" : "Add to cart"}</button>
      <button type="button" className="btn btn-glow buy-now" onClick={() => { cart.add(slug, qty); router.push("/checkout/"); }}>Buy now</button>
      {added && (
        <a href="/cart/" className="buy-view" role="status">View cart →</a>
      )}
    </div>
  );
}

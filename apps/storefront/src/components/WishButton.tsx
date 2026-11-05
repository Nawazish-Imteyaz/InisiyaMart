"use client";

import { useEffect, useState } from "react";
import { wishlist, WISH_EVENT } from "@/lib/wishlist";

/** ♥ toggle used on product cards and the product page. */
export function WishButton({ slug, name, big }: { slug: string; name: string; big?: boolean }) {
  const [on, setOn] = useState(false);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    const sync = () => setOn(wishlist.has(slug));
    sync();
    window.addEventListener(WISH_EVENT, sync);
    return () => window.removeEventListener(WISH_EVENT, sync);
  }, [slug]);
  return (
    <button
      type="button"
      className={`wish-btn${on ? " on" : ""}${pop ? " pop" : ""}${big ? " big" : ""}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      title={on ? "Saved to wishlist" : "Save to wishlist"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = wishlist.toggle(slug);
        setOn(now);
        if (now) { setPop(true); window.setTimeout(() => setPop(false), 450); }
      }}
    >
      <svg width={big ? 24 : 20} height={big ? 24 : 20} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      </svg>
      {big && <span>{on ? "Saved" : "Save"}</span>}
    </button>
  );
}

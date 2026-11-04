"use client";

// Latest prices, stock and settings straight from the database (the static pages can be ~3 minutes old).
import { useEffect, useState } from "react";
import type { Product, Settings } from "@/data/catalog";

export function useLiveCatalog(initial: { products: Product[]; settings: Settings }) {
  const [data, setData] = useState(initial);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.source === "live") {
          setData({ products: d.products, settings: { ...initial.settings, ...Object.fromEntries(Object.entries(d.settings ?? {}).filter(([, v]) => v !== "")) } });
          setLive(true);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ...data, live };
}

/** Delivery charge for a subtotal, or null when the shop hasn't set one (then it's confirmed on WhatsApp). */
export function shippingFor(settings: Settings, subtotal: number): number | null {
  if (settings.shipping_fee === "") return null;
  if (settings.free_shipping_above !== "" && subtotal >= Number(settings.free_shipping_above)) return 0;
  return Number(settings.shipping_fee);
}

"use client";

// Wishlist (♥) and recently viewed gifts, kept on this device. When logged in, the wishlist also syncs to the account.
import { useEffect, useState } from "react";

const WISH = "ih-wish-v1";
const RECENT = "ih-recent-v1";
export const WISH_EVENT = "ih-wish";

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((s) => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s)) : [];
  } catch {
    return [];
  }
}
function writeList(key: string, list: string[], event?: string) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* private mode */ }
  if (event) window.dispatchEvent(new Event(event));
}

export const wishlist = {
  get: () => readList(WISH),
  has: (slug: string) => readList(WISH).includes(slug),
  toggle(slug: string): boolean {
    const list = readList(WISH);
    const on = !list.includes(slug);
    writeList(WISH, on ? [slug, ...list].slice(0, 100) : list.filter((s) => s !== slug), WISH_EVENT);
    return on;
  },
  replace(list: string[]) { writeList(WISH, list.slice(0, 100), WISH_EVENT); },
};

export function useWishlist(): { list: string[]; ready: boolean } {
  const [list, setList] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setList(readList(WISH));
    sync();
    setReady(true);
    window.addEventListener(WISH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(WISH_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return { list, ready };
}

export const recent = {
  get: () => readList(RECENT),
  add(slug: string) { writeList(RECENT, [slug, ...readList(RECENT).filter((s) => s !== slug)].slice(0, 12)); },
};

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { firstName, useAccount } from "@/lib/account";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";

export interface SearchItem { slug: string; name: string; craft: string; price: string; image: string | null; words: string }
export interface QuickLink { label: string; href: string }

const I = {
  search: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.6-4.6" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  home: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  spark: <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />,
  bag: <><path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
};
const Svg = ({ d, size = 22 }: { d: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

function score(it: SearchItem, words: string[]): number {
  const name = it.name.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (name.startsWith(w)) s += 6;
    else if (name.includes(w)) s += 4;
    else if (it.craft.toLowerCase().includes(w)) s += 2;
    else if (it.words.includes(w)) s += 1;
    else return 0;
  }
  return s;
}

/** Search button + instant results dialog. */
export function SearchButton({ items, quick }: { items: SearchItem[]; quick: QuickLink[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => (words.length ? items.map((it) => ({ it, s: score(it, words) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.it) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, items]);

  function open() {
    ref.current?.showModal();
    window.setTimeout(() => input.current?.focus(), 30);
  }
  function close() { ref.current?.close(); }
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.key === "/" && !(e.target as HTMLElement)?.closest?.("input,textarea,select")) || (e.key === "k" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); open(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <>
      <button type="button" className="icon-btn" aria-label="Search gifts" onClick={open}><Svg d={I.search} /></button>
      <dialog ref={ref} className="search-dialog" aria-label="Search gifts" onClick={(e) => { if (e.target === ref.current) close(); }}>
        <form className="search-bar" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { close(); router.push(`/shop/?q=${encodeURIComponent(q.trim())}`); } }}>
          <Svg d={I.search} />
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pottery, dupattas, haldi gifts…" aria-label="Search" autoComplete="off" enterKeyHint="search" />
          <button type="button" className="link-btn" onClick={close}>Close</button>
        </form>
        <div className="search-body">
          {words.length === 0 ? (
            <>
              <p className="search-label">Popular</p>
              <div className="search-quick">
                {quick.map((l) => <Link key={l.href} href={l.href} onClick={close} className="chip-link">{l.label}</Link>)}
              </div>
            </>
          ) : results.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No gifts match “{q}”. Try another word, or <a href="/events/" onClick={close}>ask us for a custom piece</a>.</p>
          ) : (
            <ul className="search-results">
              {results.map((r) => (
                <li key={r.slug}>
                  <Link href={`/product/${r.slug}/`} onClick={close}>
                    <span className="sr-thumb">{r.image ? <img src={r.image} alt="" loading="lazy" /> : <Svg d={I.spark} />}</span>
                    <span className="sr-text"><b>{r.name}</b><small>{r.craft}</small></span>
                    <span className="sr-price">{r.price}</span>
                  </Link>
                </li>
              ))}
              <li><Link href={`/shop/?q=${encodeURIComponent(q.trim())}`} onClick={close} className="sr-all">See all results for “{q.trim()}” →</Link></li>
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}

export function WishlistLink() {
  const { list, ready } = useWishlist();
  const n = ready ? list.length : 0;
  return (
    <Link href="/wishlist/" className="icon-btn cart-btn hide-xs" aria-label={n ? `Wishlist, ${n} saved` : "Wishlist"}>
      <Svg d={I.heart} />
      {n > 0 && <span className="cart-count">{n > 9 ? "9+" : n}</span>}
    </Link>
  );
}

export function AccountLink() {
  const { me, ready } = useAccount();
  return (
    <Link href="/account/" className={`account-link${me ? " in" : ""}`} aria-label={me ? "My account" : "Log in"}>
      <Svg d={I.user} />
      <span className="account-text">{!ready ? "" : me ? (firstName(me) || "Account") : "Login"}</span>
    </Link>
  );
}

/** Bottom tab bar on phones (like Flipkart / Meesho). */
export function MobileNav() {
  const path = usePathname() ?? "/";
  const { count } = useCart();
  const { me } = useAccount();
  const tabs = [
    { href: "/", label: "Home", icon: I.home, on: path === "/" },
    { href: "/shop/", label: "Shop", icon: I.grid, on: path.startsWith("/shop") || path.startsWith("/product") },
    { href: "/occasions/", label: "Occasions", icon: I.spark, on: path.startsWith("/occasion") || path.startsWith("/events") },
    { href: "/account/", label: me ? "Account" : "Login", icon: I.user, on: path.startsWith("/account") || path.startsWith("/wishlist") },
    { href: "/cart/", label: "Cart", icon: I.bag, on: path.startsWith("/cart") || path.startsWith("/checkout"), badge: count },
  ];
  if (path.startsWith("/checkout")) return null;
  return (
    <nav className="mobile-tabs" aria-label="Quick links">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={t.on ? "on" : ""} aria-current={t.on ? "page" : undefined}>
          <span className="tab-icon"><Svg d={t.icon} size={22} />{t.badge ? <span className="cart-count">{t.badge > 9 ? "9+" : t.badge}</span> : null}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

"use client";

// Keeps the cart and wishlist the same on every device the customer logs in from.
import { useEffect, useRef } from "react";
import { accountApi, useAccount } from "@/lib/account";
import { cart, CART_EVENT, type CartLine } from "@/lib/cart";
import { wishlist, WISH_EVENT } from "@/lib/wishlist";

export function AccountSync() {
  const { me, ready } = useAccount();
  const mergedFor = useRef<number | null>(null);
  const quiet = useRef(false);

  // Just logged in (or opened a page while logged in): merge this device with the account.
  useEffect(() => {
    if (!ready) return;
    if (!me) { mergedFor.current = null; return; }
    if (mergedFor.current === me.id) return;
    mergedFor.current = me.id;
    quiet.current = true;
    accountApi<{ cart: CartLine[]; wishlist: string[] }>("sync", { body: { cart: cart.get(), wishlist: wishlist.get(), merge: true } })
      .then((r) => { cart.replace(r.cart); wishlist.replace(r.wishlist); })
      .catch(() => {})
      .finally(() => window.setTimeout(() => { quiet.current = false; }, 100));
  }, [me, ready]);

  // Any change on this device is saved to the account (debounced).
  useEffect(() => {
    if (!me) return;
    let t: number | undefined;
    const push = () => {
      if (quiet.current) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => { accountApi("sync", { body: { cart: cart.get(), wishlist: wishlist.get() } }).catch(() => {}); }, 900);
    };
    window.addEventListener(CART_EVENT, push);
    window.addEventListener(WISH_EVENT, push);
    return () => { window.clearTimeout(t); window.removeEventListener(CART_EVENT, push); window.removeEventListener(WISH_EVENT, push); };
  }, [me]);

  // Logged out: don't leave the account's cart and wishlist on a shared phone.
  useEffect(() => {
    const out = () => { quiet.current = true; cart.clear(); wishlist.replace([]); window.setTimeout(() => { quiet.current = false; }, 100); };
    window.addEventListener("ih-logout", out);
    return () => window.removeEventListener("ih-logout", out);
  }, []);

  return null;
}

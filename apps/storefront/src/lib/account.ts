"use client";

// The logged-in customer (if any), shared by every component on the page.
// The login itself is a secure HttpOnly cookie that page scripts can never read; we only ask /api/account who it is.
import { useEffect, useState } from "react";

export interface Me {
  id: number; phone: string; verified: boolean; name: string; email: string; marketing: boolean; hasPassword: boolean; since: string;
}
interface State { me: Me | null; otp: "whatsapp" | "sms" | null; ready: boolean }

let state: State = { me: null, otp: null, ready: false };
let loading: Promise<void> | null = null;
const listeners = new Set<(s: State) => void>();
const set = (s: Partial<State>) => { state = { ...state, ...s }; listeners.forEach((l) => l(state)); };

export class AccountError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** JSON call to /api/account/<path> (same origin, cookie sent automatically). */
export async function accountApi<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/account${path ? `/${path}` : ""}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined || (opts.method && opts.method !== "GET") ? { "content-type": "application/json" } : {},
      body: opts.body !== undefined ? JSON.stringify(opts.body) : opts.method && opts.method !== "GET" ? "{}" : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new AccountError(0, "No internet connection. Please check and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401 && path !== "login" && state.me) set({ me: null });
  if (!res.ok) throw new AccountError(res.status, typeof data.error === "string" ? data.error : res.status === 404 ? "Accounts are not available on this preview." : `Error ${res.status}`);
  return data as T;
}

export function loadAccount(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = accountApi<{ customer: Me | null; otp: State["otp"] }>("")
    .then((r) => set({ me: r.customer, otp: r.otp, ready: true }))
    .catch(() => set({ ready: true }));
  return loading;
}

export function setMe(me: Me | null) {
  set({ me, ready: true });
  window.dispatchEvent(new Event(me ? "ih-login" : "ih-logout"));
}

export async function logout() {
  try { await accountApi("logout", { method: "POST" }); } catch { /* ignore */ }
  setMe(null);
}

export function useAccount(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    loadAccount();
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export function firstName(me: Me | null): string {
  return (me?.name || "").trim().split(/\s+/)[0] || "";
}

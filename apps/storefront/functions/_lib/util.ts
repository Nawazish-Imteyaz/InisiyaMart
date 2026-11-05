// Shared helpers for Cloudflare Pages Functions (server side).

// ---------- Minimal Cloudflare types (avoids an extra dependency) ----------
export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  meta: { last_row_id?: number; changes?: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
export interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}
export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  DEPLOY_HOOK_URL?: string;
  /** 64 hex chars (32 bytes). Encrypts partner keys saved in the admin. Set as a Cloudflare Pages secret. */
  SECRETS_KEY?: string;
}

export interface Ctx {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil(promise: Promise<unknown>): void;
}

// ---------- Responses & errors ----------
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
      "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      ...headers,
    },
  });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
}

// ---------- Input parsing ----------
export function str(v: unknown, max: number, field = "Field", required = false): string {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  if (required && !s) throw new HttpError(400, `${field} is required`);
  if (s.length > max) throw new HttpError(400, `${field} is too long (max ${max} characters)`);
  return s;
}

export function int(v: unknown, field: string, opts: { min?: number; max?: number; nullable?: boolean } = {}): number | null {
  if (v === null || v === undefined || v === "") {
    if (opts.nullable) return null;
    throw new HttpError(400, `${field} is required`);
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,₹\s]/g, ""));
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new HttpError(400, `${field} must be a whole number`);
  if (opts.min !== undefined && n < opts.min) throw new HttpError(400, `${field} must be at least ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw new HttpError(400, `${field} must be at most ${opts.max}`);
  return n;
}

export function bool(v: unknown): number {
  return v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  throw new HttpError(400, `${field} must be one of: ${allowed.join(", ")}`);
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

// ---------- Crypto ----------
const enc = new TextEncoder();

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomHex(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return toHex(a);
}

export async function sha256(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** PBKDF2-SHA256, 100k iterations (the Workers maximum). Matches scripts/hash-password.mjs. */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: 100_000 }, key, 256);
  return toHex(bits);
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------- Settings ----------
export async function getSetting(db: D1Database, key: string): Promise<string> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? "";
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run();
}

// ---------- Requests ----------
export function readCookie(req: Request, name: string): string {
  const h = req.headers.get("cookie") ?? "";
  for (const part of h.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return "";
}

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "";
}

/**
 * Blocks cross-site form posts (CSRF) on public write endpoints: the request must come from our own
 * origin and be JSON (a cross-site page cannot send JSON without a CORS preflight, which we never allow).
 */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) throw new HttpError(403, "Request blocked");
  // Exact media type: "text/plain; application/json" (sendable cross-site without a preflight) is refused.
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "Request blocked");
}

/** Last 10 digits of an Indian mobile number, or "" if it isn't one. */
export function mobile(v: unknown): string {
  const d = String(v ?? "").replace(/[^0-9]/g, "");
  const ten = d.length > 10 ? d.slice(-10) : d;
  return /^[6-9][0-9]{9}$/.test(ten) ? ten : "";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks the first bytes really are a JPG, PNG or WebP (not just what the browser claims). */
export function looksLikeImage(buf: ArrayBuffer, type: string): boolean {
  const b = new Uint8Array(buf.slice(0, 12));
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === "image/webp") return String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  return false;
}

// ---------- Signatures ----------
async function hmacRaw(secret: string | Uint8Array<ArrayBuffer>, data: string, hash: "SHA-256" | "SHA-1" = "SHA-256"): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", typeof secret === "string" ? enc.encode(secret) : secret, { name: "HMAC", hash }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(data));
}
export async function hmacHex(secret: string, data: string): Promise<string> {
  return toHex(await hmacRaw(secret, data));
}
export async function hmacB64(secret: string, data: string): Promise<string> {
  return b64(new Uint8Array(await hmacRaw(secret, data)));
}

function b64(a: Uint8Array): string {
  let s = "";
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s);
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- Encrypted secrets (partner API keys) ----------
async function secretsKey(env: Env): Promise<CryptoKey> {
  const k = env.SECRETS_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(k)) throw new HttpError(503, "The server encryption key (SECRETS_KEY) is not set up yet, so keys cannot be saved safely. Ask the developer.");
  return crypto.subtle.importKey("raw", fromHex(k.toLowerCase()), "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** AES-256-GCM. `label` is bound to the ciphertext so a value saved for one partner can't be moved to another. */
export async function encryptJson(env: Env, label: string, data: Record<string, string>): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(label) }, await secretsKey(env), enc.encode(JSON.stringify(data)));
  return `v1.${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

export async function decryptJson(env: Env, label: string, blob: string): Promise<Record<string, string>> {
  if (!blob) return {};
  const [v, iv, ct] = blob.split(".");
  if (v !== "v1" || !iv || !ct) return {};
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: enc.encode(label) }, await secretsKey(env), unb64(ct));
  return JSON.parse(new TextDecoder().decode(pt)) as Record<string, string>;
}

// ---------- Two-step login codes (TOTP, RFC 6238: Google Authenticator, Microsoft Authenticator…) ----------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function randomBase32(len = 32): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return [...a].map((x) => B32[x % 32]).join("");
}
function base32Bytes(s: string): Uint8Array<ArrayBuffer> {
  const clean = s.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
async function totpAt(secret: string, counter: number): Promise<string> {
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 255; c = Math.floor(c / 256); }
  const key = await crypto.subtle.importKey("raw", base32Bytes(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}
/** Returns the 30-second time step the code belongs to (current ±1 for clock drift), or null. */
export async function totpStep(secret: string, code: unknown): Promise<number | null> {
  const c = String(code ?? "").replace(/\s/g, "");
  if (!/^[0-9]{6}$/.test(c) || !secret) return null;
  const now = Math.floor(Date.now() / 30_000);
  for (const d of [-1, 0, 1]) if (safeEqual(await totpAt(secret, now + d), c)) return now + d;
  return null;
}
export async function totpOk(secret: string, code: unknown): Promise<boolean> {
  return (await totpStep(secret, code)) !== null;
}

/** Public settings shown on the website. Keys starting with "_" are internal. */
export const PUBLIC_SETTINGS = [
  "whatsapp", "email", "announcement", "delivery", "instagram", "upi_id", "shipping_fee", "free_shipping_above",
  "require_login", "cod_enabled", "cod_fee", "hold_hours",
] as const;

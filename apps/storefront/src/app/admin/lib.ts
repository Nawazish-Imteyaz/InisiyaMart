"use client";

// Shared helpers for the admin console (runs in the browser).

export type Role = "owner" | "staff";
export interface AdminUser { id: number; email: string; name: string; role: Role }

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Calls /api/admin/<path>. Throws ApiError with a friendly message on failure. */
export async function api<T = Record<string, unknown>>(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const method = opts.method ?? (opts.body || opts.form ? "POST" : "GET");
  const headers: Record<string, string> = { "x-requested-with": "insihouse" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`/api/admin/${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "No internet connection. Please check and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401 && path !== "login") window.dispatchEvent(new Event("ih-session-ended"));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : `Error ${res.status}`);
  return data as T;
}

/** Resize a photo in the browser before upload (max 1600 px, WebP) so pages stay fast on 4G. */
export async function compressImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a photo (JPG, PNG or WebP)");
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (blob && (blob.type === "image/webp" || blob.type === "image/png")) return blob;
    const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return jpg ?? file;
  } catch {
    return file; // e.g. HEIC on some browsers: let the server decide
  }
}

export async function uploadPhoto(path: string, file: File) {
  const blob = await compressImage(file);
  const form = new FormData();
  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  form.append("file", blob, `photo.${ext}`);
  return api<{ url?: string; image?: string }>(path, { form });
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const rupees = (n: number | null | undefined) => (n === null || n === undefined ? "—" : inr.format(n));

/** D1 stores UTC "YYYY-MM-DD HH:MM:SS"; show it in Indian time. */
export function when(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export const TONES = [
  { value: "rose", label: "Rose", css: "linear-gradient(150deg,#f6d3db,#e9a9b8)" },
  { value: "blush", label: "Blush", css: "linear-gradient(150deg,#fde8e1,#f5c6c0)" },
  { value: "mauve", label: "Mauve", css: "linear-gradient(150deg,#eadbe6,#cfb2c6)" },
  { value: "dusty", label: "Dusty pink", css: "linear-gradient(150deg,#c88c9c,#9c5a6e)" },
  { value: "plum", label: "Plum", css: "linear-gradient(150deg,#8d3a60,#4a1530)" },
  { value: "ink", label: "Black", css: "linear-gradient(150deg,#4a3640,#2b1b22)" },
] as const;

export const ARTS = [
  { value: "pot", label: "Pot / vase" },
  { value: "fabric", label: "Silk / fabric" },
  { value: "gift", label: "Gift box" },
  { value: "frame", label: "Frame / art" },
  { value: "diya", label: "Diya" },
  { value: "clutch", label: "Clutch / bag" },
] as const;

export const COLORS = [
  { value: "plum", label: "Plum", css: "linear-gradient(150deg,#a0436d,#4a1530)" },
  { value: "ink", label: "Black", css: "linear-gradient(150deg,#4a3640,#2b1b22)" },
  { value: "rani", label: "Rani pink", css: "linear-gradient(150deg,#f07aa2,#c22f63)" },
  { value: "marigold", label: "Marigold", css: "linear-gradient(150deg,#ffc857,#e88a1a)" },
  { value: "peacock", label: "Peacock", css: "linear-gradient(150deg,#2aa3a8,#0c5d62)" },
  { value: "lilac", label: "Lilac", css: "linear-gradient(150deg,#cdb6ee,#8a63c7)" },
  { value: "rose", label: "Rose", css: "linear-gradient(150deg,#f3b3c2,#c9677f)" },
] as const;

export const OCCASIONS = ["Raksha Bandhan", "Diwali", "Eid", "Wedding & Nikah", "Birthday", "Anniversary", "Mother's Day", "Thank You"];
export const COLLECTIONS = ["", "Tohfa", "Nafees", "Zauq", "Khuloos"];
export const BADGES = ["Handmade", "Gift set", "Personalised", "New", "Bestseller"];

export const ORDER_STATUS = [
  { value: "new", label: "New", color: "#c22f63" },
  { value: "confirmed", label: "Confirmed", color: "#8a63c7" },
  { value: "packed", label: "Packed", color: "#e88a1a" },
  { value: "shipped", label: "Shipped", color: "#127c82" },
  { value: "delivered", label: "Delivered", color: "#2f8a4c" },
  { value: "cancelled", label: "Cancelled", color: "#6e5a63" },
  { value: "returned", label: "Returned", color: "#6e5a63" },
] as const;

export const PAY_STATUS = [
  { value: "pending", label: "Not paid yet" },
  { value: "paid", label: "Paid (UPI / online)" },
  { value: "cod", label: "Cash on delivery" },
  { value: "refunded", label: "Refunded" },
] as const;

export const COURIERS = ["", "Delhivery", "DTDC", "India Post (Speed Post)", "Xpressbees", "Ekart", "Blue Dart", "Shadowfax", "Hand delivery"];

export function statusLabel(v: string) {
  return ORDER_STATUS.find((s) => s.value === v) ?? { value: v, label: v, color: "#6e5a63" };
}

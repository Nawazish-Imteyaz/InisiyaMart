"use client";

// Browser helpers for the seller dashboard (/seller/). Calls /api/seller/* with the customer login cookie.

export class SellerError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function sellerApi<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET");
  // Our own header: other websites cannot send it, so they can't make changes in a seller's shop (CSRF).
  const headers: Record<string, string> = { "x-requested-with": "insihouse" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`/api/seller${path ? `/${path}` : ""}`, {
      method, headers, credentials: "same-origin", cache: "no-store",
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new SellerError(0, "No internet connection. Please check and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new SellerError(res.status, typeof data.error === "string" ? data.error : `Error ${res.status}`);
  return data as T;
}

export type SellerStatus = "draft" | "pending" | "approved" | "changes" | "rejected" | "suspended";
export interface Shop {
  id: number; slug: string; shop_name: string; maker_name: string; story: string; craft: string; district: string; state: string;
  photo: string | null; show_photo: number; full_name: string; address: string; pincode: string; contact_phone: string;
  upi_id: string; bank_name: string; bank_account: string; bank_ifsc: string; pan: string; gst_type: "none" | "enrolment" | "gstin"; gst_id: string;
  ship_fee: number; free_ship_above: number | null; dispatch_days: number; cod: number; holiday: number;
  status: SellerStatus; review_note: string; submitted_at: string | null; approved_at: string | null;
}
export interface Overview { seller: Shop | null; counts: { total: number; live: number; pending: number; needsFix: number; outOfStock: number } | null; step: number }
export interface MyProduct {
  id: number; slug: string; name: string; price_inr: number; mrp_inr: number | null; stock: number; track_stock: number; made_to_order_days: number | null;
  status: "active" | "hidden"; review_status: "pending" | "approved" | "changes" | "rejected"; review_note: string; category_name: string | null; image_key: string | null;
}
export interface CategoryOpt { id: number; slug: string; name: string; parent_id: number | null }

export const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export const REVIEW_LABEL: Record<MyProduct["review_status"], { text: string; cls: string }> = {
  pending: { text: "Being checked", cls: "st-marigold" },
  approved: { text: "Live", cls: "st-ok" },
  changes: { text: "Fix needed", cls: "st-rani" },
  rejected: { text: "Not accepted", cls: "" },
};

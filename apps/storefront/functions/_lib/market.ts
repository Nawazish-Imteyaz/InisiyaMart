// Marketplace helpers (decision 010): what buyers may see, the public "maker card", the logged-in seller, seller log.
import { currentCustomer, type Customer } from "./shop";
import { HttpError, type D1Database } from "./util";

/** A product is shown to buyers only when it is active, approved by the admin, and its shop is approved. */
export const PUBLIC_PRODUCT = "p.status = 'active' AND p.review_status = 'approved' AND (p.seller_id IS NULL OR s.status = 'approved')";
export const PRODUCT_JOIN = "FROM products p LEFT JOIN sellers s ON s.id = p.seller_id";

export type SellerStatus = "draft" | "pending" | "approved" | "changes" | "rejected" | "suspended";
export interface SellerRow {
  id: number; customer_id: number | null; slug: string; shop_name: string; maker_name: string; story: string; craft: string;
  district: string; state: string; photo_key: string | null; show_photo: number;
  full_name: string; address: string; pincode: string; contact_phone: string; upi_id: string; bank_name: string; bank_account: string; bank_ifsc: string;
  pan: string; gst_type: "none" | "enrolment" | "gstin"; gst_id: string;
  ship_fee: number; free_ship_above: number | null; dispatch_days: number; cod: number; holiday: number;
  status: SellerStatus; review_note: string; admin_note: string; undertaking_at: string | null; submitted_at: string | null; approved_at: string | null;
  created_at: string; updated_at: string;
}

/** Only the public part of a seller. NEVER add private fields (full name, address, phone, UPI, bank, PAN, GST id) here. */
export function makerCard(s: Pick<SellerRow, "slug" | "shop_name" | "maker_name" | "district" | "state" | "photo_key" | "show_photo" | "craft"> & { story?: string; created_at?: string }) {
  return {
    slug: s.slug,
    shop: s.shop_name,
    name: s.maker_name,
    district: s.district,
    state: s.state,
    craft: s.craft,
    photo: s.show_photo && s.photo_key ? `/img/${s.photo_key}` : null,
    ...(s.story !== undefined ? { story: s.story } : {}),
    ...(s.created_at !== undefined ? { since: s.created_at.slice(0, 10) } : {}),
  };
}

/** SQL columns for makerCard() when products are joined with sellers as `s`. */
export const MAKER_COLS = "s.slug AS s_slug, s.shop_name AS s_shop, s.maker_name AS s_name, s.district AS s_district, s.state AS s_state, s.photo_key AS s_photo, s.show_photo AS s_show_photo, s.craft AS s_craft";
export function makerFromRow(r: Record<string, unknown>) {
  if (!r.s_slug) return null;
  return makerCard({
    slug: String(r.s_slug), shop_name: String(r.s_shop ?? ""), maker_name: String(r.s_name ?? ""), district: String(r.s_district ?? ""),
    state: String(r.s_state ?? ""), photo_key: (r.s_photo as string | null) ?? null, show_photo: Number(r.s_show_photo ?? 1), craft: String(r.s_craft ?? ""),
  });
}

/**
 * Seller API writes need our own header: a cross-site page cannot add it without a CORS preflight (which we never allow),
 * so this blocks CSRF for JSON and for photo uploads (multipart) alike.
 */
export function requireAppRequest(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  if (req.headers.get("x-requested-with") !== "insihouse") throw new HttpError(403, "Request blocked");
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) throw new HttpError(403, "Request blocked");
}

/** The logged-in customer and their seller shop (if any). */
export async function currentSeller(db: D1Database, req: Request): Promise<{ me: Customer; seller: SellerRow | null }> {
  const me = await currentCustomer(db, req);
  if (!me) throw new HttpError(401, "Please log in with your mobile number first");
  const seller = await db.prepare("SELECT * FROM sellers WHERE customer_id = ?").bind(me.id).first<SellerRow>();
  return { me, seller };
}

export async function sellerLog(db: D1Database, sellerId: number, actor: string, action: string, detail = "") {
  await db.prepare("INSERT INTO seller_activity (seller_id, actor, action, detail) VALUES (?, ?, ?, ?)").bind(sellerId, actor.slice(0, 80), action.slice(0, 80), detail.slice(0, 300)).run();
}

/** A new seller's first products are checked by the admin; after this many approved products they publish straight away. */
export const TRUSTED_AFTER = 5;

export const GST_TYPES = ["none", "enrolment", "gstin"] as const;
export const MADE_BY = ["me", "family", "group"] as const;
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

// ---------------- Public product list (catalogue, product page rails, maker page) ----------------
type PubRow = Record<string, unknown> & {
  id: number; slug: string; name: string; category_id: number | null; collection: string; badge: string; summary: string; details: string;
  price_inr: number | null; mrp_inr: number | null; stock: number; track_stock: number; personalisable: number; occasions: string; tone: string; art: string;
  created_at: string; made_by: string; technique: string; materials: string; made_to_order_days: number | null;
};

/**
 * Products buyers may see, mapped to the website's Product shape (+ maker card and handmade details).
 * `where` is a FIXED SQL fragment written in code (never user input); values go through `binds`.
 */
export async function publicProducts(db: D1Database, where = "", binds: unknown[] = [], limit = 2000, order = "p.sort, p.id DESC") {
  const rows = await db
    .prepare(`SELECT p.*, ${MAKER_COLS} ${PRODUCT_JOIN} WHERE ${PUBLIC_PRODUCT} ${where ? `AND (${where})` : ""} ORDER BY ${order} LIMIT ?`)
    .bind(...binds, limit)
    .all<PubRow>();
  const list = rows.results;
  if (!list.length) return [];
  const [cats, occ] = await db.batch([
    db.prepare("SELECT id, slug, name FROM categories"),
    db.prepare("SELECT slug, name FROM occasions WHERE visible = 1"),
  ]);
  const catById = new Map((cats.results as { id: number; slug: string; name: string }[]).map((c) => [c.id, c]));
  const occBy = new Map<string, string>();
  for (const o of occ.results as { slug: string; name: string }[]) { occBy.set(o.slug, o.slug); occBy.set(o.name.toLowerCase(), o.slug); }
  // Photos for just these products (chunked: D1 allows up to 100 bound values per query).
  const images = new Map<number, string[]>();
  const ids = list.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const r = await db.prepare(`SELECT product_id, key FROM product_images WHERE product_id IN (${chunk.map(() => "?").join(",")}) ORDER BY sort, id`).bind(...chunk).all<{ product_id: number; key: string }>();
    for (const x of r.results) { const l = images.get(x.product_id) ?? []; l.push(`/img/${x.key}`); images.set(x.product_id, l); }
  }
  return list.map((p) => {
    const cat = p.category_id ? catById.get(p.category_id) : undefined;
    return {
      slug: p.slug, name: p.name, category: cat?.slug ?? "", craft: cat?.name ?? "Handmade", collection: p.collection, badge: p.badge,
      summary: p.summary, details: p.details, priceInr: p.price_inr, mrpInr: p.mrp_inr,
      inStock: !p.track_stock || p.stock > 0, personalisable: !!p.personalisable,
      occasions: [...new Set((p.occasions || "").split(",").map((s) => occBy.get(s.trim().toLowerCase())).filter((s): s is string => !!s))],
      createdAt: p.created_at, tone: p.tone, art: p.art, images: images.get(p.id) ?? [],
      madeBy: p.made_by, technique: p.technique, materials: p.materials, madeToOrderDays: p.made_to_order_days,
      maker: makerFromRow(p),
    };
  });
}

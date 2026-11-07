// /api/seller/* — the seller's own shop (decision 010). Login = the normal customer account (cookie ih_cust).
//   GET    /api/seller                       → { seller | null, counts, step }
//   PUT    /api/seller/shop                  → create / update own shop (draft until submitted)
//   POST   /api/seller/shop/photo            → shop photo (multipart "file")
//   POST   /api/seller/submit                → { undertaking: true } send the shop for approval
//   GET    /api/seller/categories            → categories a product can go in
//   GET/POST /api/seller/products            → own products
//   GET/PUT/DELETE /api/seller/products/:id  → one own product
//   POST   /api/seller/products/:id/images   → add photo;  PUT …/images {order:[ids]};  DELETE …/images/:imageId
//   GET    /api/seller/requests              → own category requests
//   GET    /api/seller/activity              → own activity log
// SECURITY: the seller id ALWAYS comes from the login session (never from the request), and every query on products,
// photos, requests and the log is filtered by it. A seller can never read, change or delete another seller's data.
import { readImage, uniqueSlug } from "../../_lib/admin-core";
import {
  currentSeller, GST_TYPES, INDIAN_STATES, MADE_BY, requireAppRequest, sellerLog, TRUSTED_AFTER, type SellerRow,
} from "../../_lib/market";
import { emit } from "../../_lib/providers";
import { bool, HttpError, int, json, mobile, oneOf, randomHex, readJson, str, type Ctx, type D1Database } from "../../_lib/util";

const MAX_PRODUCTS = 300;
const MAX_IMAGES = 8;
const EDITABLE: SellerRow["status"][] = ["draft", "pending", "approved", "changes"];

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  try {
    return await route(ctx);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
};

async function route(ctx: Ctx): Promise<Response> {
  const { request: req, env } = ctx;
  requireAppRequest(req);
  const db = env.DB;
  const raw = ctx.params.path;
  const [a, b, c, d] = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
  const m = req.method;
  const { me, seller } = await currentSeller(db, req);

  if (!a && m === "GET") return overview(db, seller);
  if (a === "shop" && !b && m === "PUT") return saveShop(db, me.id, me.phone, seller, await readJson(req));
  if (a === "categories" && m === "GET") {
    const r = await db.prepare("SELECT id, slug, name, parent_id FROM categories WHERE visible = 1 ORDER BY sort, name").all();
    return json({ categories: r.results });
  }

  // Everything below needs a shop.
  if (!seller) throw new HttpError(404, "Create your shop first");
  if (m !== "GET" && !EDITABLE.includes(seller.status)) {
    throw new HttpError(403, seller.status === "suspended" ? "Your shop is paused by Insi House. Please message us on WhatsApp." : "This shop was not approved. Please message us on WhatsApp.");
  }
  if (a === "shop" && b === "photo" && m === "POST") return shopPhoto(ctx, seller);
  if (a === "submit" && m === "POST") return submit(ctx, seller, await readJson(req));
  if (a === "products") return products(ctx, seller, m, b, c, d);
  if (a === "requests" && m === "GET") {
    const r = await db.prepare("SELECT id, name, status, admin_note, created_at FROM category_requests WHERE seller_id = ? ORDER BY id DESC LIMIT 50").bind(seller.id).all();
    return json({ requests: r.results });
  }
  if (a === "activity" && m === "GET") {
    const r = await db.prepare("SELECT actor, action, detail, created_at FROM seller_activity WHERE seller_id = ? ORDER BY id DESC LIMIT 100").bind(seller.id).all();
    return json({ activity: r.results });
  }
  throw new HttpError(404, "Not found");
}

// ---------------- Shop ----------------
/** The seller's own view of their shop (everything except the private admin note). */
function ownShop(s: SellerRow) {
  const { admin_note: _n, customer_id: _c, ...rest } = s;
  return { ...rest, photo: s.photo_key ? `/img/${s.photo_key}` : null };
}

async function overview(db: D1Database, seller: SellerRow | null): Promise<Response> {
  if (!seller) return json({ seller: null, counts: null, step: 2 });
  const counts = await db
    .prepare(`SELECT COUNT(*) AS total, SUM(review_status = 'approved' AND status = 'active') AS live, SUM(review_status = 'pending') AS pending,
                     SUM(review_status IN ('changes','rejected')) AS needs_fix, SUM(track_stock = 1 AND stock <= 0) AS out_of_stock
              FROM products WHERE seller_id = ?`)
    .bind(seller.id).first<Record<string, number | null>>();
  const n = (k: string) => Number(counts?.[k] ?? 0);
  // Which onboarding step is next: 2 shop · 3 first product · 4 payment · 5 submit · 6 done (submitted)
  let step = 6;
  if (seller.status === "draft" || seller.status === "changes") {
    step = !shopReady(seller) ? 2 : n("total") === 0 ? 3 : !seller.upi_id ? 4 : 5;
  }
  return json({
    seller: ownShop(seller),
    counts: { total: n("total"), live: n("live"), pending: n("pending"), needsFix: n("needs_fix"), outOfStock: n("out_of_stock") },
    step,
  });
}

function shopReady(s: SellerRow) {
  return !!(s.shop_name && s.maker_name && s.district && s.state && s.full_name && s.address && s.pincode);
}

async function saveShop(db: D1Database, customerId: number, phone: string, seller: SellerRow | null, body: Record<string, unknown>): Promise<Response> {
  if (seller && !EDITABLE.includes(seller.status)) throw new HttpError(403, "This shop cannot be changed. Please message us on WhatsApp.");
  const v: Record<string, unknown> = {};
  const has = (k: string) => body[k] !== undefined;
  if (has("shop_name")) {
    const name = str(body.shop_name, 50, "Shop name", true);
    if (name.length < 3) throw new HttpError(400, "Shop name must be at least 3 letters");
    v.shop_name = name;
  }
  if (has("maker_name")) v.maker_name = str(body.maker_name, 40, "Your name (shown to buyers)", true);
  if (has("story")) v.story = str(body.story, 600, "Your story");
  if (has("craft")) v.craft = str(body.craft, 80, "What you make");
  if (has("district")) v.district = str(body.district, 60, "District / city", true);
  if (has("state")) v.state = oneOf(body.state, INDIAN_STATES, "State");
  if (has("show_photo")) v.show_photo = bool(body.show_photo);
  if (has("full_name")) v.full_name = str(body.full_name, 100, "Full name", true);
  if (has("address")) v.address = str(body.address, 400, "Address", true);
  if (has("pincode")) {
    const pin = str(body.pincode, 6, "PIN code", true);
    if (!/^[1-9][0-9]{5}$/.test(pin)) throw new HttpError(400, "PIN code must be 6 digits");
    v.pincode = pin;
  }
  if (has("contact_phone")) {
    const p = body.contact_phone ? mobile(body.contact_phone) : "";
    if (body.contact_phone && !p) throw new HttpError(400, "Enter a valid 10-digit mobile number");
    v.contact_phone = p;
  }
  if (has("upi_id")) {
    const u = str(body.upi_id, 80, "UPI ID");
    if (u && !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(u)) throw new HttpError(400, "UPI ID looks wrong. It looks like name@okaxis or name@ybl");
    v.upi_id = u;
  }
  if (has("bank_name")) v.bank_name = str(body.bank_name, 80, "Bank name");
  if (has("bank_account")) {
    const acc = str(body.bank_account, 20, "Account number").replace(/\s/g, "");
    if (acc && !/^[0-9]{9,18}$/.test(acc)) throw new HttpError(400, "Bank account number should be 9 to 18 digits");
    v.bank_account = acc;
  }
  if (has("bank_ifsc")) {
    const ifsc = str(body.bank_ifsc, 11, "IFSC").toUpperCase();
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new HttpError(400, "IFSC looks wrong, e.g. SBIN0001234");
    v.bank_ifsc = ifsc;
  }
  if (has("pan")) {
    const pan = str(body.pan, 10, "PAN").toUpperCase();
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw new HttpError(400, "PAN looks wrong, e.g. ABCDE1234F");
    v.pan = pan;
  }
  if (has("gst_type")) v.gst_type = oneOf(body.gst_type, GST_TYPES, "GST");
  if (has("gst_id")) {
    const g = str(body.gst_id, 15, "GST number").toUpperCase();
    const type = (v.gst_type ?? seller?.gst_type ?? "none") as string;
    if (type === "gstin" && g && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) throw new HttpError(400, "GSTIN looks wrong. It has 15 characters, e.g. 09ABCDE1234F1Z5");
    if (type === "enrolment" && g && !/^[0-9A-Z]{10,15}$/.test(g)) throw new HttpError(400, "Enrolment ID looks wrong");
    v.gst_id = type === "none" ? "" : g;
  }
  if (has("ship_fee")) v.ship_fee = int(body.ship_fee, "Delivery charge", { min: 0, max: 5000 });
  if (has("free_ship_above")) v.free_ship_above = int(body.free_ship_above, "Free delivery above", { min: 0, max: 1_000_000, nullable: true });
  if (has("dispatch_days")) v.dispatch_days = int(body.dispatch_days, "Days to dispatch", { min: 1, max: 30 });
  if (has("cod")) v.cod = bool(body.cod);
  if (has("holiday")) v.holiday = bool(body.holiday);

  if (!seller) {
    if (!v.shop_name) throw new HttpError(400, "Shop name is required");
    const slug = await uniqueSlug(db, "sellers", String(v.shop_name));
    const cols = ["customer_id", "slug", "contact_phone", ...Object.keys(v).filter((k) => k !== "contact_phone")];
    const vals = [customerId, slug, (v.contact_phone as string) || phone, ...Object.keys(v).filter((k) => k !== "contact_phone").map((k) => v[k])];
    const r = await db.prepare(`INSERT INTO sellers (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...vals).run();
    const id = r.meta.last_row_id as number;
    await sellerLog(db, id, "seller", "Created shop", String(v.shop_name));
    return json({ ok: true, id, slug }, 201);
  }
  const cols = Object.keys(v);
  if (cols.length) {
    // The shop's web address follows the name until the shop is approved; after that it stays fixed (links keep working).
    if (v.shop_name && v.shop_name !== seller.shop_name && seller.status !== "approved") {
      v.slug = await uniqueSlug(db, "sellers", String(v.shop_name), seller.id);
      cols.push("slug");
    }
    await db.prepare(`UPDATE sellers SET ${cols.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...cols.map((k) => v[k]), seller.id).run();
    const sensitive = cols.filter((k) => ["upi_id", "bank_account", "bank_ifsc", "pan", "gst_id"].includes(k));
    await sellerLog(db, seller.id, "seller", "Updated shop", sensitive.length ? `changed: ${sensitive.join(", ")}` : cols.join(", "));
  }
  return json({ ok: true });
}

async function shopPhoto({ request: req, env }: Ctx, seller: SellerRow): Promise<Response> {
  const img = await readImage(req);
  const key = `s/${seller.id}/shop/${randomHex(8)}.${img.ext}`;
  await env.PHOTOS.put(key, img.data, { httpMetadata: { contentType: img.type } });
  await env.DB.prepare("UPDATE sellers SET photo_key = ?, updated_at = datetime('now') WHERE id = ?").bind(key, seller.id).run();
  if (seller.photo_key) await env.PHOTOS.delete(seller.photo_key);
  await sellerLog(env.DB, seller.id, "seller", "Changed shop photo");
  return json({ photo: `/img/${key}` });
}

async function submit(ctx: Ctx, seller: SellerRow, body: Record<string, unknown>): Promise<Response> {
  const db = ctx.env.DB;
  if (seller.status !== "draft" && seller.status !== "changes") return json({ ok: true, already: true });
  if (!shopReady(seller)) throw new HttpError(400, "Please fill in your shop details first");
  if (!seller.upi_id) throw new HttpError(400, "Please add your UPI ID so buyers can pay you");
  const n = await db.prepare("SELECT COUNT(*) AS n FROM products WHERE seller_id = ?").bind(seller.id).first<{ n: number }>();
  if (!n?.n) throw new HttpError(400, "Please add at least one product");
  if (body.undertaking !== true) throw new HttpError(400, "Please confirm that your products are handmade and your details are true");
  await db.prepare("UPDATE sellers SET status = 'pending', undertaking_at = datetime('now'), submitted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(seller.id).run();
  await sellerLog(db, seller.id, "seller", "Sent shop for approval");
  emit(ctx, "seller.applied", {}, `🧵 New seller wants to join: ${seller.shop_name} (${seller.maker_name}, ${seller.district}, ${seller.state})\nAdmin → Sellers to approve.`);
  return json({ ok: true });
}

// ---------------- Products ----------------
async function approvedCount(db: D1Database, sellerId: number) {
  return (await db.prepare("SELECT COUNT(*) AS n FROM products WHERE seller_id = ? AND review_status = 'approved'").bind(sellerId).first<{ n: number }>())?.n ?? 0;
}

async function productValues(db: D1Database, body: Record<string, unknown>, creating: boolean) {
  const out: Record<string, unknown> = {};
  const has = (k: string) => creating || body[k] !== undefined;
  if (has("name")) {
    out.name = str(body.name, 120, "Product name", true);
    if ((out.name as string).length < 3) throw new HttpError(400, "Product name is too short");
  }
  if (has("category_id")) {
    const cid = int(body.category_id, "Category", { min: 1 }) as number;
    if (!(await db.prepare("SELECT id FROM categories WHERE id = ? AND visible = 1").bind(cid).first())) throw new HttpError(400, "Please choose a category");
    out.category_id = cid;
  }
  if (has("requested_category")) out.requested_category = str(body.requested_category, 60, "New category name");
  if (has("summary")) out.summary = str(body.summary, 600, "Description", true);
  if (has("details")) out.details = str(body.details, 2000, "Size & materials");
  if (has("price_inr")) out.price_inr = int(body.price_inr, "Price", { min: 1, max: 10_000_000 });
  if (has("mrp_inr")) out.mrp_inr = int(body.mrp_inr, "Price before discount", { min: 1, max: 10_000_000, nullable: true });
  if (has("stock")) out.stock = int(body.stock ?? 1, "How many you have", { min: 0, max: 100_000 });
  if (has("made_to_order_days")) out.made_to_order_days = int(body.made_to_order_days, "Days to make", { min: 1, max: 90, nullable: true });
  if (has("status")) out.status = oneOf(body.status ?? "active", ["active", "hidden"] as const, "Show in shop");
  if (has("personalisable")) out.personalisable = bool(body.personalisable);
  if (has("made_by")) out.made_by = oneOf(body.made_by ?? "me", MADE_BY, "Who made it");
  if (has("technique")) out.technique = str(body.technique, 80, "Craft / technique");
  if (has("materials")) out.materials = str(body.materials, 200, "Materials");
  if (has("occasions")) {
    const list = (Array.isArray(body.occasions) ? body.occasions.map(String) : []).filter((s) => /^[a-z0-9-]{1,80}$/.test(s));
    out.occasions = [...new Set(list)].slice(0, 12).join(",");
  }
  if ("made_to_order_days" in out) out.track_stock = out.made_to_order_days ? 0 : 1;
  return out;
}

/** "Other" + a new category name → a category request the admin can approve (one open request per product). */
async function syncCategoryRequest(db: D1Database, seller: SellerRow, productId: number) {
  const p = await db.prepare("SELECT p.requested_category AS want, c.slug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ? AND p.seller_id = ?")
    .bind(productId, seller.id).first<{ want: string; slug: string | null }>();
  const open = await db.prepare("SELECT id FROM category_requests WHERE product_id = ? AND seller_id = ? AND status = 'pending'").bind(productId, seller.id).first<{ id: number }>();
  if (!p || p.slug !== "other" || !p.want) {
    if (open) await db.prepare("DELETE FROM category_requests WHERE id = ?").bind(open.id).run();
    return;
  }
  if (open) {
    await db.prepare("UPDATE category_requests SET name = ?, updated_at = datetime('now') WHERE id = ?").bind(p.want, open.id).run();
    return;
  }
  const pending = await db.prepare("SELECT COUNT(*) AS n FROM category_requests WHERE seller_id = ? AND status = 'pending'").bind(seller.id).first<{ n: number }>();
  if ((pending?.n ?? 0) >= 10) return;
  await db.prepare("INSERT INTO category_requests (seller_id, product_id, name) VALUES (?, ?, ?)").bind(seller.id, productId, p.want).run();
  await sellerLog(db, seller.id, "seller", "Asked for a new category", p.want);
}

async function products(ctx: Ctx, seller: SellerRow, m: string, b?: string, c?: string, d?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;

  if (!b && m === "GET") {
    const r = await db
      .prepare(`SELECT p.id, p.slug, p.name, p.price_inr, p.mrp_inr, p.stock, p.track_stock, p.made_to_order_days, p.status, p.review_status, p.review_note,
                       c.name AS category_name, p.updated_at,
                       (SELECT key FROM product_images i WHERE i.product_id = p.id ORDER BY sort, id LIMIT 1) AS image_key
                FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.seller_id = ? ORDER BY p.id DESC`)
      .bind(seller.id).all();
    return json({ products: r.results });
  }

  if (!b && m === "POST") {
    const total = await db.prepare("SELECT COUNT(*) AS n FROM products WHERE seller_id = ?").bind(seller.id).first<{ n: number }>();
    if ((total?.n ?? 0) >= MAX_PRODUCTS) throw new HttpError(400, `A shop can have up to ${MAX_PRODUCTS} products`);
    const v = await productValues(db, await readJson(req), true);
    if (v.mrp_inr != null && (v.mrp_inr as number) < (v.price_inr as number)) throw new HttpError(400, "Price before discount cannot be lower than the price");
    const trusted = seller.status === "approved" && (await approvedCount(db, seller.id)) >= TRUSTED_AFTER;
    const row = {
      ...v, slug: await uniqueSlug(db, "products", String(v.name)), seller_id: seller.id, review_status: trusted ? "approved" : "pending",
      badge: "Handmade", tone: (["rose", "blush", "mauve", "plum", "dusty", "ink"] as const)[seller.id % 6], art: "gift",
    };
    const cols = Object.keys(row);
    const r = await db.prepare(`INSERT INTO products (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
      .bind(...cols.map((k) => (row as Record<string, unknown>)[k])).run();
    const id = r.meta.last_row_id as number;
    await syncCategoryRequest(db, seller, id);
    await sellerLog(db, seller.id, "seller", "Added product", String(v.name));
    if (!trusted && seller.status === "approved") emit(ctx, "product.review", {}, `🆕 Product to check: “${String(v.name)}” by ${seller.shop_name}\nAdmin → Sellers → Products to check.`);
    return json({ id, slug: row.slug, review_status: row.review_status }, 201);
  }

  const id = Number(b);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, "Product not found");
  // Ownership check: the product must belong to THIS seller. Same 404 whether it doesn't exist or isn't theirs.
  const p = await db.prepare("SELECT * FROM products WHERE id = ? AND seller_id = ?").bind(id, seller.id).first<Record<string, unknown> & { name: string; review_status: string; price_inr: number; mrp_inr: number | null }>();
  if (!p) throw new HttpError(404, "Product not found");

  if (c === "images") return productImages(ctx, seller, p, m, d);
  if (c) throw new HttpError(404, "Not found");

  if (m === "GET") {
    const imgs = await db.prepare("SELECT id, key FROM product_images WHERE product_id = ? ORDER BY sort, id").bind(id).all<{ id: number; key: string }>();
    const { seller_id: _s, ...product } = p;
    return json({ product, images: imgs.results.map((i) => ({ id: i.id, url: `/img/${i.key}` })) });
  }

  if (m === "PUT") {
    const body = await readJson(req);
    const v = await productValues(db, body, false);
    const price = (v.price_inr ?? p.price_inr) as number;
    const mrp = ("mrp_inr" in v ? v.mrp_inr : p.mrp_inr) as number | null;
    if (mrp != null && mrp < price) throw new HttpError(400, "Price before discount cannot be lower than the price");
    // Content changes by a not-yet-trusted seller, or any fix after "changes needed", go back to the admin for a check.
    const contentChanged = ["name", "summary", "details", "category_id", "technique", "materials", "made_by"].some((k) => k in v && v[k] !== p[k]);
    const trusted = seller.status === "approved" && (await approvedCount(db, seller.id)) >= TRUSTED_AFTER;
    if ((contentChanged && !trusted) || (p.review_status === "changes" || p.review_status === "rejected")) {
      if (Object.keys(v).length) { v.review_status = "pending"; v.review_note = ""; }
    }
    if ("name" in v && v.name !== p.name && p.review_status !== "approved") v.slug = await uniqueSlug(db, "products", String(v.name), id);
    const cols = Object.keys(v);
    if (cols.length) {
      await db.prepare(`UPDATE products SET ${cols.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ? AND seller_id = ?`)
        .bind(...cols.map((k) => v[k]), id, seller.id).run();
      await syncCategoryRequest(db, seller, id);
      const what = cols.length <= 2 && cols.every((k) => k === "stock" || k === "status" || k === "track_stock") ? ` (${cols.filter((k) => k !== "track_stock").map((k) => `${k} → ${String(v[k])}`).join(", ")})` : "";
      await sellerLog(db, seller.id, "seller", "Updated product", `${String(v.name ?? p.name)}${what}`);
    }
    return json({ ok: true, review_status: v.review_status ?? p.review_status });
  }

  if (m === "DELETE") {
    const imgs = await db.prepare("SELECT key FROM product_images WHERE product_id = ?").bind(id).all<{ key: string }>();
    await db.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(id, seller.id).run();
    if (imgs.results.length) await env.PHOTOS.delete(imgs.results.map((i) => i.key));
    await sellerLog(db, seller.id, "seller", "Deleted product", p.name);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

async function productImages(ctx: Ctx, seller: SellerRow, p: Record<string, unknown> & { name: string }, m: string, imageId?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  const pid = p.id as number;
  if (!imageId && m === "POST") {
    const count = await db.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(sort), 0) AS mx FROM product_images WHERE product_id = ?").bind(pid).first<{ n: number; mx: number }>();
    if ((count?.n ?? 0) >= MAX_IMAGES) throw new HttpError(400, `A product can have up to ${MAX_IMAGES} photos`);
    const img = await readImage(req);
    const key = `s/${seller.id}/p/${pid}/${randomHex(8)}.${img.ext}`;
    await env.PHOTOS.put(key, img.data, { httpMetadata: { contentType: img.type } });
    const r = await db.prepare("INSERT INTO product_images (product_id, key, sort) VALUES (?, ?, ?)").bind(pid, key, (count?.mx ?? 0) + 1).run();
    await db.prepare("UPDATE products SET updated_at = datetime('now') WHERE id = ?").bind(pid).run();
    return json({ id: r.meta.last_row_id, url: `/img/${key}` }, 201);
  }
  if (!imageId && m === "PUT") {
    const body = await readJson<{ order?: unknown[] }>(req);
    const ids = (body.order ?? []).map(Number).filter((x) => Number.isInteger(x)).slice(0, MAX_IMAGES);
    // "AND product_id = ?" keeps the reorder inside this (own) product.
    if (ids.length) await db.batch(ids.map((imgId, i) => db.prepare("UPDATE product_images SET sort = ? WHERE id = ? AND product_id = ?").bind(i + 1, imgId, pid)));
    return json({ ok: true });
  }
  if (imageId && m === "DELETE") {
    const img = await db.prepare("SELECT id, key FROM product_images WHERE id = ? AND product_id = ?").bind(Number(imageId), pid).first<{ id: number; key: string }>();
    if (!img) throw new HttpError(404, "Photo not found");
    await db.prepare("DELETE FROM product_images WHERE id = ?").bind(img.id).run();
    await env.PHOTOS.delete(img.key);
    await sellerLog(db, seller.id, "seller", "Removed product photo", p.name);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

// /api/admin/* — the admin console API. Every route except login needs a valid session cookie.
import {
  bool, checkPasswordStrength, clientIp, hashPassword, HttpError, int, json, oneOf, PRIVATE_SETTINGS, PUBLIC_SETTINGS, randomHex, readCookie, readJson, safeEqual,
  setSetting, sha256, str, totpStep, type Ctx, type D1Database, type Env,
} from "../../_lib/util";
import { contentChanged, idParam, log, publish, publishState, readImage, requireOwner, uniqueSlug, type Role, type User } from "../../_lib/admin-core";
import {
  coupons, customers, dashboard, enquiries, integrations, notifications, occasions, security, webhooks,
} from "../../_lib/admin-more";
import { emit } from "../../_lib/providers";
import { categoryRequests, review, sellers } from "../../_lib/admin-market";

const COOKIE = "ih_admin";
const SESSION_DAYS = 7;

const TONES = ["ink", "rose", "blush", "mauve", "plum", "dusty"] as const;
const ARTS = ["pot", "fabric", "gift", "frame", "diya", "clutch"] as const;
const COLORS = ["plum", "ink", "rani", "marigold", "peacock", "lilac", "rose"] as const;
const PRODUCT_STATUS = ["active", "hidden", "draft"] as const;
const ORDER_STATUS = ["new", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"] as const;
const PAY_STATUS = ["pending", "paid", "cod", "refunded"] as const;

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  try {
    return await route(ctx);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong on the server. Please try again." }, 500);
  }
};

async function route(ctx: Ctx): Promise<Response> {
  const { request: req, env } = ctx;
  const url = new URL(req.url);
  const raw = ctx.params.path;
  const seg = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
  const m = req.method;

  // CSRF protection: browsers cannot send this header cross-site without our permission.
  if (m !== "GET" && m !== "HEAD") {
    if (req.headers.get("x-requested-with") !== "insihouse") throw new HttpError(403, "Request blocked");
    const origin = req.headers.get("origin");
    if (origin && origin !== url.origin) throw new HttpError(403, "Request blocked");
  }

  const [a, b, c] = seg;
  if (a === "login" && m === "POST") return login(ctx);
  if (a === "logout" && m === "POST") return logout(ctx);

  const user = await requireUser(env.DB, req);
  if (a === "me" && !b && m === "GET") {
    const t = await env.DB.prepare("SELECT totp_on FROM admin_users WHERE id = ?").bind(user.id).first<{ totp_on: number }>();
    return json({ user: { ...user, totp: !!t?.totp_on } });
  }
  if (a === "me" && b === "password" && m === "PUT") return changeOwnPassword(env, user, req);
  if (a === "me" && (b === "sessions" || b === "2fa" || b === "logins")) return security(ctx, user, m, b, c);
  if (a === "dashboard" && m === "GET") return dashboard(env, url);
  if (a === "notifications" && m === "GET") return notifications(env, user);
  if (a === "occasions") return occasions(ctx, user, m, b, c);
  if (a === "customers") return customers(ctx, user, m, b, c);
  if (a === "enquiries") return enquiries(ctx, user, m, b);
  if (a === "coupons") return coupons(ctx, user, m, b);
  if (a === "integrations") { requireOwner(user); return integrations(ctx, user, m, b, c); }
  if (a === "webhooks") { requireOwner(user); return webhooks(ctx, user, m, b, c); }
  if (a === "publish") return m === "POST" ? json(await publish(env, user, true)) : json(await publishState(env));
  if (a === "sellers") return sellers(ctx, user, m, b);
  if (a === "review") return review(ctx, user, m, b);
  if (a === "category-requests") return categoryRequests(ctx, user, m, b);
  if (a === "categories") return categories(ctx, user, m, b, c);
  if (a === "products") return products(ctx, user, m, b, c);
  if (a === "images" && b && m === "DELETE") return deleteProductImage(ctx, user, b);
  if (a === "orders") return orders(ctx, user, m, b);
  if (a === "settings") return settings(ctx, user, m);
  if (a === "users") { requireOwner(user); return users(env, user, m, b, req); }
  if (a === "activity" && m === "GET") {
    requireOwner(user);
    const r = await env.DB.prepare("SELECT * FROM activity ORDER BY id DESC LIMIT 300").all();
    return json({ activity: r.results });
  }
  throw new HttpError(404, "Not found");
}

// ============================ Auth ============================

function sessionCookie(token: string, maxAge: number): string {
  return `${COOKIE}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function requireUser(db: D1Database, req: Request): Promise<User> {
  const token = readCookie(req, COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(401, "Please log in");
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN admin_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1`,
    )
    .bind(await sha256(token))
    .first<User>();
  if (!row) throw new HttpError(401, "Your session has ended. Please log in again.");
  return row;
}


async function login(ctx: Ctx): Promise<Response> {
  const { request: req, env } = ctx;
  const body = await readJson(req);
  const email = str(body.email, 120, "Email", true).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const ip = clientIp(req);

  // Limit guesses per device: 8 wrong tries for one email, or 30 in total, per 15 minutes.
  // (Counting per device, not per email alone, so nobody can lock the owner out from elsewhere.)
  const fails = await env.DB
    .prepare(`SELECT SUM(email = ?) AS same, COUNT(*) AS total FROM login_attempts
              WHERE ok = 0 AND ip = ? AND created_at > datetime('now', '-15 minutes')`)
    .bind(email, ip)
    .first<{ same: number | null; total: number }>();
  if ((fails?.same ?? 0) >= 8 || (fails?.total ?? 0) >= 30) throw new HttpError(429, "Too many wrong attempts. Please wait 15 minutes and try again.");

  // Guessing spread over many devices: after 20 wrong tries for one email from anywhere in 15 minutes, only
  // devices that logged in to this account before (last 60 days) may keep trying. The real owner is never locked out.
  const spread = await env.DB
    .prepare(`SELECT (SELECT COUNT(*) FROM login_attempts WHERE email = ? AND ok = 0 AND created_at > datetime('now', '-15 minutes')) AS fails,
                     (SELECT COUNT(*) FROM login_attempts WHERE email = ? AND ip = ? AND ok = 1 AND created_at > datetime('now', '-60 days')) AS known`)
    .bind(email, email, ip)
    .first<{ fails: number; known: number }>();
  const knownDevice = (spread?.known ?? 0) > 0;
  if ((spread?.fails ?? 0) >= 20 && !knownDevice) throw new HttpError(429, "Too many wrong attempts. Please wait 15 minutes and try again.");

  const u = await env.DB
    .prepare("SELECT id, email, name, role, pass_hash, pass_salt, totp_on, totp_secret, totp_last FROM admin_users WHERE email = ? AND active = 1")
    .bind(email)
    .first<User & { pass_hash: string; pass_salt: string; totp_on: number; totp_secret: string; totp_last: number }>();
  let ok = false;
  if (u) ok = safeEqual(await hashPassword(password, u.pass_salt), u.pass_hash);
  else await hashPassword(password, "00".repeat(16)); // same timing whether or not the email exists

  // Two-step login: after the right password, the 6-digit code from the authenticator app is also needed.
  if (ok && u && u.totp_on) {
    if (body.code === undefined || body.code === "") return json({ need_code: true });
    const step = await totpStep(u.totp_secret, body.code);
    // Each code works once: the step must be newer than the last one used (claimed atomically).
    const claimed = step === null ? null : await env.DB.prepare("UPDATE admin_users SET totp_last = ? WHERE id = ? AND totp_last < ? RETURNING id").bind(step, u.id, step).first();
    if (!claimed) {
      await env.DB.prepare("INSERT INTO login_attempts (email, ip, ok) VALUES (?, ?, 0)").bind(email, ip).run();
      throw new HttpError(401, step === null ? "Wrong 6-digit code. Check the time on your phone and try again." : "This code was already used. Wait for the next code in the app.");
    }
  }

  await env.DB.prepare("INSERT INTO login_attempts (email, ip, ok) VALUES (?, ?, ?)").bind(email, ip, ok ? 1 : 0).run();
  if (!ok || !u) throw new HttpError(401, "Wrong email or password");

  const token = randomHex(32);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 200);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at, ip, ua) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'), ?, ?)`).bind(await sha256(token), u.id, ip, ua),
    env.DB.prepare("UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
    env.DB.prepare("DELETE FROM login_attempts WHERE created_at < datetime('now', '-30 days')"),
  ]);
  const user: User = { id: u.id, email: u.email, name: u.name, role: u.role };
  await log(env.DB, user, "Logged in");
  // Security alert to the owner's Telegram when an admin logs in from a device not seen before.
  if (!knownDevice) emit(ctx, "admin.login", {}, `🔐 Admin login from a NEW device: ${user.name || user.email} (${user.role})\nIP ${ip || "?"} · ${ua.slice(0, 80)}\nNot you? Admin → Security → log out all devices and change the password.`);
  return json({ user }, 200, { "set-cookie": sessionCookie(token, SESSION_DAYS * 86400) });
}

async function logout({ request: req, env }: Ctx): Promise<Response> {
  const token = readCookie(req, COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

async function changeOwnPassword(env: Env, user: User, req: Request): Promise<Response> {
  const body = await readJson(req);
  const row = await env.DB.prepare("SELECT pass_hash, pass_salt FROM admin_users WHERE id = ?").bind(user.id).first<{ pass_hash: string; pass_salt: string }>();
  if (!row || !safeEqual(await hashPassword(String(body.current ?? ""), row.pass_salt), row.pass_hash)) {
    throw new HttpError(400, "Your current password is wrong");
  }
  const { hash, salt } = await newPassword(body.next, [user.email]);
  const token = readCookie(req, COOKIE);
  await env.DB.batch([
    env.DB.prepare("UPDATE admin_users SET pass_hash = ?, pass_salt = ? WHERE id = ?").bind(hash, salt, user.id),
    // Every other device is logged out.
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(user.id, await sha256(token)),
  ]);
  await log(env.DB, user, "Changed own password");
  return json({ ok: true });
}

async function confirmPassword(db: D1Database, me: User, pw: unknown) {
  const row = await db.prepare("SELECT pass_hash, pass_salt FROM admin_users WHERE id = ?").bind(me.id).first<{ pass_hash: string; pass_salt: string }>();
  if (!row || typeof pw !== "string" || !safeEqual(await hashPassword(pw, row.pass_salt), row.pass_hash)) {
    throw new HttpError(400, "Please type your own admin password to confirm this change");
  }
}

async function newPassword(v: unknown, personal: string[] = []): Promise<{ hash: string; salt: string }> {
  const pw = typeof v === "string" ? v : "";
  if (pw.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (pw.length > 200) throw new HttpError(400, "Password is too long");
  checkPasswordStrength(pw, personal);
  const salt = randomHex(16);
  return { hash: await hashPassword(pw, salt), salt };
}

// ============================ Categories ============================

async function categories(ctx: Ctx, user: User, m: string, b?: string, c?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;

  if (!b && m === "GET") {
    const r = await db.prepare(
      "SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count FROM categories c ORDER BY c.sort, c.name",
    ).all();
    return json({ categories: r.results });
  }

  if (!b && m === "POST") {
    const body = await readJson(req);
    const name = str(body.name, 60, "Name", true);
    const slug = await uniqueSlug(db, "categories", str(body.slug, 80) || name);
    const r = await db
      .prepare("INSERT INTO categories (slug, name, sub, art, color, sort, visible) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(slug, name, str(body.sub, 80, "Subtitle"), oneOf(body.art ?? "gift", ARTS, "Icon"), oneOf(body.color ?? "plum", COLORS, "Colour"),
        int(body.sort ?? 0, "Order", { min: 0, max: 9999 }), body.visible === undefined ? 1 : bool(body.visible))
      .run();
    await log(db, user, "Created category", name);
    await contentChanged(ctx, user);
    return json({ id: r.meta.last_row_id, slug }, 201);
  }

  const id = idParam(b, "Category");
  const cat = await db.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first<{ id: number; name: string; image_key: string | null }>();
  if (!cat) throw new HttpError(404, "Category not found");

  if (c === "image" && m === "POST") {
    const img = await readImage(req);
    const key = `c/${id}/${randomHex(8)}.${img.ext}`;
    await env.PHOTOS.put(key, img.data, { httpMetadata: { contentType: img.type } });
    await db.prepare("UPDATE categories SET image_key = ?, updated_at = datetime('now') WHERE id = ?").bind(key, id).run();
    if (cat.image_key) await env.PHOTOS.delete(cat.image_key);
    await log(db, user, "Changed category photo", cat.name);
    await contentChanged(ctx, user);
    return json({ image: `/img/${key}` });
  }
  if (c === "image" && m === "DELETE") {
    if (cat.image_key) await env.PHOTOS.delete(cat.image_key);
    await db.prepare("UPDATE categories SET image_key = NULL, updated_at = datetime('now') WHERE id = ?").bind(id).run();
    await contentChanged(ctx, user);
    return json({ ok: true });
  }
  if (c) throw new HttpError(404, "Not found");

  if (m === "PUT") {
    const body = await readJson(req);
    const sets: string[] = [];
    const vals: unknown[] = [];
    const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
    if (body.name !== undefined) put("name", str(body.name, 60, "Name", true));
    if (body.slug !== undefined) put("slug", await uniqueSlug(db, "categories", str(body.slug, 80) || String(body.name ?? cat.name), id));
    if (body.sub !== undefined) put("sub", str(body.sub, 80, "Subtitle"));
    if (body.art !== undefined) put("art", oneOf(body.art, ARTS, "Icon"));
    if (body.color !== undefined) put("color", oneOf(body.color, COLORS, "Colour"));
    if (body.sort !== undefined) put("sort", int(body.sort, "Order", { min: 0, max: 9999 }));
    if (body.visible !== undefined) put("visible", bool(body.visible));
    if (sets.length) {
      await db.prepare(`UPDATE categories SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, id).run();
      await log(db, user, "Updated category", String(body.name ?? cat.name));
      await contentChanged(ctx, user);
    }
    return json({ ok: true });
  }

  if (m === "DELETE") {
    const n = await db.prepare("SELECT COUNT(*) AS n FROM products WHERE category_id = ?").bind(id).first<{ n: number }>();
    if (n && n.n > 0) throw new HttpError(409, `This category still has ${n.n} product(s). Move them to another category or delete them first.`);
    await db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
    if (cat.image_key) await env.PHOTOS.delete(cat.image_key);
    await log(db, user, "Deleted category", cat.name);
    await contentChanged(ctx, user);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

// ============================ Products ============================

async function productValues(db: D1Database, body: Record<string, unknown>, creating: boolean, id?: number, current?: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const has = (k: string) => creating || body[k] !== undefined;
  if (has("name")) out.name = str(body.name, 120, "Name", true);
  if (creating || body.slug !== undefined) out.slug = await uniqueSlug(db, "products", str(body.slug, 80) || String(body.name ?? ""), id);
  if (has("category_id")) {
    const cid = int(body.category_id, "Category", { min: 1, nullable: true });
    if (cid !== null && !(await db.prepare("SELECT id FROM categories WHERE id = ?").bind(cid).first())) throw new HttpError(400, "That category does not exist");
    out.category_id = cid;
  }
  if (has("collection")) out.collection = str(body.collection, 40, "Collection");
  if (has("badge")) out.badge = str(body.badge ?? "Handmade", 30, "Badge") || "Handmade";
  if (has("summary")) out.summary = str(body.summary, 600, "Short description");
  if (has("details")) out.details = str(body.details, 4000, "Size & materials");
  if (has("price_inr")) out.price_inr = int(body.price_inr, "Price", { min: 0, max: 10_000_000, nullable: true });
  if (has("mrp_inr")) out.mrp_inr = int(body.mrp_inr, "MRP", { min: 0, max: 10_000_000, nullable: true });
  if (has("stock")) out.stock = int(body.stock ?? 0, "Stock", { min: 0, max: 1_000_000 });
  if (has("track_stock")) out.track_stock = body.track_stock === undefined ? 1 : bool(body.track_stock);
  if (has("status")) out.status = oneOf(body.status ?? "active", PRODUCT_STATUS, "Status");
  if (has("personalisable")) out.personalisable = bool(body.personalisable);
  if (has("occasions")) {
    const list = (Array.isArray(body.occasions) ? body.occasions.map(String) : String(body.occasions ?? "").split(","))
      .map((s) => s.trim()).filter((s) => /^[a-z0-9-]{1,80}$/.test(s));
    out.occasions = str([...new Set(list)].join(","), 600, "Occasions");
  }
  if (has("tone")) out.tone = oneOf(body.tone ?? "rose", TONES, "Card colour");
  if (has("art")) out.art = oneOf(body.art ?? "gift", ARTS, "Drawing");
  if (has("sort")) out.sort = int(body.sort ?? 0, "Order", { min: 0, max: 9999 });
  const price = "price_inr" in out ? out.price_inr : current?.price_inr;
  const mrp = "mrp_inr" in out ? out.mrp_inr : current?.mrp_inr;
  if (price != null && mrp != null && (mrp as number) < (price as number)) {
    throw new HttpError(400, "MRP cannot be lower than the selling price");
  }
  return out;
}

async function products(ctx: Ctx, user: User, m: string, b?: string, c?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;

  if (!b && m === "GET") {
    const r = await db.prepare(
      `SELECT p.id, p.slug, p.name, p.price_inr, p.mrp_inr, p.stock, p.track_stock, p.status, p.collection, p.tone, p.art, p.updated_at,
         c.name AS category_name, p.category_id, p.seller_id, p.review_status, sl.shop_name,
         (SELECT key FROM product_images i WHERE i.product_id = p.id ORDER BY sort, id LIMIT 1) AS image_key,
         (SELECT COUNT(*) FROM product_images i WHERE i.product_id = p.id) AS image_count
       FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN sellers sl ON sl.id = p.seller_id ORDER BY p.sort, p.id DESC`,
    ).all();
    return json({ products: r.results });
  }

  if (!b && m === "POST") {
    const v = await productValues(db, await readJson(req), true);
    v.seller_id = 1; // Products added in the admin belong to the house shop "Insi House Originals".
    const cols = Object.keys(v);
    const r = await db.prepare(`INSERT INTO products (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...cols.map((k) => v[k])).run();
    await log(db, user, "Created product", String(v.name));
    await contentChanged(ctx, user);
    return json({ id: r.meta.last_row_id, slug: v.slug }, 201);
  }

  const id = idParam(b, "Product");
  const p = await db.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<Record<string, unknown> & { name: string }>();
  if (!p) throw new HttpError(404, "Product not found");

  if (c === "images" && m === "POST") {
    const count = await db.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(sort), 0) AS mx FROM product_images WHERE product_id = ?").bind(id).first<{ n: number; mx: number }>();
    if ((count?.n ?? 0) >= 12) throw new HttpError(400, "A product can have up to 12 photos");
    const img = await readImage(req);
    const key = `p/${id}/${randomHex(8)}.${img.ext}`;
    await env.PHOTOS.put(key, img.data, { httpMetadata: { contentType: img.type } });
    const r = await db.prepare("INSERT INTO product_images (product_id, key, sort) VALUES (?, ?, ?)").bind(id, key, (count?.mx ?? 0) + 1).run();
    await db.prepare("UPDATE products SET updated_at = datetime('now') WHERE id = ?").bind(id).run();
    await log(db, user, "Added product photo", p.name);
    await contentChanged(ctx, user);
    return json({ id: r.meta.last_row_id, key, url: `/img/${key}` }, 201);
  }
  if (c === "images" && m === "PUT") {
    const body = await readJson<{ order?: unknown[] }>(req);
    const ids = (body.order ?? []).map((x) => Number(x)).filter((x) => Number.isInteger(x));
    await db.batch(ids.map((imgId, i) => db.prepare("UPDATE product_images SET sort = ? WHERE id = ? AND product_id = ?").bind(i + 1, imgId, id)));
    await contentChanged(ctx, user);
    return json({ ok: true });
  }
  if (c) throw new HttpError(404, "Not found");

  if (m === "GET") {
    const imgs = await db.prepare("SELECT id, key, sort FROM product_images WHERE product_id = ? ORDER BY sort, id").bind(id).all<{ id: number; key: string }>();
    return json({ product: p, images: imgs.results.map((i) => ({ ...i, url: `/img/${i.key}` })) });
  }

  if (m === "PUT") {
    const v = await productValues(db, await readJson(req), false, id, p);
    const cols = Object.keys(v);
    if (cols.length) {
      await db.prepare(`UPDATE products SET ${cols.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...cols.map((k) => v[k]), id).run();
      const what = cols.length === 1 && cols[0] === "stock" ? `stock → ${v.stock}` : cols.length === 1 && cols[0] === "status" ? `status → ${v.status}` : "";
      await log(db, user, "Updated product", `${String(v.name ?? p.name)}${what ? ` (${what})` : ""}`);
      await contentChanged(ctx, user);
    }
    return json({ ok: true, slug: v.slug ?? p.slug });
  }

  if (m === "DELETE") {
    const imgs = await db.prepare("SELECT key FROM product_images WHERE product_id = ?").bind(id).all<{ key: string }>();
    await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
    if (imgs.results.length) await env.PHOTOS.delete(imgs.results.map((i) => i.key));
    await log(db, user, "Deleted product", p.name);
    await contentChanged(ctx, user);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

async function deleteProductImage(ctx: Ctx, user: User, imgIdRaw: string): Promise<Response> {
  const { env } = ctx;
  const imgId = idParam(imgIdRaw, "Photo");
  const img = await env.DB.prepare("SELECT i.id, i.key, p.name FROM product_images i JOIN products p ON p.id = i.product_id WHERE i.id = ?").bind(imgId).first<{ key: string; name: string }>();
  if (!img) throw new HttpError(404, "Photo not found");
  await env.DB.prepare("DELETE FROM product_images WHERE id = ?").bind(imgId).run();
  await env.PHOTOS.delete(img.key);
  await log(env.DB, user, "Removed product photo", img.name);
  await contentChanged(ctx, user);
  return json({ ok: true });
}

// ============================ Orders ============================

interface OrderItem { productId: number | null; name: string; qty: number; priceInr: number }

function parseItems(v: unknown): OrderItem[] {
  if (!Array.isArray(v) || v.length === 0) throw new HttpError(400, "Add at least one item to the order");
  if (v.length > 50) throw new HttpError(400, "Too many items");
  return v.map((raw, i) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    return {
      productId: int(it.productId, `Item ${i + 1} product`, { min: 1, nullable: true }),
      name: str(it.name, 120, `Item ${i + 1} name`, true),
      qty: int(it.qty ?? 1, `Item ${i + 1} quantity`, { min: 1, max: 999 }) as number,
      priceInr: int(it.priceInr ?? 0, `Item ${i + 1} price`, { min: 0, max: 10_000_000 }) as number,
    };
  });
}

/** Stock moves: sign -1 when an order takes stock, +1 when it gives it back. */
function stockStatements(db: D1Database, items: OrderItem[], sign: 1 | -1) {
  return items
    .filter((i) => i.productId)
    .map((i) =>
      db.prepare(`UPDATE products SET stock = MAX(0, stock + ?), updated_at = datetime('now') WHERE id = ? AND track_stock = 1`).bind(sign * i.qty, i.productId),
    );
}

const HOLDS_STOCK = (s: string) => s !== "cancelled" && s !== "returned";

async function orders(ctx: Ctx, user: User, m: string, b?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;

  if (b === "export" && m === "GET") return exportOrders(ctx, user);
  if (!b && m === "GET") {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim();
    const where: string[] = [];
    const vals: unknown[] = [];
    if (status && (ORDER_STATUS as readonly string[]).includes(status)) { where.push("status = ?"); vals.push(status); }
    if (q) { where.push("(number LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR pincode LIKE ?)"); vals.push(...Array(4).fill(`%${q}%`)); }
    if (url.searchParams.get("pay") === "check") where.push("payment_status = 'pending' AND payment_ref != ''");
    const cust = Number(url.searchParams.get("customer"));
    if (Number.isInteger(cust) && cust > 0) { where.push("customer_id = ?"); vals.push(cust); }
    const r = await db
      .prepare(`SELECT id, number, customer_name, phone, city, pincode, total, status, payment_status, payment_method, payment_ref, courier, awb, source, customer_id, coupon_code, occasion, created_at FROM orders ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT 300`)
      .bind(...vals)
      .all();
    return json({ orders: r.results });
  }

  if (!b && m === "POST") {
    const body = await readJson(req);
    const items = parseItems(body.items);
    const subtotal = items.reduce((s, i) => s + i.qty * i.priceInr, 0);
    const shipping = int(body.shipping ?? 0, "Shipping", { min: 0, max: 100_000 }) as number;
    const discount = int(body.discount ?? 0, "Discount", { min: 0, max: 10_000_000 }) as number;
    const pincode = str(body.pincode, 6, "PIN code");
    if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) throw new HttpError(400, "PIN code must be 6 digits");
    const phone = str(body.phone, 20, "Phone").replace(/[\s-]/g, "");
    if (phone && !/^(\+?91)?[6-9][0-9]{9}$/.test(phone)) throw new HttpError(400, "Enter a valid 10-digit Indian mobile number");
    const r = await db
      .prepare(`INSERT INTO orders (customer_name, phone, email, address, city, state, pincode, items, subtotal, shipping, discount, total, payment_status, payment_ref, notes, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        str(body.customer_name, 100, "Customer name", true), phone, str(body.email, 120, "Email"), str(body.address, 400, "Address"),
        str(body.city, 60, "City"), str(body.state, 60, "State"), pincode, JSON.stringify(items), subtotal, shipping, discount,
        Math.max(0, subtotal + shipping - discount), oneOf(body.payment_status ?? "pending", PAY_STATUS, "Payment"),
        str(body.payment_ref, 80, "Payment reference"), str(body.notes, 1000, "Notes"), str(body.source ?? "whatsapp", 30, "Source") || "whatsapp",
      )
      .run();
    const id = r.meta.last_row_id as number;
    const number = `IH${1000 + id}`;
    await db.batch([
      db.prepare("UPDATE orders SET number = ? WHERE id = ?").bind(number, id),
      db.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, 'new', 'Order created', ?)").bind(id, user.name || user.email),
      ...stockStatements(db, items, -1),
    ]);
    await log(db, user, "Created order", number);
    if (items.some((i) => i.productId)) await contentChanged(ctx, user);
    return json({ id, number }, 201);
  }

  const id = idParam(b, "Order");
  const o = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<Record<string, unknown> & { status: string; number: string; items: string }>();
  if (!o) throw new HttpError(404, "Order not found");

  if (m === "GET") {
    const ev = await db.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id DESC").bind(id).all();
    return json({ order: { ...o, items: JSON.parse(o.items || "[]") }, events: ev.results });
  }

  if (m === "PUT") {
    const body = await readJson(req);
    const sets: string[] = [];
    const vals: unknown[] = [];
    const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
    const textFields: [string, number][] = [["customer_name", 100], ["email", 120], ["address", 400], ["city", 60], ["state", 60], ["payment_ref", 80], ["courier", 60], ["awb", 60], ["tracking_url", 300], ["notes", 1000]];
    for (const [k, max] of textFields) if (body[k] !== undefined) put(k, str(body[k], max, k));
    if (body.phone !== undefined) put("phone", str(body.phone, 20, "Phone").replace(/[\s-]/g, ""));
    if (body.pincode !== undefined) {
      const pin = str(body.pincode, 6, "PIN code");
      if (pin && !/^[1-9][0-9]{5}$/.test(pin)) throw new HttpError(400, "PIN code must be 6 digits");
      put("pincode", pin);
    }
    if (body.tracking_url !== undefined && body.tracking_url && !/^https:\/\//.test(String(body.tracking_url))) throw new HttpError(400, "Tracking link must start with https://");
    if (body.payment_status !== undefined) put("payment_status", oneOf(body.payment_status, PAY_STATUS, "Payment"));

    const extra: ReturnType<D1Database["prepare"]>[] = [];
    const notes: string[] = [];
    let newStatus = o.status;
    if (body.status !== undefined && body.status !== o.status) {
      newStatus = oneOf(body.status, ORDER_STATUS, "Status");
      put("status", newStatus);
      const items = JSON.parse(o.items || "[]") as OrderItem[];
      if (HOLDS_STOCK(o.status) && !HOLDS_STOCK(newStatus)) extra.push(...stockStatements(db, items, 1));
      if (!HOLDS_STOCK(o.status) && HOLDS_STOCK(newStatus)) extra.push(...stockStatements(db, items, -1));
      notes.push(`Status: ${o.status} → ${newStatus}`);
    }
    if (body.payment_status !== undefined && body.payment_status !== o.payment_status) notes.push(`Payment: ${String(o.payment_status)} → ${String(body.payment_status)}`);
    if (body.awb !== undefined && body.awb !== o.awb && body.awb) notes.push(`Tracking: ${String(body.courier ?? o.courier)} ${String(body.awb)}`);
    if (body.event_note) notes.push(str(body.event_note, 300, "Note"));

    if (sets.length || notes.length) {
      const stmts = [];
      if (sets.length) stmts.push(db.prepare(`UPDATE orders SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, id));
      if (notes.length) stmts.push(db.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, ?, ?, ?)").bind(id, newStatus, notes.join(" · "), user.name || user.email));
      await db.batch([...stmts, ...extra]);
      await log(db, user, "Updated order", `${o.number}${notes.length ? `: ${notes.join(" · ")}` : ""}`);
      if (extra.length) await contentChanged(ctx, user);
      if (newStatus !== o.status) emit(ctx, "order.updated", { number: o.number, status: newStatus, previous: o.status, courier: body.courier ?? o.courier, awb: body.awb ?? o.awb });
      if (body.payment_status === "paid" && o.payment_status !== "paid") emit(ctx, "order.paid", { number: o.number, amount: o.total, via: "manual" });
    }
    return json({ ok: true });
  }

  if (m === "DELETE") {
    requireOwner(user);
    const items = JSON.parse(o.items || "[]") as OrderItem[];
    await db.batch([db.prepare("DELETE FROM orders WHERE id = ?").bind(id), ...(HOLDS_STOCK(o.status) ? stockStatements(db, items, 1) : [])]);
    await log(db, user, "Deleted order", o.number);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

/** Orders as a CSV file that opens in Excel / Google Sheets. Owner only (it has customer phone numbers). */
async function exportOrders(ctx: Ctx, user: User): Promise<Response> {
  requireOwner(user);
  const url = new URL(ctx.request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const where: string[] = [];
  const vals: unknown[] = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where.push("date(created_at, '+330 minutes') >= ?"); vals.push(from); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where.push("date(created_at, '+330 minutes') <= ?"); vals.push(to); }
  const r = await ctx.env.DB.prepare(`SELECT * FROM orders ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id LIMIT 20000`).bind(...vals).all<Record<string, unknown>>();
  // Cells starting with = + - @ are prefixed so Excel never runs them as formulas.
  const cell = (v: unknown) => {
    let t = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const head = ["Order", "Date (IST)", "Status", "Payment", "Method", "UTR / payment ref", "Customer", "Mobile", "Email", "Address", "City", "State", "PIN",
    "Items", "Subtotal", "Delivery", "Discount", "Coupon", "Total", "Occasion", "Courier", "Tracking no.", "Source", "Gift message"];
  const ist = (s: unknown) => { const d = new Date(`${String(s).replace(" ", "T")}Z`); return Number.isNaN(d.getTime()) ? String(s) : new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16).replace("T", " "); };
  const rows = r.results.map((o) => [
    o.number, ist(o.created_at), o.status, o.payment_status, o.payment_method, o.payment_ref, o.customer_name, o.phone, o.email, o.address, o.city, o.state, o.pincode,
    (JSON.parse(String(o.items || "[]")) as { name: string; qty: number; priceInr: number }[]).map((i) => `${i.name} x${i.qty} @${i.priceInr}`).join("; "),
    o.subtotal, o.shipping, o.discount, o.coupon_code, o.total, o.occasion, o.courier, o.awb, o.source, o.gift_message,
  ].map(cell).join(","));
  await log(ctx.env.DB, user, "Exported orders", `${r.results.length} orders${from || to ? ` (${from || "start"} → ${to || "today"})` : ""}`);
  const name = `insihouse-orders-${new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)}.csv`;
  return new Response(`\uFEFF${[head.map(cell).join(","), ...rows].join("\r\n")}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

// ============================ Settings ============================

async function settings(ctx: Ctx, user: User, m: string): Promise<Response> {
  const { env, request: req } = ctx;
  const keys = [...PUBLIC_SETTINGS, ...PRIVATE_SETTINGS];
  if (m === "GET") {
    const r = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => "?").join(",")})`).bind(...keys).all<{ key: string; value: string }>();
    const out: Record<string, string> = Object.fromEntries(keys.map((k) => [k, ""]));
    for (const row of r.results) out[row.key] = row.value;
    return json({ settings: out });
  }
  if (m === "PUT") {
    requireOwner(user);
    const body = await readJson(req);
    const v: Record<string, string> = {};
    if (body.whatsapp !== undefined) {
      const w = str(body.whatsapp, 20, "WhatsApp").replace(/[^0-9]/g, "");
      if (w && !/^91[6-9][0-9]{9}$/.test(w)) throw new HttpError(400, "WhatsApp number must be 91 followed by a 10-digit mobile number, e.g. 919876543210");
      v.whatsapp = w;
    }
    if (body.email !== undefined) {
      const e = str(body.email, 120, "Email");
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, "Enter a valid email address");
      v.email = e;
    }
    if (body.announcement !== undefined) v.announcement = str(body.announcement, 160, "Announcement bar");
    if (body.delivery !== undefined) v.delivery = str(body.delivery, 80, "Delivery line");
    if (body.instagram !== undefined) v.instagram = str(body.instagram, 60, "Instagram").replace(/^@/, "");
    if (body.upi_id !== undefined) {
      const u = str(body.upi_id, 80, "UPI ID");
      if (u && !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(u)) throw new HttpError(400, "UPI ID looks wrong, e.g. insihouse@ybl");
      v.upi_id = u;
    }
    if (body.require_login !== undefined) v.require_login = bool(body.require_login) ? "1" : "0";
    if (body.cod_enabled !== undefined) v.cod_enabled = bool(body.cod_enabled) ? "1" : "0";
    if (body.local_pins !== undefined) {
      const list = String(body.local_pins ?? "").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
      if (list.length > 60 || list.some((x) => !/^[1-9][0-9]{1,5}$/.test(x))) throw new HttpError(400, "Local PIN codes: write PIN codes or their first digits, separated by commas, e.g. 276001, 276, 275");
      v.local_pins = list.join(",");
    }
    if (body.local_label !== undefined) v.local_label = str(body.local_label, 60, "Local delivery name");
    for (const k of ["local_fee", "local_free_above"] as const) {
      if (body[k] === undefined) continue;
      const n = String(body[k] ?? "").replace(/[^0-9]/g, "");
      if (n && Number(n) > 100_000) throw new HttpError(400, "Delivery amounts look too high");
      v[k] = n;
    }
    if (body.business_name !== undefined) v.business_name = str(body.business_name, 100, "Business name");
    if (body.business_address !== undefined) v.business_address = str(body.business_address, 400, "Business address");
    if (body.business_phone !== undefined) v.business_phone = str(body.business_phone, 30, "Business phone");
    if (body.invoice_note !== undefined) v.invoice_note = str(body.invoice_note, 300, "Bill note");
    if (body.gstin !== undefined) {
      const g = str(body.gstin, 15, "GSTIN").toUpperCase();
      if (g && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) throw new HttpError(400, "GSTIN looks wrong. It has 15 characters, e.g. 09ABCDE1234F1Z5");
      v.gstin = g;
    }
    if (body.hold_hours !== undefined) {
      const h = String(body.hold_hours ?? "").replace(/[^0-9]/g, "");
      if (h && Number(h) > 720) throw new HttpError(400, "Hours must be 720 (30 days) or less");
      v.hold_hours = h;
    }
    for (const k of ["shipping_fee", "free_shipping_above", "cod_fee"] as const) {
      if (body[k] === undefined) continue;
      const n = String(body[k] ?? "").replace(/[^0-9]/g, "");
      if (n && Number(n) > 100_000) throw new HttpError(400, "Delivery amounts look too high");
      v[k] = n;
    }
    for (const [k, val] of Object.entries(v)) await setSetting(env.DB, k, val);
    await log(env.DB, user, "Updated settings", Object.keys(v).join(", "));
    await contentChanged(ctx, user);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

// ============================ Users ============================

async function users(env: Env, me: User, m: string, b: string | undefined, req: Request): Promise<Response> {
  const db = env.DB;
  if (!b && m === "GET") {
    const r = await db.prepare("SELECT id, email, name, role, active, totp_on, last_login_at, created_at FROM admin_users ORDER BY role, name").all();
    return json({ users: r.results });
  }
  if (!b && m === "POST") {
    const body = await readJson(req);
    await confirmPassword(db, me, body.my_password);
    const email = str(body.email, 120, "Email", true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
    if (await db.prepare("SELECT id FROM admin_users WHERE email = ?").bind(email).first()) throw new HttpError(409, "A user with this email already exists");
    const { hash, salt } = await newPassword(body.password, [email]);
    const r = await db
      .prepare("INSERT INTO admin_users (email, name, role, pass_hash, pass_salt) VALUES (?, ?, ?, ?, ?)")
      .bind(email, str(body.name, 60, "Name", true), oneOf(body.role ?? "staff", ["owner", "staff"] as const, "Role"), hash, salt)
      .run();
    await log(db, me, "Added team member", email);
    return json({ id: r.meta.last_row_id }, 201);
  }

  const id = idParam(b, "User");
  const u = await db.prepare("SELECT id, email, role, active FROM admin_users WHERE id = ?").bind(id).first<{ id: number; email: string; role: Role; active: number }>();
  if (!u) throw new HttpError(404, "User not found");
  const otherOwners = async () =>
    (await db.prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role = 'owner' AND active = 1 AND id != ?").bind(id).first<{ n: number }>())?.n ?? 0;

  if (m === "PUT") {
    const body = await readJson(req);
    if (body.password !== undefined || body.role !== undefined || body.reset_2fa !== undefined) {
      // Sensitive team changes need the owner's own password again (a stolen session alone is not enough).
      if (id === me.id && (body.password !== undefined || body.reset_2fa !== undefined)) throw new HttpError(400, "Change your own password and two-step login on the Security and Settings pages");
      await confirmPassword(db, me, body.my_password);
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
    let endSessions = false;
    if (body.name !== undefined) put("name", str(body.name, 60, "Name", true));
    if (body.role !== undefined) {
      const role = oneOf(body.role, ["owner", "staff"] as const, "Role");
      if (u.role === "owner" && role !== "owner" && (await otherOwners()) === 0) throw new HttpError(400, "There must always be at least one owner");
      if (id === me.id && role !== "owner") throw new HttpError(400, "You cannot remove your own owner role");
      put("role", role);
    }
    if (body.active !== undefined) {
      const active = bool(body.active);
      if (!active && id === me.id) throw new HttpError(400, "You cannot switch off your own account");
      if (!active && u.role === "owner" && (await otherOwners()) === 0) throw new HttpError(400, "There must always be at least one owner");
      put("active", active);
      if (!active) endSessions = true;
    }
    if (body.reset_2fa === true) {
      put("totp_on", 0);
      put("totp_secret", "");
      put("totp_last", 0);
      endSessions = true;
    }
    if (body.password) {
      const { hash, salt } = await newPassword(body.password, [u.email]);
      put("pass_hash", hash);
      put("pass_salt", salt);
      endSessions = id !== me.id;
    }
    if (sets.length) {
      const stmts = [db.prepare(`UPDATE admin_users SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id)];
      if (endSessions) stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id));
      await db.batch(stmts);
      await log(db, me, "Updated team member", u.email);
    }
    return json({ ok: true });
  }

  if (m === "DELETE") {
    if (id === me.id) throw new HttpError(400, "You cannot delete your own account");
    if (u.role === "owner" && (await otherOwners()) === 0) throw new HttpError(400, "There must always be at least one owner");
    await db.prepare("DELETE FROM admin_users WHERE id = ?").bind(id).run();
    await log(db, me, "Removed team member", u.email);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

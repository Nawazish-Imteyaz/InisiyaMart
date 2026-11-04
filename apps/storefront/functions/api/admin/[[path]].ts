// /api/admin/* — the admin console API. Every route except login needs a valid session cookie.
import {
  bool, getSetting, hashPassword, HttpError, int, json, oneOf, PUBLIC_SETTINGS, randomHex, readJson, safeEqual,
  setSetting, sha256, slugify, str, type Ctx, type D1Database, type Env,
} from "../../_lib/util";

type Role = "owner" | "staff";
interface User { id: number; email: string; name: string; role: Role }

const COOKIE = "ih_admin";
const SESSION_DAYS = 7;
const PUBLISH_GAP_MS = 3 * 60 * 1000; // at most one website rebuild every 3 minutes (free plan: 500 builds/month)
const MAX_UPLOAD = 8 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

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
  if (a === "me" && m === "GET") return json({ user });
  if (a === "me" && b === "password" && m === "PUT") return changeOwnPassword(env, user, req);
  if (a === "dashboard" && m === "GET") return dashboard(env);
  if (a === "publish") return m === "POST" ? json(await publish(env, user, true)) : json(await publishState(env));
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

function readCookie(req: Request, name: string): string {
  const h = req.headers.get("cookie") ?? "";
  for (const part of h.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return "";
}

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

function requireOwner(user: User) {
  if (user.role !== "owner") throw new HttpError(403, "Only the owner can do this");
}

async function login({ request: req, env }: Ctx): Promise<Response> {
  const body = await readJson(req);
  const email = str(body.email, 120, "Email", true).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const ip = req.headers.get("cf-connecting-ip") ?? "";

  // Limit guesses per device: 8 wrong tries for one email, or 30 in total, per 15 minutes.
  // (Counting per device, not per email alone, so nobody can lock the owner out from elsewhere.)
  const fails = await env.DB
    .prepare(`SELECT SUM(email = ?) AS same, COUNT(*) AS total FROM login_attempts
              WHERE ok = 0 AND ip = ? AND created_at > datetime('now', '-15 minutes')`)
    .bind(email, ip)
    .first<{ same: number | null; total: number }>();
  if ((fails?.same ?? 0) >= 8 || (fails?.total ?? 0) >= 30) throw new HttpError(429, "Too many wrong attempts. Please wait 15 minutes and try again.");

  const u = await env.DB
    .prepare("SELECT id, email, name, role, pass_hash, pass_salt FROM admin_users WHERE email = ? AND active = 1")
    .bind(email)
    .first<User & { pass_hash: string; pass_salt: string }>();
  let ok = false;
  if (u) ok = safeEqual(await hashPassword(password, u.pass_salt), u.pass_hash);
  else await hashPassword(password, "00".repeat(16)); // same timing whether or not the email exists

  await env.DB.prepare("INSERT INTO login_attempts (email, ip, ok) VALUES (?, ?, ?)").bind(email, ip, ok ? 1 : 0).run();
  if (!ok || !u) throw new HttpError(401, "Wrong email or password");

  const token = randomHex(32);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`).bind(await sha256(token), u.id),
    env.DB.prepare("UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
    env.DB.prepare("DELETE FROM login_attempts WHERE created_at < datetime('now', '-30 days')"),
  ]);
  const user: User = { id: u.id, email: u.email, name: u.name, role: u.role };
  await log(env.DB, user, "Logged in");
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
  const { hash, salt } = await newPassword(body.next);
  await env.DB.prepare("UPDATE admin_users SET pass_hash = ?, pass_salt = ? WHERE id = ?").bind(hash, salt, user.id).run();
  await log(env.DB, user, "Changed own password");
  return json({ ok: true });
}

async function newPassword(v: unknown): Promise<{ hash: string; salt: string }> {
  const pw = typeof v === "string" ? v : "";
  if (pw.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (pw.length > 200) throw new HttpError(400, "Password is too long");
  const salt = randomHex(16);
  return { hash: await hashPassword(pw, salt), salt };
}

// ============================ Helpers ============================

async function log(db: D1Database, user: User, action: string, detail = "") {
  await db.prepare("INSERT INTO activity (user_name, action, detail) VALUES (?, ?, ?)").bind(user.name || user.email, action, detail.slice(0, 500)).run();
}

async function uniqueSlug(db: D1Database, table: "products" | "categories", base: string, excludeId?: number): Promise<string> {
  const root = slugify(base);
  for (let i = 1; i < 200; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    const hit = await db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`).bind(slug, excludeId ?? 0).first();
    if (!hit) return slug;
  }
  return `${root}-${randomHex(3)}`;
}

function idParam(v: string | undefined, what: string): number {
  const n = Number(v);
  if (!v || !Number.isInteger(n) || n < 1) throw new HttpError(404, `${what} not found`);
  return n;
}

/** Website content changed → remember it and rebuild the website (throttled). */
async function contentChanged(ctx: Ctx, user: User) {
  await setSetting(ctx.env.DB, "_last_change", new Date().toISOString());
  ctx.waitUntil(publish(ctx.env, user, false).catch((e) => console.error("publish failed", e)));
}

async function publishState(env: Env) {
  const [lastChange, lastPublish] = await Promise.all([getSetting(env.DB, "_last_change"), getSetting(env.DB, "_last_publish")]);
  return {
    hook: !!env.DEPLOY_HOOK_URL,
    lastChange: lastChange || null,
    lastPublish: lastPublish || null,
    pending: !!lastChange && (!lastPublish || lastChange > lastPublish),
    nextAllowedAt: lastPublish ? new Date(Date.parse(lastPublish) + PUBLISH_GAP_MS).toISOString() : null,
  };
}

async function publish(env: Env, user: User, manual: boolean) {
  if (!env.DEPLOY_HOOK_URL) return { ...(await publishState(env)), started: false, reason: "The deploy hook is not set up yet" };
  const last = await getSetting(env.DB, "_last_publish");
  if (last && Date.now() - Date.parse(last) < PUBLISH_GAP_MS) {
    return { ...(await publishState(env)), started: false, reason: "The website was refreshed less than 3 minutes ago. It will refresh again automatically." };
  }
  const r = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
  if (!r.ok) return { ...(await publishState(env)), started: false, reason: `Cloudflare refused the rebuild (HTTP ${r.status})` };
  await setSetting(env.DB, "_last_publish", new Date().toISOString());
  if (manual) await log(env.DB, user, "Refreshed the website");
  return { ...(await publishState(env)), started: true };
}

async function readImage(req: Request): Promise<{ data: ArrayBuffer; type: string; ext: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Please choose a photo to upload");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "Please choose a photo to upload");
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new HttpError(400, "Photos must be JPG, PNG or WebP");
  if (file.size > MAX_UPLOAD) throw new HttpError(400, "Photo is too large (max 8 MB)");
  return { data: await file.arrayBuffer(), type: file.type, ext };
}

// ============================ Dashboard ============================

async function dashboard(env: Env): Promise<Response> {
  const db = env.DB;
  const [prod, orderCounts, today, month, recent, low] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total,
        SUM(status = 'active') AS active,
        SUM(status = 'active' AND track_stock = 1 AND stock <= 0) AS out_of_stock,
        SUM(status = 'active' AND track_stock = 1 AND stock BETWEEN 1 AND 3) AS low_stock
      FROM products`),
    db.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status"),
    db.prepare("SELECT COUNT(*) AS n FROM orders WHERE date(created_at, '+330 minutes') = date('now', '+330 minutes')"),
    db.prepare(`SELECT COALESCE(SUM(total), 0) AS sales, COUNT(*) AS n FROM orders
      WHERE status NOT IN ('cancelled','returned') AND strftime('%Y-%m', created_at, '+330 minutes') = strftime('%Y-%m', 'now', '+330 minutes')`),
    db.prepare("SELECT id, number, customer_name, total, status, payment_status, created_at FROM orders ORDER BY id DESC LIMIT 6"),
    db.prepare(`SELECT id, name, stock FROM products WHERE status = 'active' AND track_stock = 1 AND stock <= 3 ORDER BY stock, name LIMIT 8`),
  ]);
  const byStatus: Record<string, number> = {};
  for (const r of orderCounts.results as { status: string; n: number }[]) byStatus[r.status] = r.n;
  const cats = await db.prepare("SELECT COUNT(*) AS n FROM categories").first<{ n: number }>();
  return json({
    products: prod.results[0],
    categories: cats?.n ?? 0,
    ordersByStatus: byStatus,
    ordersToday: (today.results[0] as { n: number }).n,
    month: month.results[0],
    recentOrders: recent.results,
    lowStock: low.results,
    publish: await publishState(env),
  });
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
    const list = Array.isArray(body.occasions) ? body.occasions.map(String) : String(body.occasions ?? "").split(",");
    out.occasions = str(list.map((s) => s.trim()).filter(Boolean).join(","), 300, "Occasions");
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
         c.name AS category_name, p.category_id,
         (SELECT key FROM product_images i WHERE i.product_id = p.id ORDER BY sort, id LIMIT 1) AS image_key,
         (SELECT COUNT(*) FROM product_images i WHERE i.product_id = p.id) AS image_count
       FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.sort, p.id DESC`,
    ).all();
    return json({ products: r.results });
  }

  if (!b && m === "POST") {
    const v = await productValues(db, await readJson(req), true);
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

  if (!b && m === "GET") {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim();
    const where: string[] = [];
    const vals: unknown[] = [];
    if (status && (ORDER_STATUS as readonly string[]).includes(status)) { where.push("status = ?"); vals.push(status); }
    if (q) { where.push("(number LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR pincode LIKE ?)"); vals.push(...Array(4).fill(`%${q}%`)); }
    const r = await db
      .prepare(`SELECT id, number, customer_name, phone, city, pincode, total, status, payment_status, courier, awb, created_at FROM orders ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT 300`)
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

// ============================ Settings ============================

async function settings(ctx: Ctx, user: User, m: string): Promise<Response> {
  const { env, request: req } = ctx;
  const keys = [...PUBLIC_SETTINGS, "upi_id"] as const;
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
    const r = await db.prepare("SELECT id, email, name, role, active, last_login_at, created_at FROM admin_users ORDER BY role, name").all();
    return json({ users: r.results });
  }
  if (!b && m === "POST") {
    const body = await readJson(req);
    const email = str(body.email, 120, "Email", true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
    if (await db.prepare("SELECT id FROM admin_users WHERE email = ?").bind(email).first()) throw new HttpError(409, "A user with this email already exists");
    const { hash, salt } = await newPassword(body.password);
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
    if (body.password) {
      const { hash, salt } = await newPassword(body.password);
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

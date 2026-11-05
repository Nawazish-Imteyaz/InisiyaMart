// Admin console sections added in v2: dashboard analytics, notifications, occasions, customers, enquiries,
// coupons, partner integrations (encrypted keys), outgoing webhooks, and account security (2-step login, sessions).
import { contentChanged, idParam, log, publishState, readImage, requireOwner, uniqueSlug, type User } from "./admin-core";
import { decryptJson, hashPassword, hmacHex, HttpError, int, json, oneOf, randomBase32, randomHex, readCookie, readJson, safeEqual, sha256, str, totpOk, bool, type Ctx, type D1Database, type Env } from "./util";
import { isSafeHookUrl, newHookSecret, providerDef, PROVIDERS, saveSecrets, testIntegration, WEBHOOK_EVENTS } from "./providers";

const COLORS = ["plum", "ink", "rani", "marigold", "peacock", "lilac", "rose"] as const;
const IST = "'+330 minutes'";

async function checkPassword(db: D1Database, user: User, pw: unknown) {
  const row = await db.prepare("SELECT pass_hash, pass_salt FROM admin_users WHERE id = ?").bind(user.id).first<{ pass_hash: string; pass_salt: string }>();
  if (!row || typeof pw !== "string" || !safeEqual(await hashPassword(pw, row.pass_salt), row.pass_hash)) {
    throw new HttpError(400, "Please type your admin password correctly to confirm this change");
  }
}

// ============================ Dashboard ============================
const PERIODS: Record<string, number | null> = { week: 7, month: 30, year: 365, all: null };

export async function dashboard(env: Env, url: URL): Promise<Response> {
  const db = env.DB;
  const period = url.searchParams.get("period") ?? "month";
  const days = period in PERIODS ? PERIODS[period] : 30;
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
  const from = days ? iso(now - days * 86400_000) : "1970-01-01 00:00:00";
  const prevFrom = days ? iso(now - 2 * days * 86400_000) : null;
  const LIVE = "status NOT IN ('cancelled','returned')";
  const bucket = days && days <= 31 ? `date(created_at, ${IST})` : `strftime('%Y-%m', created_at, ${IST})`;

  const [cur, prev, custCur, custPrev, series, byStatus, prod, recent, low, enq, utr] = await db.batch([
    db.prepare(`SELECT COALESCE(SUM(total),0) AS sales, COUNT(*) AS orders FROM orders WHERE ${LIVE} AND created_at >= ?`).bind(from),
    db.prepare(`SELECT COALESCE(SUM(total),0) AS sales, COUNT(*) AS orders FROM orders WHERE ${LIVE} AND created_at >= ? AND created_at < ?`).bind(prevFrom ?? from, from),
    db.prepare("SELECT COUNT(*) AS n FROM customers WHERE status != 'deleted' AND created_at >= ?").bind(from),
    db.prepare("SELECT COUNT(*) AS n FROM customers WHERE status != 'deleted' AND created_at >= ? AND created_at < ?").bind(prevFrom ?? from, from),
    db.prepare(`SELECT ${bucket} AS b, COALESCE(SUM(total),0) AS sales, COUNT(*) AS orders FROM orders WHERE ${LIVE} AND created_at >= ? GROUP BY b ORDER BY b`).bind(from),
    db.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status"),
    db.prepare(`SELECT COUNT(*) AS total, SUM(status = 'active') AS active,
        SUM(status = 'active' AND track_stock = 1 AND stock <= 0) AS out_of_stock,
        SUM(status = 'active' AND track_stock = 1 AND stock BETWEEN 1 AND 3) AS low_stock FROM products`),
    db.prepare("SELECT id, number, customer_name, total, status, payment_status, source, created_at FROM orders ORDER BY id DESC LIMIT 6"),
    db.prepare("SELECT id, name, stock FROM products WHERE status = 'active' AND track_stock = 1 AND stock <= 3 ORDER BY stock, name LIMIT 8"),
    db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'"),
    db.prepare("SELECT COUNT(*) AS n FROM orders WHERE payment_status = 'pending' AND payment_ref != '' AND status != 'cancelled'"),
  ]);

  // Items sold, best products and best categories come from the order lines.
  const lines = await db.prepare(`SELECT items, created_at >= ? AS current FROM orders WHERE ${LIVE} AND created_at >= ? ORDER BY id DESC LIMIT 5000`)
    .bind(from, prevFrom ?? from).all<{ items: string; current: number }>();
  const products = await db.prepare("SELECT p.id, p.name, p.slug, c.name AS category FROM products p LEFT JOIN categories c ON c.id = p.category_id").all<{ id: number; name: string; slug: string; category: string | null }>();
  const pMap = new Map(products.results.map((p) => [p.id, p]));
  let sold = 0, soldPrev = 0;
  const byProduct = new Map<string, { name: string; qty: number; sales: number }>();
  const byCategory = new Map<string, { name: string; qty: number; sales: number }>();
  for (const row of lines.results) {
    for (const i of JSON.parse(row.items || "[]") as { productId: number | null; name: string; qty: number; priceInr: number }[]) {
      if (!row.current) { soldPrev += i.qty; continue; }
      sold += i.qty;
      const p = i.productId ? pMap.get(i.productId) : undefined;
      const pk = p ? String(p.id) : `x:${i.name}`;
      const pe = byProduct.get(pk) ?? { name: p?.name ?? i.name, qty: 0, sales: 0 };
      pe.qty += i.qty; pe.sales += i.qty * i.priceInr; byProduct.set(pk, pe);
      const cn = p?.category ?? "Other";
      const ce = byCategory.get(cn) ?? { name: cn, qty: 0, sales: 0 };
      ce.qty += i.qty; ce.sales += i.qty * i.priceInr; byCategory.set(cn, ce);
    }
  }
  const top = (m: Map<string, { name: string; qty: number; sales: number }>) => [...m.values()].sort((a, b) => b.sales - a.sales || b.qty - a.qty).slice(0, 6);
  const statusCounts: Record<string, number> = {};
  for (const r of byStatus.results as { status: string; n: number }[]) statusCounts[r.status] = r.n;
  const c0 = cur.results[0] as { sales: number; orders: number };
  const p0 = prev.results[0] as { sales: number; orders: number };

  return json({
    period,
    compare: !!days,
    stats: {
      sales: { now: c0.sales, before: p0.sales },
      orders: { now: c0.orders, before: p0.orders },
      sold: { now: sold, before: soldPrev },
      customers: { now: (custCur.results[0] as { n: number }).n, before: (custPrev.results[0] as { n: number }).n },
    },
    series: { unit: days && days <= 31 ? "day" : "month", days, points: series.results },
    bestProducts: top(byProduct),
    bestCategories: top(byCategory),
    ordersByStatus: statusCounts,
    products: prod.results[0],
    recentOrders: recent.results,
    lowStock: low.results,
    enquiriesNew: (enq.results[0] as { n: number }).n,
    utrToCheck: (utr.results[0] as { n: number }).n,
    publish: await publishState(env),
  });
}

// ============================ Notifications (bell) ============================
export async function notifications(env: Env, user: User): Promise<Response> {
  const db = env.DB;
  const [orders, utr, enq, stock, items] = await db.batch([
    db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'"),
    db.prepare("SELECT COUNT(*) AS n FROM orders WHERE payment_status = 'pending' AND payment_ref != '' AND status != 'cancelled'"),
    db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'"),
    db.prepare("SELECT COUNT(*) AS n FROM products WHERE status = 'active' AND track_stock = 1 AND stock <= 0"),
    db.prepare(`SELECT * FROM (
        SELECT 'order' AS kind, id, number AS title, customer_name AS sub, created_at FROM orders WHERE status = 'new'
        UNION ALL SELECT 'utr', id, number, 'Payment reference sent: check your bank', updated_at FROM orders WHERE payment_status = 'pending' AND payment_ref != '' AND status != 'cancelled'
        UNION ALL SELECT 'enquiry', id, name, occasion, created_at FROM enquiries WHERE status = 'new'
      ) ORDER BY created_at DESC LIMIT 12`),
  ]);
  const n = (r: { results: unknown[] }) => (r.results[0] as { n: number }).n;
  const fails = user.role === "owner"
    ? (await db.prepare("SELECT COUNT(*) AS n FROM webhook_log WHERE ok = 0 AND created_at > datetime('now', '-1 day')").first<{ n: number }>())?.n ?? 0
    : 0;
  return json({ counts: { orders: n(orders), utr: n(utr), enquiries: n(enq), outOfStock: n(stock), hookFails: fails }, items: items.results });
}

// ============================ Occasions ============================
function stripSlug(db: D1Database, slug: string, replacement = "") {
  // products.occasions is a comma list of slugs: ",a,b," → replace ",slug," → trim commas.
  return db.prepare(`UPDATE products SET occasions = trim(replace(',' || occasions || ',', ',' || ? || ',', ?), ','), updated_at = datetime('now')
                     WHERE ',' || occasions || ',' LIKE '%,' || ? || ',%'`).bind(slug, replacement ? `,${replacement},` : ",", slug);
}

export async function occasions(ctx: Ctx, user: User, m: string, b?: string, c?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  if (!b && m === "GET") {
    const r = await db.prepare(`SELECT o.*, (SELECT COUNT(*) FROM products p WHERE ',' || p.occasions || ',' LIKE '%,' || o.slug || ',%') AS product_count
                                FROM occasions o ORDER BY o.sort, o.name`).all();
    return json({ occasions: r.results });
  }
  const values = async (body: Record<string, unknown>, id?: number) => ({
    name: str(body.name, 60, "Name", true),
    slug: await uniqueSlug(db, "occasions", str(body.slug, 80) || String(body.name ?? ""), id),
    urdu: str(body.urdu, 40, "Urdu name"),
    blurb: str(body.blurb, 200, "Short line"),
    color: oneOf(body.color ?? "rani", COLORS, "Colour"),
    grp: oneOf(body.grp ?? "celebration", ["wedding", "festival", "celebration"] as const, "Group"),
    sort: int(body.sort ?? 0, "Order", { min: 0, max: 9999 }),
    visible: body.visible === undefined ? 1 : bool(body.visible),
  });
  if (!b && m === "POST") {
    const v = await values(await readJson(req));
    const r = await db.prepare("INSERT INTO occasions (name, slug, urdu, blurb, color, grp, sort, visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(v.name, v.slug, v.urdu, v.blurb, v.color, v.grp, v.sort, v.visible).run();
    await log(db, user, "Created occasion", v.name);
    await contentChanged(ctx, user);
    return json({ id: r.meta.last_row_id, slug: v.slug }, 201);
  }
  const id = idParam(b, "Occasion");
  const o = await db.prepare("SELECT * FROM occasions WHERE id = ?").bind(id).first<{ id: number; slug: string; name: string; image_key: string | null }>();
  if (!o) throw new HttpError(404, "Occasion not found");
  if (c === "image" && m === "POST") {
    const img = await readImage(req);
    const key = `o/${id}/${randomHex(8)}.${img.ext}`;
    await env.PHOTOS.put(key, img.data, { httpMetadata: { contentType: img.type } });
    await db.prepare("UPDATE occasions SET image_key = ?, updated_at = datetime('now') WHERE id = ?").bind(key, id).run();
    if (o.image_key) await env.PHOTOS.delete(o.image_key);
    await log(db, user, "Changed occasion photo", o.name);
    await contentChanged(ctx, user);
    return json({ image: `/img/${key}` });
  }
  if (c === "image" && m === "DELETE") {
    if (o.image_key) await env.PHOTOS.delete(o.image_key);
    await db.prepare("UPDATE occasions SET image_key = NULL WHERE id = ?").bind(id).run();
    await contentChanged(ctx, user);
    return json({ ok: true });
  }
  if (c) throw new HttpError(404, "Not found");
  if (m === "PUT") {
    const v = await values(await readJson(req), id);
    const stmts = [db.prepare("UPDATE occasions SET name = ?, slug = ?, urdu = ?, blurb = ?, color = ?, grp = ?, sort = ?, visible = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(v.name, v.slug, v.urdu, v.blurb, v.color, v.grp, v.sort, v.visible, id)];
    if (v.slug !== o.slug) stmts.push(stripSlug(db, o.slug, v.slug));
    await db.batch(stmts);
    await log(db, user, "Updated occasion", v.name);
    await contentChanged(ctx, user);
    return json({ ok: true, slug: v.slug });
  }
  if (m === "DELETE") {
    requireOwner(user);
    await db.batch([db.prepare("DELETE FROM occasions WHERE id = ?").bind(id), stripSlug(db, o.slug)]);
    if (o.image_key) await env.PHOTOS.delete(o.image_key);
    await log(db, user, "Deleted occasion", o.name);
    await contentChanged(ctx, user);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

// ============================ Customers ============================
const ORDER_MATCH = "(o.customer_id = c.id OR (c.phone_verified = 1 AND o.phone = c.phone))";

export async function customers(ctx: Ctx, user: User, m: string, b?: string, _c?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  const url = new URL(req.url);
  if (!b && m === "GET") {
    const tab = url.searchParams.get("tab") ?? "registered";
    const q = (url.searchParams.get("q") ?? "").trim();
    const like = `%${q}%`;
    const counts = await db.prepare(`SELECT SUM(status != 'deleted') AS registered, SUM(status = 'deleted') AS deleted, SUM(status = 'blocked') AS blocked FROM customers`).first();
    const guests = await db.prepare("SELECT COUNT(DISTINCT phone) AS n FROM orders o WHERE customer_id IS NULL AND phone != '' AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.phone = o.phone)").first<{ n: number }>();
    if (tab === "guests") {
      const r = await db.prepare(`SELECT phone, MAX(customer_name) AS name, MAX(city) AS city, COUNT(*) AS orders, SUM(CASE WHEN status NOT IN ('cancelled','returned') THEN total ELSE 0 END) AS spent, MAX(created_at) AS last_order
          FROM orders o WHERE customer_id IS NULL AND phone != '' AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.phone = o.phone)
          ${q ? "AND (phone LIKE ? OR customer_name LIKE ?)" : ""} GROUP BY phone ORDER BY last_order DESC LIMIT 300`).bind(...(q ? [like, like] : [])).all();
      return json({ tab, counts: { ...counts, guests: guests?.n ?? 0 }, customers: r.results });
    }
    const deleted = tab === "deleted";
    const r = await db.prepare(`SELECT c.id, c.phone, c.phone_verified, c.name, c.email, c.status, c.marketing, c.admin_note, c.last_login_at, c.created_at, c.deleted_at,
          (SELECT COUNT(*) FROM orders o WHERE ${ORDER_MATCH}) AS orders,
          (SELECT COALESCE(SUM(total),0) FROM orders o WHERE ${ORDER_MATCH} AND o.status NOT IN ('cancelled','returned')) AS spent
        FROM customers c WHERE ${deleted ? "c.status = 'deleted'" : "c.status != 'deleted'"} ${q ? "AND (c.phone LIKE ? OR c.name LIKE ? OR c.email LIKE ?)" : ""}
        ORDER BY c.id DESC LIMIT 300`).bind(...(q ? [like, like, like] : [])).all();
    return json({ tab, counts: { ...counts, guests: guests?.n ?? 0 }, customers: r.results });
  }
  const id = idParam(b, "Customer");
  const cu = await db.prepare("SELECT id, phone, phone_verified, name, email, status, marketing, admin_note, last_login_at, created_at, deleted_at, (pass_hash != '') AS has_password, wishlist, cart FROM customers WHERE id = ?")
    .bind(id).first<Record<string, unknown> & { phone: string; phone_verified: number; status: string; name: string }>();
  if (!cu) throw new HttpError(404, "Customer not found");
  if (m === "GET") {
    const [addr, ord, sess] = await db.batch([
      db.prepare("SELECT id, label, name, phone, address, city, state, pincode, is_default FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC").bind(id),
      db.prepare(`SELECT id, number, total, status, payment_status, created_at FROM orders o WHERE o.customer_id = ? OR (? = 1 AND o.phone = ?) ORDER BY id DESC LIMIT 100`).bind(id, cu.phone_verified, cu.phone),
      db.prepare("SELECT COUNT(*) AS n FROM customer_sessions WHERE customer_id = ? AND expires_at > datetime('now')").bind(id),
    ]);
    return json({
      customer: { ...cu, wishlist: JSON.parse(String(cu.wishlist || "[]")).length, cart: JSON.parse(String(cu.cart || "[]")).length },
      addresses: addr.results, orders: ord.results, sessions: (sess.results[0] as { n: number }).n,
    });
  }
  if (m === "PUT") {
    const body = await readJson(req);
    const stmts = [];
    if (body.admin_note !== undefined) stmts.push(db.prepare("UPDATE customers SET admin_note = ? WHERE id = ?").bind(str(body.admin_note, 500, "Note"), id));
    if (body.status !== undefined) {
      requireOwner(user);
      if (cu.status === "deleted") throw new HttpError(400, "This account was deleted");
      const st = oneOf(body.status, ["active", "blocked"] as const, "Status");
      stmts.push(db.prepare("UPDATE customers SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(st, id));
      if (st === "blocked") stmts.push(db.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(id));
    }
    if (body.logout === true) stmts.push(db.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(id));
    if (body.temp_password !== undefined) {
      // For a customer who forgot their password (before WhatsApp / SMS codes are connected).
      requireOwner(user);
      const pw = String(body.temp_password ?? "");
      if (pw.length < 8 || pw.length > 200) throw new HttpError(400, "The temporary password must be at least 8 characters");
      const salt = randomHex(16);
      stmts.push(db.prepare("UPDATE customers SET pass_hash = ?, pass_salt = ?, updated_at = datetime('now') WHERE id = ?").bind(await hashPassword(pw, salt), salt, id));
      stmts.push(db.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(id));
    }
    if (stmts.length) await db.batch(stmts);
    await log(db, user, "Updated customer", `…${cu.phone.slice(-4)}${body.status ? ` → ${String(body.status)}` : ""}${body.temp_password !== undefined ? " (temporary password set)" : ""}`);
    return json({ ok: true });
  }
  if (m === "DELETE") {
    requireOwner(user);
    await db.batch([
      db.prepare(`UPDATE customers SET status = 'deleted', phone = 'deleted-' || id, name = '', email = '', pass_hash = '', pass_salt = '', cart = '[]', wishlist = '[]',
                  marketing = 0, admin_note = ?, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
        .bind(`Deleted by ${user.name || user.email}. Mobile ended …${cu.phone.slice(-4)}.`, id),
      db.prepare("DELETE FROM customer_addresses WHERE customer_id = ?").bind(id),
      db.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(id),
    ]);
    await log(db, user, "Deleted customer account", `…${cu.phone.slice(-4)}`);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

// ============================ Enquiries ============================
export async function enquiries(ctx: Ctx, user: User, m: string, b?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  if (!b && m === "GET") {
    const st = new URL(req.url).searchParams.get("status") ?? "";
    const r = st
      ? await db.prepare("SELECT * FROM enquiries WHERE status = ? ORDER BY id DESC LIMIT 300").bind(st).all()
      : await db.prepare("SELECT * FROM enquiries ORDER BY id DESC LIMIT 300").all();
    return json({ enquiries: r.results.map((e) => ({ ...e, ip: undefined })) });
  }
  const id = idParam(b, "Enquiry");
  const e = await db.prepare("SELECT id, name FROM enquiries WHERE id = ?").bind(id).first<{ id: number; name: string }>();
  if (!e) throw new HttpError(404, "Enquiry not found");
  if (m === "PUT") {
    const body = await readJson(req);
    const status = body.status === undefined ? undefined : oneOf(body.status, ["new", "contacted", "quoted", "won", "lost"] as const, "Status");
    await db.prepare("UPDATE enquiries SET status = COALESCE(?, status), admin_note = COALESCE(?, admin_note), updated_at = datetime('now') WHERE id = ?")
      .bind(status ?? null, body.admin_note === undefined ? null : str(body.admin_note, 1000, "Note"), id).run();
    await log(db, user, "Updated enquiry", `${e.name}${status ? ` → ${status}` : ""}`);
    return json({ ok: true });
  }
  if (m === "DELETE") {
    requireOwner(user);
    await db.prepare("DELETE FROM enquiries WHERE id = ?").bind(id).run();
    await log(db, user, "Deleted enquiry", e.name);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

// ============================ Coupons ============================
export async function coupons(ctx: Ctx, user: User, m: string, b?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  if (!b && m === "GET") return json({ coupons: (await db.prepare("SELECT * FROM coupons ORDER BY active DESC, id DESC").all()).results });
  requireOwner(user);
  const values = (body: Record<string, unknown>) => {
    const code = str(body.code, 24, "Code", true).toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new HttpError(400, "Code: 3–24 letters or numbers, e.g. EID10");
    const kind = oneOf(body.kind ?? "percent", ["percent", "flat"] as const, "Type");
    const value = int(body.value, "Discount", { min: 1, max: kind === "percent" ? 90 : 1_000_000 }) as number;
    const date = (v: unknown, f: string) => { const s = str(v, 10, f); if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, `${f} must be a date`); return s || null; };
    const starts = date(body.starts_at, "Start date");
    const ends = date(body.ends_at, "End date");
    if (starts && ends && ends < starts) throw new HttpError(400, "The end date is before the start date");
    return {
      code, kind, value, starts, ends,
      min_order: int(body.min_order ?? 0, "Minimum order", { min: 0, max: 10_000_000 }) as number,
      max_discount: int(body.max_discount, "Maximum discount", { min: 1, max: 10_000_000, nullable: true }),
      usage_limit: int(body.usage_limit, "Total uses", { min: 1, max: 1_000_000, nullable: true }),
      per_customer: int(body.per_customer ?? 0, "Uses per customer", { min: 0, max: 100 }) as number,
      active: body.active === undefined ? 1 : bool(body.active),
      note: str(body.note, 200, "Note"),
    };
  };
  if (!b && m === "POST") {
    const v = values(await readJson(req));
    if (await db.prepare("SELECT id FROM coupons WHERE code = ?").bind(v.code).first()) throw new HttpError(409, "A coupon with this code already exists");
    const r = await db.prepare(`INSERT INTO coupons (code, kind, value, min_order, max_discount, starts_at, ends_at, usage_limit, per_customer, active, note)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(v.code, v.kind, v.value, v.min_order, v.max_discount, v.starts, v.ends, v.usage_limit, v.per_customer, v.active, v.note).run();
    await log(db, user, "Created coupon", v.code);
    return json({ id: r.meta.last_row_id }, 201);
  }
  const id = idParam(b, "Coupon");
  const cp = await db.prepare("SELECT id, code FROM coupons WHERE id = ?").bind(id).first<{ id: number; code: string }>();
  if (!cp) throw new HttpError(404, "Coupon not found");
  if (m === "PUT") {
    const body = await readJson(req);
    if (Object.keys(body).length === 1 && body.active !== undefined) {
      await db.prepare("UPDATE coupons SET active = ? WHERE id = ?").bind(bool(body.active), id).run();
    } else {
      const v = values(body);
      if (await db.prepare("SELECT id FROM coupons WHERE code = ? AND id != ?").bind(v.code, id).first()) throw new HttpError(409, "A coupon with this code already exists");
      await db.prepare(`UPDATE coupons SET code = ?, kind = ?, value = ?, min_order = ?, max_discount = ?, starts_at = ?, ends_at = ?, usage_limit = ?, per_customer = ?, active = ?, note = ? WHERE id = ?`)
        .bind(v.code, v.kind, v.value, v.min_order, v.max_discount, v.starts, v.ends, v.usage_limit, v.per_customer, v.active, v.note, id).run();
    }
    await log(db, user, "Updated coupon", cp.code);
    return json({ ok: true });
  }
  if (m === "DELETE") {
    await db.prepare("DELETE FROM coupons WHERE id = ?").bind(id).run();
    await log(db, user, "Deleted coupon", cp.code);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

// ============================ Integrations (encrypted partner keys) ============================
function mask(v: string): string {
  if (!v) return "";
  return v.length <= 8 ? "••••" : `••••${v.slice(-4)}`;
}

export async function integrations(ctx: Ctx, user: User, m: string, b?: string, c?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  const origin = new URL(req.url).origin;
  if (b === "log" && m === "GET") {
    const r = await db.prepare("SELECT id, direction, source, event, ok, status, detail, created_at FROM webhook_log ORDER BY id DESC LIMIT 200").all();
    return json({ log: r.results });
  }
  if (!b && m === "GET") {
    const rows = await db.prepare("SELECT * FROM integrations").all<{ provider: string; enabled: number; mode: string; config: string; secrets: string; last_test_at: string | null; last_test_ok: number | null; last_test_msg: string; updated_by: string; updated_at: string }>();
    const byId = new Map(rows.results.map((r) => [r.provider, r]));
    const lastIn = await db.prepare("SELECT source, MAX(created_at) AS at FROM webhook_log WHERE direction = 'in' GROUP BY source").all<{ source: string; at: string }>();
    const lastMap = new Map(lastIn.results.map((r) => [r.source, r.at]));
    const list = [];
    for (const p of PROVIDERS) {
      const row = byId.get(p.id);
      let secrets: Record<string, string> = {};
      let broken = false;
      if (row?.secrets) { try { secrets = await decryptJson(env, `integration:${p.id}`, row.secrets); } catch { broken = true; } }
      const config = JSON.parse(row?.config || "{}") as Record<string, string>;
      list.push({
        ...p,
        webhookUrl: p.webhook ? `${origin}${p.webhook.path}` : null,
        enabled: !!row?.enabled, mode: row?.mode ?? "test", broken,
        values: Object.fromEntries(p.fields.map((f) => [f.key, f.secret ? { set: !!secrets[f.key], hint: mask(secrets[f.key] ?? "") } : { value: config[f.key] ?? "" }])),
        lastTest: row?.last_test_at ? { at: row.last_test_at, ok: !!row.last_test_ok, message: row.last_test_msg } : null,
        lastWebhookAt: lastMap.get(p.id) ?? null,
        updatedBy: row?.updated_by ?? "", updatedAt: row?.updated_at ?? null,
      });
    }
    return json({ keyReady: /^[a-f0-9]{64}$/i.test(env.SECRETS_KEY ?? ""), providers: list });
  }
  const def = providerDef(b ?? "");
  if (c === "test" && m === "POST") {
    const r = await testIntegration(env, def.id);
    await db.prepare("UPDATE integrations SET last_test_at = datetime('now'), last_test_ok = ?, last_test_msg = ? WHERE provider = ?").bind(r.ok ? 1 : 0, r.message.slice(0, 200), def.id).run();
    await log(db, user, "Tested partner connection", `${def.name}: ${r.ok ? "OK" : "failed"}`);
    return json(r);
  }
  if (m !== "PUT") throw new HttpError(405, "Not allowed");

  const body = await readJson(req);
  const row = await db.prepare("SELECT enabled, mode, config, secrets FROM integrations WHERE provider = ?").bind(def.id).first<{ enabled: number; mode: string; config: string; secrets: string }>();
  let secrets: Record<string, string> = {};
  if (row?.secrets) { try { secrets = await decryptJson(env, `integration:${def.id}`, row.secrets); } catch { secrets = {}; } }
  const config = JSON.parse(row?.config || "{}") as Record<string, string>;
  const newSecrets = (body.secrets ?? {}) as Record<string, unknown>;
  const clear = Array.isArray(body.clear) ? body.clear.map(String) : [];
  let secretChanged = clear.length > 0;
  for (const f of def.fields) {
    if (f.secret) {
      const v = typeof newSecrets[f.key] === "string" ? (newSecrets[f.key] as string).trim() : "";
      if (v) { if (v.length > 2000) throw new HttpError(400, `${f.label} is too long`); secrets[f.key] = v; secretChanged = true; }
      if (clear.includes(f.key)) delete secrets[f.key];
    } else if (body.config && typeof body.config === "object" && (body.config as Record<string, unknown>)[f.key] !== undefined) {
      config[f.key] = str((body.config as Record<string, unknown>)[f.key], 300, f.label);
    }
  }
  const enabled = body.enabled === undefined ? row?.enabled ?? 0 : bool(body.enabled);
  const mode = body.mode === undefined ? row?.mode ?? "test" : oneOf(body.mode, ["test", "live"] as const, "Mode");
  // Changing keys or switching a partner on needs the admin password again.
  if (secretChanged || (enabled && !row?.enabled)) await checkPassword(db, user, body.password);
  if (enabled) {
    const missing = def.fields.filter((f) => !f.optional && !(f.secret ? secrets[f.key] : config[f.key]));
    if (missing.length) throw new HttpError(400, `Fill in ${missing.map((f) => f.label).join(", ")} before switching ${def.name} on`);
  }
  const stored = await saveSecrets(env, def.id, secrets);
  await db.prepare(`INSERT INTO integrations (provider, enabled, mode, config, secrets, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                    ON CONFLICT(provider) DO UPDATE SET enabled = excluded.enabled, mode = excluded.mode, config = excluded.config, secrets = excluded.secrets,
                    updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(def.id, enabled, mode, JSON.stringify(config), stored, user.name || user.email).run();
  await log(db, user, "Updated partner settings", `${def.name}${secretChanged ? " (keys changed)" : ""}${enabled !== (row?.enabled ?? 0) ? (enabled ? " · switched ON" : " · switched OFF") : ""}`);
  return json({ ok: true });
}

// ============================ Outgoing webhooks ============================
export async function webhooks(ctx: Ctx, user: User, m: string, b?: string, c?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  if (!b && m === "GET") {
    const r = await db.prepare("SELECT id, name, url, events, active, last_status, last_at, created_at FROM webhooks ORDER BY id DESC").all();
    return json({ webhooks: r.results, events: WEBHOOK_EVENTS });
  }
  const values = (body: Record<string, unknown>) => {
    const url = str(body.url, 500, "URL", true);
    if (!isSafeHookUrl(url)) throw new HttpError(400, "The URL must start with https:// and be a public web address");
    const allowed = new Set<string>(WEBHOOK_EVENTS.map((e) => e.id));
    const events = (Array.isArray(body.events) ? body.events.map(String) : []).filter((e) => allowed.has(e));
    if (!events.length) throw new HttpError(400, "Choose at least one event");
    return { name: str(body.name, 60, "Name", true), url, events: events.join(",") };
  };
  if (!b && m === "POST") {
    const body = await readJson(req);
    await checkPassword(db, user, body.password);
    const v = values(body);
    const sec = await newHookSecret(env);
    const r = await db.prepare("INSERT INTO webhooks (name, url, events, secret) VALUES (?, ?, ?, ?)").bind(v.name, v.url, v.events, sec.stored).run();
    await log(db, user, "Added webhook", v.name);
    // The signing secret is shown ONCE. Only its encrypted form is stored.
    return json({ id: r.meta.last_row_id, secret: sec.plain }, 201);
  }
  const id = idParam(b, "Webhook");
  const h = await db.prepare("SELECT id, name, url, secret FROM webhooks WHERE id = ?").bind(id).first<{ id: number; name: string; url: string; secret: string }>();
  if (!h) throw new HttpError(404, "Webhook not found");
  if (c === "test" && m === "POST") {
    const { s: secret } = await decryptJson(env, "webhook", h.secret);
    const ts = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({ event: "ping", created_at: new Date().toISOString(), data: { message: "Test from Insi House admin" } });
    let status = 0;
    try {
      const r = await fetch(h.url, {
        method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
        headers: { "content-type": "application/json", "user-agent": "InsiHouse-Webhooks/1.0", "x-insihouse-event": "ping", "x-insihouse-timestamp": ts, "x-insihouse-signature": `sha256=${await hmacHex(secret, `${ts}.${payload}`)}` },
        body: payload,
      });
      status = r.status;
    } catch { status = 0; }
    await db.batch([
      db.prepare("UPDATE webhooks SET last_status = ?, last_at = datetime('now') WHERE id = ?").bind(status, id),
      db.prepare("INSERT INTO webhook_log (direction, source, event, ok, status, detail) VALUES ('out', ?, 'ping', ?, ?, 'Test sent from admin')").bind(h.name, status >= 200 && status < 300 ? 1 : 0, status),
    ]);
    return json({ ok: status >= 200 && status < 300, status });
  }
  if (m === "PUT") {
    const body = await readJson(req);
    if (Object.keys(body).length === 1 && body.active !== undefined) {
      await db.prepare("UPDATE webhooks SET active = ? WHERE id = ?").bind(bool(body.active), id).run();
    } else {
      const v = values(body);
      if (v.url !== h.url) await checkPassword(db, user, body.password);
      await db.prepare("UPDATE webhooks SET name = ?, url = ?, events = ? WHERE id = ?").bind(v.name, v.url, v.events, id).run();
    }
    await log(db, user, "Updated webhook", h.name);
    return json({ ok: true });
  }
  if (m === "DELETE") {
    await db.prepare("DELETE FROM webhooks WHERE id = ?").bind(id).run();
    await log(db, user, "Deleted webhook", h.name);
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

// ============================ My security: sessions, login history, 2-step login ============================
export async function security(ctx: Ctx, user: User, m: string, b: string, c?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  const myHash = await sha256(readCookie(req, "ih_admin"));
  if (b === "sessions" && m === "GET") {
    const r = await db.prepare("SELECT token_hash, ip, ua, created_at, expires_at FROM sessions WHERE user_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC")
      .bind(user.id).all<{ token_hash: string; ip: string; ua: string; created_at: string; expires_at: string }>();
    return json({ sessions: r.results.map((s) => ({ id: s.token_hash.slice(0, 12), ip: s.ip, ua: s.ua, created_at: s.created_at, expires_at: s.expires_at, current: s.token_hash === myHash })) });
  }
  if (b === "sessions" && m === "DELETE") {
    await db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(user.id, myHash).run();
    await log(db, user, "Logged out all other devices");
    return json({ ok: true });
  }
  if (b === "logins" && m === "GET") {
    const r = await db.prepare("SELECT ip, ok, created_at FROM login_attempts WHERE email = ? ORDER BY id DESC LIMIT 30").bind(user.email.toLowerCase()).all();
    return json({ logins: r.results });
  }
  if (b === "2fa" && c === "setup" && m === "POST") {
    const on = await db.prepare("SELECT totp_on FROM admin_users WHERE id = ?").bind(user.id).first<{ totp_on: number }>();
    if (on?.totp_on) throw new HttpError(400, "Two-step login is already on");
    const secret = randomBase32(32);
    await db.prepare("UPDATE admin_users SET totp_secret = ? WHERE id = ?").bind(secret, user.id).run();
    const label = encodeURIComponent(`Insi House:${user.email}`);
    return json({ secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Insi House")}&digits=6&period=30` });
  }
  if (b === "2fa" && c === "enable" && m === "POST") {
    const body = await readJson(req);
    const row = await db.prepare("SELECT totp_secret FROM admin_users WHERE id = ?").bind(user.id).first<{ totp_secret: string }>();
    if (!row?.totp_secret || !(await totpOk(row.totp_secret, body.code))) throw new HttpError(400, "That code is not right. Type the 6 digits shown in the app now.");
    await db.batch([
      db.prepare("UPDATE admin_users SET totp_on = 1 WHERE id = ?").bind(user.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(user.id, myHash),
    ]);
    await log(db, user, "Turned ON two-step login");
    return json({ ok: true });
  }
  if (b === "2fa" && c === "disable" && m === "POST") {
    const body = await readJson(req);
    await checkPassword(db, user, body.password);
    const row = await db.prepare("SELECT totp_secret FROM admin_users WHERE id = ?").bind(user.id).first<{ totp_secret: string }>();
    if (!(await totpOk(row?.totp_secret ?? "", body.code))) throw new HttpError(400, "That code is not right");
    await db.prepare("UPDATE admin_users SET totp_on = 0, totp_secret = '', totp_last = 0 WHERE id = ?").bind(user.id).run();
    await log(db, user, "Turned OFF two-step login");
    return json({ ok: true });
  }
  throw new HttpError(404, "Not found");
}

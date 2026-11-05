// /api/account/* — customer accounts (like Flipkart / Amazon: log in with your mobile number).
//   GET    /api/account                → { customer | null, otp: "whatsapp" | "sms" | null }
//   POST   /api/account/otp/send       → { phone }              send a 6-digit code (when WhatsApp / SMS is connected)
//   POST   /api/account/otp/verify     → { phone, code, name? } log in or sign up with the code
//   POST   /api/account/register       → { name, phone, password, consent }
//   POST   /api/account/login          → { phone, password }
//   POST   /api/account/logout
//   PUT    /api/account/profile        → { name, email, marketing }
//   PUT    /api/account/password       → { current?, next }
//   GET/POST /api/account/addresses, PUT/DELETE /api/account/addresses/:id
//   GET    /api/account/orders
//   GET/POST /api/account/sync         → { cart, wishlist, merge }
//   DELETE /api/account                → { password? , confirm: "DELETE" }
// Every query is scoped to the logged-in customer's id, so nobody can read or change another customer's data.
import { otpChannel, sendOtp, emit } from "../../_lib/providers";
import { addressValues, currentCustomer, customerCookie, CUSTOMER_DAYS, saveAddress, type Customer } from "../../_lib/shop";
import {
  bool, clientIp, EMAIL_RE, hashPassword, HttpError, json, mobile, randomHex, readJson, safeEqual, sameOrigin, sha256, str,
  type Ctx, type D1Database, type Env,
} from "../../_lib/util";

const OTP_MINUTES = 10;
const OTP_PER_HOUR = 60;

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
  const raw = ctx.params.path;
  const seg = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
  const m = req.method;
  if (m !== "GET" && m !== "HEAD") sameOrigin(req);
  const [a, b] = seg;
  const db = env.DB;

  if (!a && m === "GET") return json({ customer: publicCustomer(await currentCustomer(db, req)), otp: await otpChannel(env) });
  if (a === "otp" && b === "send" && m === "POST") return otpSend(ctx);
  if (a === "otp" && b === "verify" && m === "POST") return otpVerify(ctx);
  if (a === "register" && m === "POST") return register(ctx);
  if (a === "login" && m === "POST") return passwordLogin(ctx);
  if (a === "logout" && m === "POST") return logout(ctx);

  const me = await currentCustomer(db, req);
  if (!me) throw new HttpError(401, "Please log in");
  if (!a && m === "DELETE") return deleteAccount(env, me, req);
  if (a === "profile" && m === "PUT") return profile(db, me, req);
  if (a === "password" && m === "PUT") return changePassword(db, me, req);
  if (a === "addresses") return addresses(db, me, m, b, req);
  if (a === "orders" && m === "GET") return myOrders(db, me);
  if (a === "sync") return sync(db, me, m, req);
  throw new HttpError(404, "Not found");
}

function publicCustomer(c: Customer | null) {
  if (!c) return null;
  return { id: c.id, phone: c.phone, verified: !!c.phone_verified, name: c.name, email: c.email, marketing: !!c.marketing, hasPassword: !!c.has_password, since: c.created_at };
}

async function startSession(db: D1Database, customerId: number, req: Request): Promise<string> {
  const token = randomHex(32);
  await db.batch([
    db.prepare(`INSERT INTO customer_sessions (token_hash, customer_id, expires_at, ip) VALUES (?, ?, datetime('now', '+${CUSTOMER_DAYS} days'), ?)`)
      .bind(await sha256(token), customerId, clientIp(req)),
    db.prepare("UPDATE customers SET last_login_at = datetime('now') WHERE id = ?").bind(customerId),
    db.prepare("DELETE FROM customer_sessions WHERE expires_at < datetime('now')"),
  ]);
  return customerCookie(token, CUSTOMER_DAYS * 86400);
}

async function loggedIn(db: D1Database, id: number, req: Request): Promise<Response> {
  const cookie = await startSession(db, id, req);
  const c = await db.prepare("SELECT id, phone, phone_verified, name, email, marketing, (pass_hash != '') AS has_password, created_at FROM customers WHERE id = ?").bind(id).first<Customer>();
  return json({ customer: publicCustomer(c) }, 200, { "set-cookie": cookie });
}

function newPassword(v: unknown): string {
  const pw = typeof v === "string" ? v : "";
  if (pw.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (pw.length > 200) throw new HttpError(400, "Password is too long");
  if (/^[0-9]+$/.test(pw) && pw.length < 10) throw new HttpError(400, "Please use letters as well as numbers in your password");
  return pw;
}

// ---------------- OTP ----------------
async function codeHash(env: Env, phone: string, code: string) {
  return sha256(`${phone}:${code}:${env.SECRETS_KEY ?? "insihouse"}`);
}

async function otpSend({ request: req, env }: Ctx): Promise<Response> {
  const db = env.DB;
  const body = await readJson(req);
  const phone = mobile(body.phone);
  if (!phone) throw new HttpError(400, "Enter a valid 10-digit mobile number");
  if (!(await otpChannel(env))) throw new HttpError(503, "Login with a code is not switched on yet. Please use a password.");
  const ip = clientIp(req);
  const lim = await db
    .prepare(`SELECT SUM(phone = ? AND created_at > datetime('now', '-10 minutes')) AS recent,
                     SUM(phone = ? AND created_at > datetime('now', '-1 day')) AS day,
                     SUM(ip = ? AND created_at > datetime('now', '-1 hour')) AS by_ip
              FROM otp_codes WHERE created_at > datetime('now', '-1 day')`)
    .bind(phone, phone, ip)
    .first<{ recent: number | null; day: number | null; by_ip: number | null }>();
  if ((lim?.recent ?? 0) >= 3 || (lim?.day ?? 0) >= 8 || (lim?.by_ip ?? 0) >= 10) throw new HttpError(429, "Too many codes requested. Please wait a few minutes and try again.");
  // Overall cap so nobody can run up the SMS / WhatsApp bill by rotating numbers and networks.
  const all = await db.prepare("SELECT COUNT(*) AS n FROM otp_codes WHERE created_at > datetime('now', '-1 hour')").first<{ n: number }>();
  if ((all?.n ?? 0) >= OTP_PER_HOUR) throw new HttpError(429, "Login codes are busy right now. Please log in with your password or try again in a little while.");
  const blocked = await db.prepare("SELECT status FROM customers WHERE phone = ?").bind(phone).first<{ status: string }>();
  if (blocked?.status === "blocked") throw new HttpError(403, "This account is on hold. Please message us on WhatsApp.");

  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  const code = String(n[0] % 1_000_000).padStart(6, "0");
  await db.batch([
    db.prepare("UPDATE otp_codes SET used = 1 WHERE phone = ? AND used = 0").bind(phone),
    db.prepare(`INSERT INTO otp_codes (phone, code_hash, ip, expires_at) VALUES (?, ?, ?, datetime('now', '+${OTP_MINUTES} minutes'))`).bind(phone, await codeHash(env, phone, code), ip),
    db.prepare("DELETE FROM otp_codes WHERE created_at < datetime('now', '-2 days')"),
  ]);
  const via = await sendOtp(env, phone, code);
  return json({ ok: true, via, minutes: OTP_MINUTES });
}

async function otpVerify(ctx: Ctx): Promise<Response> {
  const { request: req, env } = ctx;
  const db = env.DB;
  const body = await readJson(req);
  const phone = mobile(body.phone);
  const code = String(body.code ?? "").replace(/\s/g, "");
  if (!phone || !/^[0-9]{6}$/.test(code)) throw new HttpError(400, "Enter the 6-digit code");
  // Claim one of the 5 tries atomically BEFORE comparing, so parallel guesses can't share a try.
  const row = await db
    .prepare(`UPDATE otp_codes SET attempts = attempts + 1
              WHERE id = (SELECT id FROM otp_codes WHERE phone = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1) AND attempts < 5
              RETURNING id, code_hash, attempts`)
    .bind(phone)
    .first<{ id: number; code_hash: string; attempts: number }>();
  if (!row) throw new HttpError(400, "This code has expired. Please ask for a new one.");
  if (!safeEqual(await codeHash(env, phone, code), row.code_hash)) {
    throw new HttpError(400, row.attempts >= 5 ? "Wrong code. Please ask for a new one." : "Wrong code. Please check and try again.");
  }
  // Only one request can turn a code into a login.
  const won = await db.prepare("UPDATE otp_codes SET used = 1 WHERE id = ? AND used = 0 RETURNING id").bind(row.id).first();
  if (!won) throw new HttpError(400, "This code was already used. Please ask for a new one.");

  const c = await db.prepare("SELECT id, status, phone_verified FROM customers WHERE phone = ?").bind(phone).first<{ id: number; status: string; phone_verified: number }>();
  if (c?.status === "blocked") throw new HttpError(403, "This account is on hold. Please message us on WhatsApp.");
  if (c) {
    if (!c.phone_verified) {
      // First proof that this person owns the number: anyone who registered it earlier with only a password is logged out.
      await db.batch([
        db.prepare("UPDATE customers SET phone_verified = 1, pass_hash = '', pass_salt = '', updated_at = datetime('now') WHERE id = ?").bind(c.id),
        db.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(c.id),
      ]);
    }
    return loggedIn(db, c.id, req);
  }
  const name = str(body.name, 80, "Name");
  const r = await db.prepare("INSERT INTO customers (phone, phone_verified, name) VALUES (?, 1, ?)").bind(phone, name).run();
  emit(ctx, "customer.created", { phone_last4: phone.slice(-4), name, via: "otp" });
  return loggedIn(db, r.meta.last_row_id as number, req);
}

// ---------------- Password ----------------
async function register(ctx: Ctx): Promise<Response> {
  const { request: req, env } = ctx;
  const db = env.DB;
  const body = await readJson(req);
  if (body.consent !== true) throw new HttpError(400, "Please accept the privacy policy to create an account");
  const name = str(body.name, 80, "Name", true);
  const phone = mobile(body.phone);
  if (!phone) throw new HttpError(400, "Enter a valid 10-digit mobile number");
  const pw = newPassword(body.password);
  const ip = clientIp(req);
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM customer_login_attempts WHERE ip = ? AND phone = '#register' AND created_at > datetime('now', '-1 hour')").bind(ip).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) throw new HttpError(429, "Too many new accounts from this device. Please try again later.");
  if (await db.prepare("SELECT id FROM customers WHERE phone = ?").bind(phone).first()) throw new HttpError(409, "This mobile number already has an account. Please log in.");
  const salt = randomHex(16);
  const r = await db.prepare("INSERT INTO customers (phone, name, pass_hash, pass_salt) VALUES (?, ?, ?, ?)").bind(phone, name, await hashPassword(pw, salt), salt).run();
  await db.prepare("INSERT INTO customer_login_attempts (phone, ip, ok) VALUES ('#register', ?, 1)").bind(ip).run();
  emit(ctx, "customer.created", { phone_last4: phone.slice(-4), name, via: "password" });
  return loggedIn(db, r.meta.last_row_id as number, req);
}

async function passwordLogin({ request: req, env }: Ctx): Promise<Response> {
  const db = env.DB;
  const body = await readJson(req);
  const phone = mobile(body.phone);
  if (!phone) throw new HttpError(400, "Enter a valid 10-digit mobile number");
  const password = typeof body.password === "string" ? body.password : "";
  const ip = clientIp(req);
  const f = await db
    .prepare(`SELECT SUM(ip = ? AND phone = ?) AS same, SUM(ip = ?) AS by_ip, SUM(phone = ?) AS by_phone FROM customer_login_attempts
              WHERE ok = 0 AND created_at > datetime('now', '-15 minutes')`)
    .bind(ip, phone, ip, phone)
    .first<{ same: number | null; by_ip: number | null; by_phone: number | null }>();
  if ((f?.same ?? 0) >= 6 || (f?.by_ip ?? 0) >= 30 || (f?.by_phone ?? 0) >= 20) throw new HttpError(429, "Too many wrong attempts. Please wait 15 minutes and try again.");

  const c = await db.prepare("SELECT id, status, pass_hash, pass_salt FROM customers WHERE phone = ?").bind(phone).first<{ id: number; status: string; pass_hash: string; pass_salt: string }>();
  let ok = false;
  if (c && c.pass_hash) ok = safeEqual(await hashPassword(password, c.pass_salt), c.pass_hash);
  else await hashPassword(password, "00".repeat(16));
  await db.batch([
    db.prepare("INSERT INTO customer_login_attempts (phone, ip, ok) VALUES (?, ?, ?)").bind(phone, ip, ok ? 1 : 0),
    db.prepare("DELETE FROM customer_login_attempts WHERE created_at < datetime('now', '-30 days')"),
  ]);
  if (!ok || !c) throw new HttpError(401, c && !c.pass_hash ? "This account logs in with a code. Choose “Get a code” instead." : "Wrong mobile number or password");
  if (c.status === "blocked") throw new HttpError(403, "This account is on hold. Please message us on WhatsApp.");
  return loggedIn(db, c.id, req);
}

async function logout({ request: req, env }: Ctx): Promise<Response> {
  const token = (req.headers.get("cookie") ?? "").match(/(?:^|;\s*)ih_cust=([a-f0-9]{64})/)?.[1];
  if (token) await env.DB.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "set-cookie": customerCookie("", 0) });
}

// ---------------- Profile ----------------
async function profile(db: D1Database, me: Customer, req: Request): Promise<Response> {
  const body = await readJson(req);
  const name = str(body.name, 80, "Name", true);
  const email = str(body.email, 120, "Email");
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address");
  await db.prepare("UPDATE customers SET name = ?, email = ?, marketing = ?, updated_at = datetime('now') WHERE id = ?").bind(name, email, bool(body.marketing), me.id).run();
  return json({ ok: true });
}

async function changePassword(db: D1Database, me: Customer, req: Request): Promise<Response> {
  const body = await readJson(req);
  const row = await db.prepare("SELECT pass_hash, pass_salt FROM customers WHERE id = ?").bind(me.id).first<{ pass_hash: string; pass_salt: string }>();
  if (row?.pass_hash && !safeEqual(await hashPassword(String(body.current ?? ""), row.pass_salt), row.pass_hash)) throw new HttpError(400, "Your current password is wrong");
  const pw = newPassword(body.next);
  const salt = randomHex(16);
  const token = (req.headers.get("cookie") ?? "").match(/(?:^|;\s*)ih_cust=([a-f0-9]{64})/)?.[1] ?? "";
  await db.batch([
    db.prepare("UPDATE customers SET pass_hash = ?, pass_salt = ?, updated_at = datetime('now') WHERE id = ?").bind(await hashPassword(pw, salt), salt, me.id),
    // Log out every other device.
    db.prepare("DELETE FROM customer_sessions WHERE customer_id = ? AND token_hash != ?").bind(me.id, await sha256(token)),
  ]);
  return json({ ok: true });
}

async function deleteAccount(env: Env, me: Customer, req: Request): Promise<Response> {
  const db = env.DB;
  const body = await readJson(req);
  if (body.confirm !== "DELETE") throw new HttpError(400, "Type DELETE to confirm");
  const row = await db.prepare("SELECT pass_hash, pass_salt FROM customers WHERE id = ?").bind(me.id).first<{ pass_hash: string; pass_salt: string }>();
  if (row?.pass_hash && !safeEqual(await hashPassword(String(body.password ?? ""), row.pass_salt), row.pass_hash)) throw new HttpError(400, "Your password is wrong");
  // Personal data is erased (DPDP Act). Past orders stay for tax records, as the privacy policy explains.
  await db.batch([
    db.prepare(`UPDATE customers SET status = 'deleted', phone = 'deleted-' || id, name = '', email = '', pass_hash = '', pass_salt = '',
                cart = '[]', wishlist = '[]', marketing = 0, admin_note = ?, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
      .bind(`Deleted by the customer. Mobile ended …${me.phone.slice(-4)}.`, me.id),
    db.prepare("DELETE FROM customer_addresses WHERE customer_id = ?").bind(me.id),
    db.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(me.id),
  ]);
  return json({ ok: true }, 200, { "set-cookie": customerCookie("", 0) });
}

// ---------------- Addresses ----------------
async function addresses(db: D1Database, me: Customer, m: string, b: string | undefined, req: Request): Promise<Response> {
  if (!b && m === "GET") {
    const r = await db.prepare("SELECT id, label, name, phone, address, city, state, pincode, is_default FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC").bind(me.id).all();
    return json({ addresses: r.results });
  }
  if (!b && m === "POST") {
    const body = await readJson(req);
    return json({ id: await saveAddress(db, me.id, body, body.is_default === true) }, 201);
  }
  const id = Number(b);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, "Address not found");
  const own = await db.prepare("SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?").bind(id, me.id).first();
  if (!own) throw new HttpError(404, "Address not found");
  if (m === "PUT") {
    const body = await readJson(req);
    const v = addressValues(body);
    const stmts = [];
    if (body.is_default === true) stmts.push(db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").bind(me.id));
    stmts.push(db.prepare(`UPDATE customer_addresses SET label = ?, name = ?, phone = ?, address = ?, city = ?, state = ?, pincode = ?${body.is_default === true ? ", is_default = 1" : ""}
                           WHERE id = ? AND customer_id = ?`).bind(v.label, v.name, v.phone, v.address, v.city, v.state, v.pincode, id, me.id));
    await db.batch(stmts);
    return json({ ok: true });
  }
  if (m === "DELETE") {
    await db.prepare("DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?").bind(id, me.id).run();
    // Keep one default address.
    await db.prepare(`UPDATE customer_addresses SET is_default = 1 WHERE id = (SELECT id FROM customer_addresses WHERE customer_id = ? ORDER BY id DESC LIMIT 1)
                      AND NOT EXISTS (SELECT 1 FROM customer_addresses WHERE customer_id = ? AND is_default = 1)`).bind(me.id, me.id).run();
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

// ---------------- Orders ----------------
async function myOrders(db: D1Database, me: Customer): Promise<Response> {
  // Orders placed while logged in, plus older guest orders with the same number once the number is verified by a code.
  const r = await db
    .prepare(`SELECT number, status, payment_status, payment_method, total, items, courier, awb, tracking_url, created_at FROM orders
              WHERE customer_id = ? OR (? = 1 AND phone = ?) ORDER BY id DESC LIMIT 100`)
    .bind(me.id, me.phone_verified, me.phone)
    .all<{ items: string } & Record<string, unknown>>();
  const ids = new Set<number>();
  const parsed = r.results.map((o) => {
    const items = JSON.parse(o.items || "[]") as { productId: number | null; name: string; qty: number; priceInr: number }[];
    for (const i of items) if (i.productId) ids.add(i.productId);
    return { ...o, items };
  });
  const slugs = new Map<number, { slug: string; image: string | null }>();
  if (ids.size) {
    const list = [...ids].slice(0, 90);
    const p = await db
      .prepare(`SELECT p.id, p.slug, (SELECT key FROM product_images i WHERE i.product_id = p.id ORDER BY sort, id LIMIT 1) AS image_key
                FROM products p WHERE p.id IN (${list.map(() => "?").join(",")})`)
      .bind(...list)
      .all<{ id: number; slug: string; image_key: string | null }>();
    for (const x of p.results) slugs.set(x.id, { slug: x.slug, image: x.image_key ? `/img/${x.image_key}` : null });
  }
  return json({
    orders: parsed.map(({ items, ...o }) => ({
      ...o,
      items: items.map((i) => ({ name: i.name, qty: i.qty, priceInr: i.priceInr, slug: i.productId ? slugs.get(i.productId)?.slug ?? null : null, image: i.productId ? slugs.get(i.productId)?.image ?? null : null })),
    })),
  });
}

// ---------------- Cart & wishlist on every device ----------------
function cleanCart(v: unknown): { slug: string; qty: number }[] {
  if (!Array.isArray(v)) return [];
  const out = new Map<string, number>();
  for (const l of v.slice(0, 40) as Record<string, unknown>[]) {
    const slug = String(l?.slug ?? "");
    const qty = Number(l?.qty);
    if (!/^[a-z0-9-]{1,80}$/.test(slug) || !Number.isInteger(qty) || qty < 1) continue;
    out.set(slug, Math.min(10, (out.get(slug) ?? 0) + qty));
  }
  return [...out].slice(0, 20).map(([slug, qty]) => ({ slug, qty }));
}
function cleanWish(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(String).filter((s) => /^[a-z0-9-]{1,80}$/.test(s)))].slice(0, 100);
}

async function sync(db: D1Database, me: Customer, m: string, req: Request): Promise<Response> {
  const row = await db.prepare("SELECT cart, wishlist FROM customers WHERE id = ?").bind(me.id).first<{ cart: string; wishlist: string }>();
  const saved = { cart: cleanCart(JSON.parse(row?.cart || "[]")), wishlist: cleanWish(JSON.parse(row?.wishlist || "[]")) };
  if (m === "GET") return json(saved);
  if (m !== "POST") throw new HttpError(405, "Not allowed");
  const body = await readJson(req);
  let cart = body.cart === undefined ? saved.cart : cleanCart(body.cart);
  let wishlist = body.wishlist === undefined ? saved.wishlist : cleanWish(body.wishlist);
  if (body.merge === true) {
    // Just logged in: keep what was saved on the account and add what is on this device.
    const merged = new Map(saved.cart.map((l) => [l.slug, l.qty]));
    for (const l of cart) merged.set(l.slug, Math.max(merged.get(l.slug) ?? 0, l.qty));
    cart = [...merged].slice(0, 20).map(([slug, qty]) => ({ slug, qty }));
    wishlist = cleanWish([...saved.wishlist, ...wishlist]);
  }
  await db.prepare("UPDATE customers SET cart = ?, wishlist = ? WHERE id = ?").bind(JSON.stringify(cart), JSON.stringify(wishlist), me.id).run();
  return json({ cart, wishlist });
}


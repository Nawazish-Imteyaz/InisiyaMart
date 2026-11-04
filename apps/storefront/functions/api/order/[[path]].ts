// Public customer endpoints (no login):
//   POST /api/order          → place an order from the website cart
//   GET  /api/order/track    → ?n=IH1004&phone=98XXXXXXXX → order status for the customer
//   POST /api/order/payment  → customer reports a UPI payment reference (UTR) for the team to verify
// Prices, stock and totals are always worked out here from the database, never trusted from the browser.
import { getSetting, HttpError, int, json, readJson, str, type Ctx, type D1Database } from "../../_lib/util";

const MAX_ORDERS_PER_HOUR = 5;

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  try {
    const raw = ctx.params.path;
    const seg = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
    const m = ctx.request.method;
    if (seg.length === 0 && m === "POST") return await placeOrder(ctx);
    if (seg[0] === "track" && m === "GET") return await track(ctx);
    if (seg[0] === "payment" && m === "POST") return await reportPayment(ctx);
    throw new HttpError(404, "Not found");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong. Please try again or message us on WhatsApp." }, 500);
  }
};

/** Last 10 digits of an Indian mobile number, or "" if it isn't one. */
function mobile(v: unknown): string {
  const d = String(v ?? "").replace(/[^0-9]/g, "");
  const ten = d.length > 10 ? d.slice(-10) : d;
  return /^[6-9][0-9]{9}$/.test(ten) ? ten : "";
}

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) throw new HttpError(403, "Request blocked");
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) throw new HttpError(415, "Request blocked");
}

async function shippingFor(db: D1Database, subtotal: number): Promise<number | null> {
  const fee = await getSetting(db, "shipping_fee");
  if (fee === "") return null; // not set yet → confirmed on WhatsApp
  const freeAbove = await getSetting(db, "free_shipping_above");
  if (freeAbove !== "" && subtotal >= Number(freeAbove)) return 0;
  return Number(fee);
}

async function placeOrder({ request: req, env }: Ctx): Promise<Response> {
  sameOrigin(req);
  const db = env.DB;
  const ip = req.headers.get("cf-connecting-ip") ?? "";
  const recent = await db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE source = 'website' AND ip = ? AND created_at > datetime('now', '-1 hour')")
    .bind(ip)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_ORDERS_PER_HOUR) throw new HttpError(429, "Too many orders from this device. Please message us on WhatsApp.");

  const body = await readJson(req);
  if (body.consent !== true) throw new HttpError(400, "Please accept the privacy policy to place the order");
  const c = (body.customer ?? {}) as Record<string, unknown>;
  const name = str(c.name, 100, "Name", true);
  const phone = mobile(c.phone);
  if (!phone) throw new HttpError(400, "Enter a valid 10-digit mobile number");
  const email = str(c.email, 120, "Email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
  const address = str(c.address, 400, "Address", true);
  const city = str(c.city, 60, "City", true);
  const state = str(c.state, 60, "State", true);
  const pincode = str(c.pincode, 6, "PIN code", true);
  if (!/^[1-9][0-9]{5}$/.test(pincode)) throw new HttpError(400, "PIN code must be 6 digits");
  const gift = str(body.gift_message, 300, "Gift message");
  const notes = str(body.notes, 500, "Notes");

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) throw new HttpError(400, "Your cart is empty");
  if (rawItems.length > 20) throw new HttpError(400, "Too many items in one order");
  const wanted = new Map<string, number>();
  for (const it of rawItems as Record<string, unknown>[]) {
    const slug = str(it?.slug, 80, "Product", true);
    const qty = int(it?.qty ?? 1, "Quantity", { min: 1, max: 10 }) as number;
    wanted.set(slug, Math.min(10, (wanted.get(slug) ?? 0) + qty));
  }

  const slugs = [...wanted.keys()];
  const rows = await db
    .prepare(`SELECT id, slug, name, price_inr, stock, track_stock, status FROM products WHERE slug IN (${slugs.map(() => "?").join(",")})`)
    .bind(...slugs)
    .all<{ id: number; slug: string; name: string; price_inr: number | null; stock: number; track_stock: number; status: string }>();
  const bySlug = new Map(rows.results.map((r) => [r.slug, r]));

  const items: { productId: number; name: string; qty: number; priceInr: number }[] = [];
  for (const [slug, qty] of wanted) {
    const p = bySlug.get(slug);
    if (!p || p.status !== "active") throw new HttpError(409, "One of the gifts in your cart is no longer available. Please remove it and try again.");
    if (p.price_inr === null) throw new HttpError(409, `"${p.name}" has no fixed price. Please ask us on WhatsApp.`);
    if (p.track_stock && p.stock < qty) {
      throw new HttpError(409, p.stock <= 0 ? `Sorry, "${p.name}" just went out of stock.` : `Sorry, only ${p.stock} of "${p.name}" left. Please lower the quantity.`);
    }
    items.push({ productId: p.id, name: p.name, qty, priceInr: p.price_inr });
  }

  const subtotal = items.reduce((s, i) => s + i.qty * i.priceInr, 0);
  const shipping = await shippingFor(db, subtotal);
  const total = subtotal + (shipping ?? 0);

  const r = await db
    .prepare(`INSERT INTO orders (customer_name, phone, email, address, city, state, pincode, items, subtotal, shipping, total, notes, gift_message, source, ip)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', ?)`)
    .bind(name, phone, email, address, city, state, pincode, JSON.stringify(items), subtotal, shipping ?? 0, total,
      shipping === null ? (notes ? `${notes}\n` : "") + "Delivery charge not set yet: confirm it with the customer." : notes, gift, ip)
    .run();
  const id = r.meta.last_row_id as number;
  const number = `IH${1000 + id}`;
  await db.batch([
    db.prepare("UPDATE orders SET number = ? WHERE id = ?").bind(number, id),
    db.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, 'new', 'Order placed on the website', 'Customer')").bind(id),
    ...items.map((i) => db.prepare("UPDATE products SET stock = MAX(0, stock - ?), updated_at = datetime('now') WHERE id = ? AND track_stock = 1").bind(i.qty, i.productId)),
  ]);

  return json({ number, items, subtotal, shipping, total, upi_id: await getSetting(db, "upi_id") }, 201);
}

async function findOrder(db: D1Database, n: unknown, phone: unknown) {
  const number = String(n ?? "").trim().toUpperCase().replace(/\s/g, "");
  const ph = mobile(phone);
  if (!/^IH[0-9]{4,8}$/.test(number) || !ph) throw new HttpError(400, "Enter your order number (like IH1004) and the mobile number used for the order");
  const o = await db.prepare("SELECT * FROM orders WHERE number = ?").bind(number).first<Record<string, unknown> & { id: number; phone: string }>();
  // Same message for "no such order" and "wrong phone", so order numbers can't be probed.
  if (!o || mobile(o.phone) !== ph) throw new HttpError(404, "We couldn't find that order. Check the order number and mobile number.");
  return o;
}

async function track({ request: req, env }: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const o = await findOrder(env.DB, url.searchParams.get("n"), url.searchParams.get("phone"));
  const ev = await env.DB.prepare("SELECT status, created_at FROM order_events WHERE order_id = ? ORDER BY id").bind(o.id).all<{ status: string; created_at: string }>();
  // Only what the customer needs: no internal notes, staff names or IP.
  const steps: { status: string; at: string }[] = [];
  for (const e of ev.results) if (e.status && steps[steps.length - 1]?.status !== e.status) steps.push({ status: e.status, at: e.created_at });
  return json({
    order: {
      number: o.number, status: o.status, payment_status: o.payment_status, payment_reported: !!o.payment_ref,
      items: JSON.parse(String(o.items || "[]")).map((i: { name: string; qty: number; priceInr: number }) => ({ name: i.name, qty: i.qty, priceInr: i.priceInr })),
      subtotal: o.subtotal, shipping: o.shipping, discount: o.discount, total: o.total,
      courier: o.courier, awb: o.awb, tracking_url: o.tracking_url, city: o.city, pincode: o.pincode, created_at: o.created_at,
      steps,
    },
    upi_id: o.payment_status === "pending" ? await getSetting(env.DB, "upi_id") : "",
    shipping_pending: !o.shipping && (await getSetting(env.DB, "shipping_fee")) === "",
  });
}

async function reportPayment({ request: req, env }: Ctx): Promise<Response> {
  sameOrigin(req);
  const body = await readJson(req);
  const o = await findOrder(env.DB, body.n, body.phone);
  const utr = String(body.utr ?? "").replace(/\s/g, "");
  if (!/^[0-9]{12}$/.test(utr)) throw new HttpError(400, "The UPI reference (UTR) is the 12-digit number in your payment app");
  if (o.payment_status !== "pending") return json({ ok: true, already: true });
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET payment_ref = ?, updated_at = datetime('now') WHERE id = ?").bind(utr, o.id),
    env.DB.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, ?, ?, 'Customer')")
      .bind(o.id, o.status, `Customer says they paid by UPI. UTR ${utr}. Please check your bank app, then mark as Paid.`),
  ]);
  return json({ ok: true });
}

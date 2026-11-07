// Public customer endpoints:
//   POST /api/order          → place an order from the website cart
//   POST /api/order/coupon   → { code, items } check a coupon and get the discount
//   GET  /api/order/track    → ?n=IH1004&phone=98XXXXXXXX (or logged in) → order status for the customer
//   POST /api/order/payment  → customer reports a UPI payment reference (UTR) for the team to verify
// Prices, stock, coupons and totals are always worked out here from the database, never trusted from the browser.
import { emit } from "../../_lib/providers";
import { currentCustomer, priceCoupon, saveAddress } from "../../_lib/shop";
import { PRODUCT_JOIN, PUBLIC_PRODUCT } from "../../_lib/market";
import { clientIp, EMAIL_RE, getSetting, isLocalPin, HttpError, int, json, mobile, readJson, sameOrigin, str, type Ctx, type D1Database } from "../../_lib/util";

const MAX_ORDERS_PER_HOUR = 5;
const MAX_OPEN_UNPAID = 2;
const HOUSE_SELLER = 1;

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  try {
    const raw = ctx.params.path;
    const seg = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
    const m = ctx.request.method;
    if (seg.length === 0 && m === "POST") return await placeOrder(ctx);
    if (seg[0] === "coupon" && m === "POST") return await checkCoupon(ctx);
    if (seg[0] === "track" && m === "GET") return await track(ctx);
    if (seg[0] === "payment" && m === "POST") return await reportPayment(ctx);
    throw new HttpError(404, "Not found");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong. Please try again or message us on WhatsApp." }, 500);
  }
};

/** Delivery charge: own team for local PIN codes (if set up), courier rate for everyone else. null = not set yet. */
async function deliveryFor(db: D1Database, subtotal: number, pincode: string): Promise<{ fee: number | null; local: boolean }> {
  const pins = await getSetting(db, "local_pins");
  const localFee = await getSetting(db, "local_fee");
  if (pins && localFee !== "" && isLocalPin(pins, pincode)) {
    const freeAbove = await getSetting(db, "local_free_above");
    return { fee: freeAbove !== "" && subtotal >= Number(freeAbove) ? 0 : Number(localFee), local: true };
  }
  return { fee: await shippingFor(db, subtotal), local: false };
}

async function shippingFor(db: D1Database, subtotal: number): Promise<number | null> {
  const fee = await getSetting(db, "shipping_fee");
  if (fee === "") return null; // not set yet → confirmed on WhatsApp
  const freeAbove = await getSetting(db, "free_shipping_above");
  if (freeAbove !== "" && subtotal >= Number(freeAbove)) return 0;
  return Number(fee);
}

type Line = { productId: number; name: string; qty: number; priceInr: number; track: boolean };

/** Re-reads every cart line from the database: only live, priced, in-stock products at today's price. */
async function priceCart(db: D1Database, rawItems: unknown): Promise<{ items: Line[]; subtotal: number }> {
  const list = Array.isArray(rawItems) ? rawItems : [];
  if (list.length === 0) throw new HttpError(400, "Your cart is empty");
  if (list.length > 20) throw new HttpError(400, "Too many items in one order");
  const wanted = new Map<string, number>();
  for (const it of list as Record<string, unknown>[]) {
    const slug = str(it?.slug, 80, "Product", true);
    const qty = int(it?.qty ?? 1, "Quantity", { min: 1, max: 10 }) as number;
    wanted.set(slug, Math.min(10, (wanted.get(slug) ?? 0) + qty));
  }
  const slugs = [...wanted.keys()];
  const rows = await db
    // Only products buyers may see (active, approved, shop approved): same rule as the catalogue.
    .prepare(`SELECT p.id, p.slug, p.name, p.price_inr, p.stock, p.track_stock, p.status, COALESCE(p.seller_id, 1) AS seller_id, (${PUBLIC_PRODUCT}) AS visible
              ${PRODUCT_JOIN} WHERE p.slug IN (${slugs.map(() => "?").join(",")})`)
    .bind(...slugs)
    .all<{ id: number; slug: string; name: string; price_inr: number | null; stock: number; track_stock: number; status: string; seller_id: number; visible: number }>();
  const bySlug = new Map(rows.results.map((r) => [r.slug, r]));
  const items: Line[] = [];
  for (const [slug, qty] of wanted) {
    const p = bySlug.get(slug);
    if (!p || !p.visible) throw new HttpError(409, "One of the gifts in your cart is no longer available. Please remove it and try again.");
    // Until split orders (marketplace phase 2), only the house shop's products can be paid here: Insi House must never
    // collect money for other sellers into its own account (decision 010, plan §7).
    if (p.seller_id !== HOUSE_SELLER) throw new HttpError(409, `"${p.name}" is from a maker's shop. Ordering from maker shops opens very soon. Please remove it to continue.`);
    if (p.price_inr === null) throw new HttpError(409, `"${p.name}" has no fixed price. Please ask us on WhatsApp.`);
    if (p.track_stock && p.stock < qty) {
      throw new HttpError(409, p.stock <= 0 ? `Sorry, "${p.name}" just went out of stock.` : `Sorry, only ${p.stock} of "${p.name}" left. Please lower the quantity.`);
    }
    items.push({ productId: p.id, name: p.name, qty, priceInr: p.price_inr, track: !!p.track_stock });
  }
  return { items, subtotal: items.reduce((s, i) => s + i.qty * i.priceInr, 0) };
}

/**
 * Unpaid UPI website orders hold stock. After "hold_hours" (Settings, default 48, 0 = never) without a payment
 * or UTR, they are cancelled and the stock goes back, so fake orders can't block the shop for ever.
 */
async function releaseUnpaid(db: D1Database) {
  const h = Number((await getSetting(db, "hold_hours")) || 48);
  if (!h || h < 1) return;
  const stale = await db
    .prepare(`SELECT id, items FROM orders WHERE source = 'website' AND status = 'new' AND payment_status = 'pending' AND payment_ref = ''
              AND created_at < datetime('now', ?) LIMIT 20`)
    .bind(`-${Math.floor(h)} hours`)
    .all<{ id: number; items: string }>();
  for (const o of stale.results) {
    const back = (JSON.parse(o.items || "[]") as { productId: number | null; qty: number }[])
      .filter((i) => i.productId)
      .map((i) => db.prepare("UPDATE products SET stock = stock + ? WHERE id = ? AND track_stock = 1").bind(i.qty, i.productId));
    // The status guard makes sure two requests can't both give the stock back.
    const done = await db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'new' AND payment_status = 'pending' RETURNING id").bind(o.id).first();
    if (!done) continue;
    await db.batch([
      ...back,
      db.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, 'cancelled', ?, 'System')").bind(o.id, `Cancelled automatically: not paid within ${Math.floor(h)} hours. Stock was put back.`),
    ]);
  }
}

async function couponGuard(db: D1Database, ip: string) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM customer_login_attempts WHERE phone = '#coupon' AND ip = ? AND ok = 0 AND created_at > datetime('now', '-15 minutes')").bind(ip).first<{ n: number }>();
  if ((r?.n ?? 0) >= 15) throw new HttpError(429, "Too many coupon tries. Please wait a few minutes.");
}
async function couponFailed(db: D1Database, ip: string) {
  await db.prepare("INSERT INTO customer_login_attempts (phone, ip, ok) VALUES ('#coupon', ?, 0)").bind(ip).run();
}

async function checkCoupon({ request: req, env }: Ctx): Promise<Response> {
  sameOrigin(req);
  const db = env.DB;
  const ip = clientIp(req);
  await couponGuard(db, ip);
  const body = await readJson(req);
  const { subtotal } = await priceCart(db, body.items);
  const me = await currentCustomer(db, req);
  try {
    const c = await priceCoupon(db, body.code, subtotal, { customerId: me?.id, phone: me?.phone ?? mobile(body.phone) });
    if (c.perCustomer > 0 && !me) throw new HttpError(401, "Please log in to use this coupon (it can be used once per customer).");
    return json({ code: c.code, discount: c.discount, label: c.label });
  } catch (e) {
    await couponFailed(db, ip);
    throw e;
  }
}

async function placeOrder(ctx: Ctx): Promise<Response> {
  const { request: req, env } = ctx;
  sameOrigin(req);
  const db = env.DB;
  const ip = clientIp(req);
  const recent = await db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE source = 'website' AND ip = ? AND created_at > datetime('now', '-1 hour')")
    .bind(ip)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_ORDERS_PER_HOUR) throw new HttpError(429, "Too many orders from this device. Please message us on WhatsApp.");

  await releaseUnpaid(db);
  const me = await currentCustomer(db, req);
  if (!me && (await getSetting(db, "require_login")) === "1") throw new HttpError(401, "Please log in with your mobile number to place the order.");

  const body = await readJson(req);
  if (body.consent !== true) throw new HttpError(400, "Please accept the privacy policy to place the order");
  const c = (body.customer ?? {}) as Record<string, unknown>;
  const name = str(c.name, 100, "Name", true);
  const phone = mobile(c.phone);
  if (!phone) throw new HttpError(400, "Enter a valid 10-digit mobile number");
  const email = str(c.email, 120, "Email");
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address");
  const address = str(c.address, 400, "Address", true);
  const city = str(c.city, 60, "City", true);
  const state = str(c.state, 60, "State", true);
  const pincode = str(c.pincode, 6, "PIN code", true);
  if (!/^[1-9][0-9]{5}$/.test(pincode)) throw new HttpError(400, "PIN code must be 6 digits");
  const gift = str(body.gift_message, 300, "Gift message");
  let notes = str(body.notes, 500, "Notes");
  const occasion = str(body.occasion, 60, "Occasion");

  const method = body.payment_method === "cod" ? "cod" : "upi";
  if (method === "cod" && (await getSetting(db, "cod_enabled")) !== "1") throw new HttpError(400, "Cash on delivery is not available right now. Please pay by UPI.");

  const { items, subtotal } = await priceCart(db, body.items);

  // Unpaid UPI orders hold stock. Limit how many can be open at once per device and per mobile number, so one
  // person can't lock up the shop's stock with fake orders (a typed-in UTR doesn't count as paid).
  if (method === "upi") {
    const open = await db
      .prepare(`SELECT SUM(ip = ?) AS by_ip, SUM(phone = ?) AS by_phone FROM orders
                WHERE source = 'website' AND status = 'new' AND payment_status = 'pending' AND created_at > datetime('now', '-30 days')`)
      .bind(ip, phone)
      .first<{ by_ip: number | null; by_phone: number | null }>();
    if ((open?.by_ip ?? 0) >= MAX_OPEN_UNPAID || (open?.by_phone ?? 0) >= MAX_OPEN_UNPAID) {
      throw new HttpError(429, "You already have unpaid orders waiting. Please pay for them first, or message us on WhatsApp.");
    }
  }

  let discount = 0;
  let coupon: Awaited<ReturnType<typeof priceCoupon>> | null = null;
  if (body.coupon) {
    await couponGuard(db, ip);
    try {
      coupon = await priceCoupon(db, body.coupon, subtotal, { customerId: me?.id, phone });
      // "Once per customer" coupons need a login, otherwise a new phone number each time would get around the limit.
      if (coupon.perCustomer > 0 && !me) throw new HttpError(401, "Please log in to use this coupon (it can be used once per customer).");
      discount = coupon.discount;
    } catch (e) {
      await couponFailed(db, ip);
      throw e;
    }
  }

  const delivery = await deliveryFor(db, subtotal, pincode);
  let shipping = delivery.fee;
  const shipNote = shipping === null ? "Delivery charge not set yet: confirm it with the customer." : "";
  if (method === "cod") {
    const fee = Number((await getSetting(db, "cod_fee")) || 0);
    if (fee > 0) { shipping = (shipping ?? 0) + fee; notes = `${notes ? `${notes}\n` : ""}Delivery includes cash-on-delivery fee ₹${fee}.`; }
  }
  const total = Math.max(0, subtotal + (shipping ?? 0) - discount);
  if (shipNote) notes = `${notes ? `${notes}\n` : ""}${shipNote}`;

  // 1. Claim one coupon use atomically (two orders at the same moment can't both take the last use).
  if (coupon) {
    const claimed = await db.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND active = 1 AND (usage_limit IS NULL OR used_count < usage_limit) RETURNING id").bind(coupon.id).first();
    if (!claimed) throw new HttpError(400, "This coupon has just been fully used. Please remove it and try again.");
  }
  // 2. Reserve stock atomically: a product is only taken if enough is left right now (no overselling the last piece).
  const tracked = items.filter((i) => i.track);
  const res = tracked.length
    ? await db.batch(tracked.map((i) => db.prepare("UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND track_stock = 1 AND stock >= ?").bind(i.qty, i.productId, i.qty)))
    : [];
  const undo = async (upTo: number) => {
    const back = tracked.slice(0, upTo).filter((_, k) => (res[k]?.meta.changes ?? 0) > 0);
    const stmts = back.map((i) => db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(i.qty, i.productId));
    if (coupon) stmts.push(db.prepare("UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE id = ?").bind(coupon.id));
    if (stmts.length) await db.batch(stmts);
  };
  const short = tracked.findIndex((_, k) => (res[k]?.meta.changes ?? 0) === 0);
  if (short >= 0) {
    await undo(tracked.length);
    throw new HttpError(409, `Sorry, "${tracked[short].name}" just sold out. Please lower the quantity or remove it.`);
  }

  // 3. Save the order (the stock and coupon are given back if this fails).
  const lines = items.map(({ track: _t, ...i }) => i);
  let id: number;
  try {
    const r = await db
      .prepare(`INSERT INTO orders (customer_name, phone, email, address, city, state, pincode, items, subtotal, shipping, discount, total, notes, gift_message,
                  source, ip, customer_id, coupon_code, occasion, payment_method, payment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', ?, ?, ?, ?, ?, ?)`)
      .bind(name, phone, email, address, city, state, pincode, JSON.stringify(lines), subtotal, shipping ?? 0, discount, total, notes, gift, ip,
        me?.id ?? null, coupon?.code ?? "", occasion, method, method === "cod" ? "cod" : "pending")
      .run();
    id = r.meta.last_row_id as number;
    if (delivery.local) {
      const label = (await getSetting(db, "local_label")) || "Our own delivery";
      await db.prepare("UPDATE orders SET courier = ? WHERE id = ?").bind(label.slice(0, 60), id).run();
    }
  } catch (e) {
    await undo(tracked.length);
    throw e;
  }
  // 4. "Once per customer" coupons: the check above and this insert are separate steps, so two orders sent at
  //    the same moment could both pass. Count the customer's EARLIER orders with this coupon; if the limit is
  //    already reached, this (later) order is removed and its stock and coupon use are given back.
  if (coupon && coupon.perCustomer > 0) {
    const before = await db
      .prepare("SELECT COUNT(*) AS n FROM orders WHERE coupon_code = ? AND status != 'cancelled' AND id < ? AND (customer_id = ? OR phone = ?)")
      .bind(coupon.code, id, me?.id ?? -1, phone)
      .first<{ n: number }>();
    if ((before?.n ?? 0) >= coupon.perCustomer) {
      await db.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();
      await undo(tracked.length);
      throw new HttpError(400, "You have already used this coupon");
    }
  }
  const number = `IH${1000 + id}`;
  await db.batch([
    db.prepare("UPDATE orders SET number = ? WHERE id = ?").bind(number, id),
    db.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, 'new', ?, 'Customer')")
      .bind(id, `Order placed on the website${method === "cod" ? " (cash on delivery)" : ""}${coupon ? ` with coupon ${coupon.code}` : ""}`),
    ...(me ? [db.prepare("UPDATE customers SET cart = '[]' WHERE id = ?").bind(me.id)] : []),
  ]);

  if (me && body.save_address === true) {
    try { await saveAddress(db, me.id, { label: "Home", name, phone, address, city, state, pincode }); } catch { /* address book full: the order still goes through */ }
  }
  emit(ctx, "order.created", { number, total, subtotal, shipping: shipping ?? 0, discount, payment_method: method, city, state, pincode, items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.priceInr })) },
    [`🛍️ New order ${number} · ₹${total}`, `${name} · ${city} ${pincode}${delivery.local ? " · LOCAL delivery" : ""}`,
      ...items.map((i) => `• ${i.name} × ${i.qty}`), method === "cod" ? "💵 Cash on delivery" : "💳 UPI: check the payment",
      gift ? `🎁 Card: ${gift.slice(0, 120)}` : "", `Open: ${new URL(req.url).origin}/admin/#/orders/${id}`].filter(Boolean).join("\n"));

  return json({ number, items: lines, subtotal, shipping, discount, total, local: delivery.local, payment_method: method, upi_id: method === "upi" ? await getSetting(db, "upi_id") : "" }, 201);
}

async function findOrder(db: D1Database, req: Request, n: unknown, phone: unknown) {
  const number = String(n ?? "").trim().toUpperCase().replace(/\s/g, "");
  if (!/^IH[0-9]{4,8}$/.test(number)) throw new HttpError(400, "Enter your order number (like IH1004) and the mobile number used for the order");
  const o = await db.prepare("SELECT * FROM orders WHERE number = ?").bind(number).first<Record<string, unknown> & { id: number; phone: string; customer_id: number | null }>();
  const ph = mobile(phone);
  if (o && ph && mobile(o.phone) === ph) return o;
  // Logged-in customers can open their own orders without typing the mobile number.
  const me = await currentCustomer(db, req);
  if (o && me && (o.customer_id === me.id || (me.phone_verified && mobile(o.phone) === me.phone))) return o;
  if (!ph && !me) throw new HttpError(400, "Enter your order number (like IH1004) and the mobile number used for the order");
  // Slow down guessing: 20 wrong lookups per device per 15 minutes.
  const ip = clientIp(req);
  const bad = await db.prepare("SELECT COUNT(*) AS n FROM customer_login_attempts WHERE phone = '#track' AND ip = ? AND created_at > datetime('now', '-15 minutes')").bind(ip).first<{ n: number }>();
  if ((bad?.n ?? 0) >= 20) throw new HttpError(429, "Too many tries. Please wait 15 minutes, or message us on WhatsApp.");
  await db.prepare("INSERT INTO customer_login_attempts (phone, ip, ok) VALUES ('#track', ?, 0)").bind(ip).run();
  // Same message for "no such order" and "wrong phone", so order numbers can't be probed.
  throw new HttpError(404, "We couldn't find that order. Check the order number and mobile number.");
}

async function track({ request: req, env }: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const o = await findOrder(env.DB, req, url.searchParams.get("n"), url.searchParams.get("phone"));
  const ev = await env.DB.prepare("SELECT status, created_at FROM order_events WHERE order_id = ? ORDER BY id").bind(o.id).all<{ status: string; created_at: string }>();
  // Only what the customer needs: no internal notes, staff names or IP.
  const steps: { status: string; at: string }[] = [];
  for (const e of ev.results) if (e.status && steps[steps.length - 1]?.status !== e.status) steps.push({ status: e.status, at: e.created_at });
  return json({
    order: {
      number: o.number, status: o.status, payment_status: o.payment_status, payment_method: o.payment_method, payment_reported: !!o.payment_ref,
      items: JSON.parse(String(o.items || "[]")).map((i: { name: string; qty: number; priceInr: number }) => ({ name: i.name, qty: i.qty, priceInr: i.priceInr })),
      subtotal: o.subtotal, shipping: o.shipping, discount: o.discount, coupon_code: o.coupon_code, total: o.total,
      courier: o.courier, awb: o.awb, tracking_url: o.tracking_url, city: o.city, pincode: o.pincode, created_at: o.created_at,
      steps,
    },
    phone: mobile(o.phone),
    upi_id: o.payment_status === "pending" ? await getSetting(env.DB, "upi_id") : "",
    shipping_pending: !o.shipping && (await getSetting(env.DB, "shipping_fee")) === "",
  });
}

async function reportPayment({ request: req, env }: Ctx): Promise<Response> {
  sameOrigin(req);
  const body = await readJson(req);
  const o = await findOrder(env.DB, req, body.n, body.phone);
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

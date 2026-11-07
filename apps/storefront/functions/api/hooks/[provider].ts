// Incoming webhooks from partners. Each one is checked with the partner's secret before anything changes.
//   /api/hooks/razorpay  → payment captured / refunded   (X-Razorpay-Signature, HMAC-SHA256)
//   /api/hooks/courier   → Shiprocket tracking updates   (x-api-key token; Shiprocket does not allow its own name in the URL)
//   /api/hooks/whatsapp  → Meta delivery status          (X-Hub-Signature-256, HMAC-SHA256)
import { emit, loadIntegration } from "../../_lib/providers";
import { hmacHex, safeEqual, type Ctx, type D1Database } from "../../_lib/util";

const MAX_BODY = 256 * 1024;

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  const p = String(ctx.params.provider ?? "");
  try {
    if (p === "razorpay" && ctx.request.method === "POST") return await razorpay(ctx);
    if (p === "courier" && ctx.request.method === "POST") return await shiprocket(ctx);
    if (p === "whatsapp") return await whatsapp(ctx);
    return new Response("Not found", { status: 404 });
  } catch (e) {
    console.error("hook", p, e);
    return new Response("Error", { status: 500 });
  }
};

async function rawBody(req: Request): Promise<string | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return null;
  const text = await req.text();
  return text.length > MAX_BODY ? null : text;
}

async function logIn(db: D1Database, source: string, event: string, ok: boolean, detail: string, eventId: string | null = null) {
  // Rejected calls are logged only up to 20 an hour per partner, so a flood of fake calls can't fill the database.
  if (!ok) {
    const n = await db.prepare("SELECT COUNT(*) AS n FROM webhook_log WHERE source = ? AND ok = 0 AND created_at > datetime('now', '-1 hour')").bind(source).first<{ n: number }>();
    if ((n?.n ?? 0) >= 20) return;
  }
  await db.prepare("INSERT INTO webhook_log (direction, source, event, ok, status, detail, event_id) VALUES ('in', ?, ?, ?, ?, ?, ?)")
    .bind(source, event.slice(0, 60), ok ? 1 : 0, ok ? 200 : 401, detail.slice(0, 300), eventId).run();
  if (ok && Math.random() < 0.05) await db.prepare("DELETE FROM webhook_log WHERE created_at < datetime('now', '-60 days')").run();
}

const deny = () => new Response("Unauthorized", { status: 401 });

// ---------------- Razorpay ----------------
async function razorpay({ request: req, env, ...rest }: Ctx): Promise<Response> {
  const ctx = { request: req, env, ...rest } as Ctx;
  const db = env.DB;
  const i = await loadIntegration(env, "razorpay");
  if (!i || !i.secrets.webhook_secret) return new Response("Not set up", { status: 404 });
  const body = await rawBody(req);
  if (body === null) return new Response("Too large", { status: 413 });
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!sig || !safeEqual(await hmacHex(i.secrets.webhook_secret, body), sig)) {
    await logIn(db, "razorpay", "signature", false, "Rejected: signature did not match");
    return deny();
  }
  const eventId = req.headers.get("x-razorpay-event-id");
  if (eventId && (await db.prepare("SELECT id FROM webhook_log WHERE source = 'razorpay' AND event_id = ?").bind(eventId).first())) return new Response("OK");

  const data = JSON.parse(body) as { event?: string; payload?: Record<string, { entity?: Record<string, unknown> }> };
  const event = data.event ?? "";
  const pay = (data.payload?.payment?.entity ?? {}) as { id?: string; amount?: number; currency?: string; notes?: Record<string, string>; description?: string; order_id?: string };
  const rzOrder = (data.payload?.order?.entity ?? {}) as { receipt?: string; notes?: Record<string, string> };
  const refund = (data.payload?.refund?.entity ?? {}) as { id?: string; amount?: number; payment_id?: string; notes?: Record<string, string> };
  const ref = String(pay.notes?.order_number ?? rzOrder.notes?.order_number ?? rzOrder.receipt ?? refund.notes?.order_number ?? pay.description ?? "");
  const number = ref.toUpperCase().match(/IH[0-9]{4,8}/)?.[0] ?? "";
  const o = number ? await db.prepare("SELECT id, number, total, status, payment_status FROM orders WHERE number = ?").bind(number).first<{ id: number; number: string; total: number; status: string; payment_status: string }>() : null;

  let detail = number ? `Order ${number}` : "No Insi House order number in the payment";
  if (o && (event === "payment.captured" || event === "order.paid")) {
    const paidRupees = Math.floor(Number(pay.amount ?? 0) / 100);
    if (pay.currency && pay.currency !== "INR") {
      detail = `${o.number}: payment in ${pay.currency}, not INR. Not marked paid`;
    } else if (paidRupees >= o.total && o.payment_status !== "paid") {
      await db.batch([
        db.prepare("UPDATE orders SET payment_status = 'paid', payment_method = 'razorpay', payment_ref = ?, updated_at = datetime('now') WHERE id = ?").bind(String(pay.id ?? ""), o.id),
        db.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, ?, ?, 'Razorpay')").bind(o.id, o.status, `Paid ₹${paidRupees} online (${pay.id ?? ""})`),
      ]);
      emit(ctx, "order.paid", { number: o.number, amount: paidRupees, via: "razorpay" }, `✅ ${o.number} PAID online · ₹${paidRupees} (Razorpay ${pay.id ?? ""})`);
      detail = `${o.number} marked Paid (₹${paidRupees})`;
    } else if (paidRupees < o.total) {
      await db.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, ?, ?, 'Razorpay')")
        .bind(o.id, o.status, `Razorpay payment of ₹${paidRupees} is LESS than the order total ₹${o.total}. Not marked as paid. Please check.`).run();
      detail = `${o.number}: amount ₹${paidRupees} lower than total, not marked paid`;
    }
  } else if (o && event === "refund.processed") {
    const refunded = Math.floor(Number(refund.amount ?? 0) / 100);
    const full = refunded >= o.total;
    await db.batch([
      // A partial refund is only noted; the order is marked Refunded only when the whole amount came back.
      db.prepare(`UPDATE orders SET ${full ? "payment_status = 'refunded', " : ""}updated_at = datetime('now') WHERE id = ?`).bind(o.id),
      db.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, ?, ?, 'Razorpay')").bind(o.id, o.status, `${full ? "Full" : "Partial"} refund of ₹${refunded} processed (${refund.id ?? ""})`),
    ]);
    detail = `${o.number} ${full ? "refunded" : `partly refunded ₹${refunded}`}`;
  }
  await logIn(db, "razorpay", event, true, detail, eventId);
  return new Response("OK");
}

// ---------------- Shiprocket ----------------
const RANK: Record<string, number> = { new: 0, confirmed: 1, packed: 2, shipped: 3, delivered: 4 };
function mapCourierStatus(s: string): string | null {
  const t = s.toUpperCase();
  if (t.includes("RTO")) return "returned";
  if (t.includes("CANCEL")) return "cancelled";
  if (t.includes("UNDELIVERED")) return "shipped";
  if (t.includes("DELIVERED")) return "delivered";
  if (/SHIPPED|TRANSIT|OUT FOR DELIVERY|PICKED UP|REACHED|DISPATCH/.test(t)) return "shipped";
  if (/PICKUP SCHEDULED|MANIFEST|AWB ASSIGNED|PACKED/.test(t)) return "packed";
  return null;
}

async function shiprocket({ request: req, env }: Ctx): Promise<Response> {
  const db = env.DB;
  const i = await loadIntegration(env, "shiprocket");
  if (!i || !i.secrets.webhook_token) return new Response("Not set up", { status: 404 });
  const token = req.headers.get("x-api-key") ?? "";
  if (!token || !safeEqual(token, i.secrets.webhook_token)) {
    await logIn(db, "shiprocket", "token", false, "Rejected: wrong x-api-key token");
    return deny();
  }
  const body = await rawBody(req);
  if (body === null) return new Response("Too large", { status: 413 });
  const d = JSON.parse(body || "{}") as { awb?: string | number; current_status?: string; shipment_status?: string; order_id?: string; courier_name?: string };
  const awb = String(d.awb ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 60);
  const raw = String(d.current_status ?? d.shipment_status ?? "");
  const number = String(d.order_id ?? "").toUpperCase().match(/IH[0-9]{4,8}/)?.[0] ?? "";
  const o = await db
    .prepare("SELECT id, number, status, items FROM orders WHERE (number = ? AND ? != '') OR (awb = ? AND ? != '') LIMIT 1")
    .bind(number, number, awb, awb)
    .first<{ id: number; number: string; status: string; items: string }>();
  if (!o) { await logIn(db, "shiprocket", raw || "update", true, `No matching order (${number || awb || "no id"})`); return new Response("OK"); }

  const next = mapCourierStatus(raw);
  const sets = ["courier = ?", "awb = ?", "tracking_url = ?", "updated_at = datetime('now')"];
  const vals: unknown[] = [String(d.courier_name ?? "").slice(0, 60) || "Shiprocket", awb, awb ? `https://shiprocket.co/tracking/${awb}` : ""];
  const stmts = [];
  let status = o.status;
  const forward = next && next in RANK && o.status in RANK && RANK[next] > RANK[o.status];
  const closing = next && (next === "cancelled" || next === "returned") && o.status !== next && o.status !== "cancelled" && o.status !== "returned";
  if (forward || closing) {
    status = next!;
    sets.push("status = ?");
    vals.push(status);
    if (closing) {
      for (const it of JSON.parse(o.items || "[]") as { productId: number | null; qty: number }[]) {
        if (it.productId) stmts.push(db.prepare("UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ? AND track_stock = 1").bind(it.qty, it.productId));
      }
    }
  }
  await db.batch([
    db.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, o.id),
    db.prepare("INSERT INTO order_events (order_id, status, note, user_name) VALUES (?, ?, ?, 'Shiprocket')").bind(o.id, status, `Courier update: ${raw || "tracking added"}${awb ? ` (AWB ${awb})` : ""}`),
    ...stmts,
  ]);
  await logIn(db, "shiprocket", raw || "update", true, `${o.number}: ${o.status} → ${status}`);
  return new Response("OK");
}

// ---------------- WhatsApp (Meta) ----------------
async function whatsapp({ request: req, env }: Ctx): Promise<Response> {
  const db = env.DB;
  const i = await loadIntegration(env, "whatsapp");
  if (!i) return new Response("Not set up", { status: 404 });
  const url = new URL(req.url);
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && !!i.secrets.verify_token && safeEqual(url.searchParams.get("hub.verify_token") ?? "", i.secrets.verify_token);
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { headers: { "content-type": "text/plain" } }) : deny();
  }
  if (req.method !== "POST") return new Response("Not allowed", { status: 405 });
  const body = await rawBody(req);
  if (body === null) return new Response("Too large", { status: 413 });
  if (!i.secrets.app_secret) { await logIn(db, "whatsapp", "signature", false, "Rejected: add the App secret to accept WhatsApp webhooks"); return deny(); }
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  if (!safeEqual(`sha256=${await hmacHex(i.secrets.app_secret, body)}`, sig)) { await logIn(db, "whatsapp", "signature", false, "Rejected: signature did not match"); return deny(); }
  const d = JSON.parse(body || "{}") as { entry?: { changes?: { value?: { statuses?: { status?: string }[]; messages?: unknown[] } }[] }[] };
  let statuses = 0, messages = 0, failed = 0;
  for (const e of d.entry ?? []) for (const c of e.changes ?? []) {
    for (const s of c.value?.statuses ?? []) { statuses++; if (s.status === "failed") failed++; }
    messages += c.value?.messages?.length ?? 0;
  }
  await logIn(db, "whatsapp", messages ? "message" : "status", true, `${statuses} status update(s)${failed ? `, ${failed} failed` : ""}${messages ? `, ${messages} customer message(s): reply in the WhatsApp app` : ""}`);
  return new Response("OK");
}

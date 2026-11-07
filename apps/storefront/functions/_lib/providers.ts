// Partner integrations (payment gateways, couriers, WhatsApp / SMS) and outgoing webhooks.
// Keys are typed into the admin console once, stored ENCRYPTED in the database (AES-GCM with the
// SECRETS_KEY server secret) and never sent back to any browser. Only the server reads them.
import { decryptJson, encryptJson, hmacHex, HttpError, randomHex, type Ctx, type Env } from "./util";

export interface FieldDef { key: string; label: string; secret?: boolean; hint?: string; placeholder?: string; optional?: boolean }
export interface ProviderDef {
  id: string;
  group: "payments" | "shipping" | "messaging";
  name: string;
  blurb: string;
  signup: string;
  fields: FieldDef[];
  /** Incoming webhook path on our site, if the partner can call us. */
  webhook?: { path: string; events: string; how: string };
  testable: boolean;
  /** "ready" = the website already uses it when switched on; "keys" = keys are stored, connection comes in a later update. */
  readiness: "ready" | "keys";
  uses: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "razorpay", group: "payments", name: "Razorpay", signup: "https://dashboard.razorpay.com/signup",
    blurb: "UPI, cards, net banking and wallets with automatic payment confirmation.",
    uses: "When switched on, payments reported by Razorpay mark the order as Paid automatically.",
    fields: [
      { key: "key_id", label: "Key ID", placeholder: "rzp_test_… or rzp_live_…", hint: "Dashboard → Account & Settings → API keys." },
      { key: "key_secret", label: "Key secret", secret: true },
      { key: "webhook_secret", label: "Webhook secret", secret: true, hint: "You choose this when you add the webhook in Razorpay. Paste the same text here." },
    ],
    webhook: { path: "/api/hooks/razorpay", events: "payment.captured, order.paid, refund.processed", how: "Razorpay dashboard → Webhooks → Add new webhook" },
    testable: true, readiness: "ready",
  },
  {
    id: "phonepe", group: "payments", name: "PhonePe Payment Gateway", signup: "https://business.phonepe.com/",
    blurb: "PhonePe checkout for UPI and cards.",
    uses: "Keys are stored safely. The checkout connection will be added when you are approved.",
    fields: [
      { key: "client_id", label: "Client ID / Merchant ID" },
      { key: "client_version", label: "Client version", optional: true, placeholder: "1" },
      { key: "client_secret", label: "Client secret / Salt key", secret: true },
    ],
    testable: false, readiness: "keys",
  },
  {
    id: "cashfree", group: "payments", name: "Cashfree Payments", signup: "https://merchant.cashfree.com/merchants/signup",
    blurb: "UPI, cards and net banking. Good rates for small businesses.",
    uses: "Keys are stored safely. The checkout connection will be added when you are approved.",
    fields: [
      { key: "app_id", label: "App ID" },
      { key: "secret_key", label: "Secret key", secret: true },
    ],
    testable: false, readiness: "keys",
  },
  {
    id: "shiprocket", group: "shipping", name: "Shiprocket", signup: "https://app.shiprocket.in/register",
    blurb: "One account for Delhivery, Xpressbees, Ekart, DTDC, Blue Dart and more. Picks up from Azamgarh.",
    uses: "When switched on, tracking updates from Shiprocket move the order to Shipped / Delivered automatically and add the tracking link.",
    fields: [
      { key: "email", label: "API user email", hint: "Shiprocket → Settings → API → Create an API user (use a different email from your login)." },
      { key: "password", label: "API user password", secret: true },
      { key: "pickup_location", label: "Pickup location name", optional: true, placeholder: "e.g. Primary", hint: "Exactly as written in Shiprocket → Settings → Pickup addresses." },
      { key: "webhook_token", label: "Webhook token", secret: true, hint: "Any long random text. Paste the same token in Shiprocket's webhook settings (x-api-key)." },
    ],
    webhook: { path: "/api/hooks/courier", events: "Shipment status updates", how: "Shiprocket → Settings → API → Webhooks (token goes in x-api-key)" },
    testable: true, readiness: "ready",
  },
  {
    id: "delhivery", group: "shipping", name: "Delhivery (direct)", signup: "https://one.delhivery.com/",
    blurb: "Book Delhivery directly, if you don't use Shiprocket.",
    uses: "Keys are stored safely. Booking from the admin will be added later.",
    fields: [
      { key: "api_token", label: "API token", secret: true },
      { key: "pickup_name", label: "Pickup location name", optional: true },
    ],
    testable: true, readiness: "keys",
  },
  {
    id: "whatsapp", group: "messaging", name: "WhatsApp Business (Meta Cloud API)", signup: "https://business.facebook.com/",
    blurb: "Send login codes (OTP) and order updates on WhatsApp.",
    uses: "When switched on with an OTP template, customers log in with a WhatsApp code.",
    fields: [
      { key: "phone_number_id", label: "Phone number ID", hint: "Meta → WhatsApp → API setup." },
      { key: "waba_id", label: "WhatsApp Business account ID", optional: true },
      { key: "access_token", label: "Permanent access token", secret: true, hint: "Create a System User token with whatsapp_business_messaging permission." },
      { key: "otp_template", label: "OTP template name", placeholder: "e.g. login_code", hint: "An approved Authentication template with a copy-code button." },
      { key: "template_lang", label: "Template language code", optional: true, placeholder: "en" },
      { key: "app_secret", label: "App secret", secret: true, optional: true, hint: "Meta app → Settings → Basic. Used to check webhooks really come from Meta." },
      { key: "verify_token", label: "Webhook verify token", secret: true, optional: true, hint: "Any random text. Paste the same in Meta's webhook setup." },
    ],
    webhook: { path: "/api/hooks/whatsapp", events: "messages (delivery status)", how: "Meta app → WhatsApp → Configuration → Webhook" },
    testable: true, readiness: "ready",
  },
  {
    id: "telegram", group: "messaging", name: "Telegram alerts (for you)", signup: "https://telegram.org/",
    blurb: "Free instant alert on your phone for every new order, payment and enquiry, even when the admin is closed.",
    uses: "When switched on, you get a Telegram message for each new order and enquiry. Free, no limits for this use.",
    fields: [
      { key: "bot_token", label: "Bot token", secret: true, hint: "In Telegram, open @BotFather → /newbot → copy the token it gives you." },
      { key: "chat_id", label: "Your chat ID", optional: true, hint: "Send any message to your new bot, then press “Test connection”: it shows your chat ID to paste here. For a family group, add the bot to the group first." },
    ],
    testable: true, readiness: "ready",
  },
  {
    id: "msg91", group: "messaging", name: "MSG91 (SMS OTP)", signup: "https://msg91.com/signup",
    blurb: "SMS login codes, DLT-approved for India. Used if WhatsApp is not set up.",
    uses: "When switched on, customers can log in with an SMS code.",
    fields: [
      { key: "authkey", label: "Auth key", secret: true },
      { key: "otp_template_id", label: "OTP template ID", hint: "The DLT-approved OTP template in MSG91." },
    ],
    testable: false, readiness: "ready",
  },
];

export function providerDef(id: string): ProviderDef {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new HttpError(404, "Unknown partner");
  return p;
}

export interface Integration { enabled: boolean; mode: "test" | "live"; config: Record<string, string>; secrets: Record<string, string> }

/** Full integration with decrypted keys. Server-side only. Returns null when not saved or switched off. */
export async function loadIntegration(env: Env, id: string, evenIfOff = false): Promise<Integration | null> {
  const row = await env.DB.prepare("SELECT enabled, mode, config, secrets FROM integrations WHERE provider = ?").bind(id)
    .first<{ enabled: number; mode: "test" | "live"; config: string; secrets: string }>();
  if (!row || (!row.enabled && !evenIfOff)) return null;
  let secrets: Record<string, string> = {};
  try { secrets = await decryptJson(env, `integration:${id}`, row.secrets); } catch (e) { console.error("decrypt failed", id, e); }
  return { enabled: !!row.enabled, mode: row.mode, config: JSON.parse(row.config || "{}"), secrets };
}

export async function saveSecrets(env: Env, id: string, secrets: Record<string, string>): Promise<string> {
  return Object.keys(secrets).length ? encryptJson(env, `integration:${id}`, secrets) : "";
}

const val = (i: Integration, k: string) => i.config[k] ?? i.secrets[k] ?? "";

/** Checks the keys with the partner. Never returns the keys themselves. */
export async function testIntegration(env: Env, id: string): Promise<{ ok: boolean; message: string }> {
  const i = await loadIntegration(env, id, true);
  if (!i) return { ok: false, message: "Save the keys first." };
  const timeout = AbortSignal.timeout(12_000);
  try {
    if (id === "razorpay") {
      const r = await fetch("https://api.razorpay.com/v1/payments?count=1", { headers: { authorization: `Basic ${btoa(`${val(i, "key_id")}:${val(i, "key_secret")}`)}` }, signal: timeout });
      return r.ok ? { ok: true, message: `Connected to Razorpay (${val(i, "key_id").startsWith("rzp_live") ? "live" : "test"} keys).` } : { ok: false, message: `Razorpay said HTTP ${r.status}. Check the Key ID and secret.` };
    }
    if (id === "shiprocket") {
      const r = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: val(i, "email"), password: val(i, "password") }), signal: timeout,
      });
      const d = (await r.json().catch(() => ({}))) as { token?: string };
      return r.ok && d.token ? { ok: true, message: "Connected to Shiprocket." } : { ok: false, message: `Shiprocket said HTTP ${r.status}. Check the API user email and password.` };
    }
    if (id === "delhivery") {
      const r = await fetch("https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=276001", { headers: { authorization: `Token ${val(i, "api_token")}` }, signal: timeout });
      return r.ok ? { ok: true, message: "Connected to Delhivery." } : { ok: false, message: `Delhivery said HTTP ${r.status}. Check the API token.` };
    }
    if (id === "whatsapp") {
      const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(val(i, "phone_number_id"))}?fields=display_phone_number,verified_name`, {
        headers: { authorization: `Bearer ${val(i, "access_token")}` }, signal: timeout,
      });
      const d = (await r.json().catch(() => ({}))) as { display_phone_number?: string; verified_name?: string };
      return r.ok ? { ok: true, message: `Connected: ${d.verified_name ?? ""} ${d.display_phone_number ?? ""}`.trim() } : { ok: false, message: `Meta said HTTP ${r.status}. Check the phone number ID and token.` };
    }
    if (id === "telegram") {
      const tok = encodeURIComponent(val(i, "bot_token"));
      const me = await fetch(`https://api.telegram.org/bot${tok}/getMe`, { signal: timeout });
      if (!me.ok) return { ok: false, message: "Telegram did not accept the bot token. Copy it again from @BotFather." };
      if (!val(i, "chat_id")) {
        const up = (await (await fetch(`https://api.telegram.org/bot${tok}/getUpdates?limit=10`, { signal: timeout })).json().catch(() => ({}))) as { result?: { message?: { chat?: { id: number; title?: string; first_name?: string } } }[] };
        const chat = up.result?.map((u) => u.message?.chat).filter(Boolean).pop();
        return chat ? { ok: false, message: `Bot works. Your chat ID is ${chat.id} (${chat.title ?? chat.first_name ?? ""}): paste it in “Your chat ID” and save.` } : { ok: false, message: "Bot works. Now send any message to your bot in Telegram, then press Test again to get your chat ID." };
      }
      const send = await telegram(i, "✅ Insi House alerts are connected. You'll get a message for every new order.");
      return send ? { ok: true, message: "Test message sent to Telegram." } : { ok: false, message: "Could not send to that chat ID. Check it, and make sure you messaged the bot first." };
    }
    return { ok: false, message: "A connection test is not available for this partner yet." };
  } catch (e) {
    return { ok: false, message: `Could not reach the partner (${e instanceof Error ? e.message : "network error"}).` };
  }
}

// ---------------- OTP sending ----------------
/** Which channel sends login codes right now, or null when none is switched on. */
export async function otpChannel(env: Env): Promise<"whatsapp" | "sms" | null> {
  const wa = await loadIntegration(env, "whatsapp");
  if (wa && val(wa, "phone_number_id") && val(wa, "access_token") && val(wa, "otp_template")) return "whatsapp";
  const sms = await loadIntegration(env, "msg91");
  if (sms && val(sms, "authkey") && val(sms, "otp_template_id")) return "sms";
  return null;
}

export async function sendOtp(env: Env, phone10: string, code: string): Promise<"whatsapp" | "sms"> {
  const channel = await otpChannel(env);
  if (channel === "whatsapp") {
    const wa = (await loadIntegration(env, "whatsapp"))!;
    const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(val(wa, "phone_number_id"))}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${val(wa, "access_token")}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: `91${phone10}`, type: "template",
        template: {
          name: val(wa, "otp_template"), language: { code: val(wa, "template_lang") || "en" },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) { console.error("whatsapp otp", r.status, await r.text().catch(() => "")); throw new HttpError(502, "Could not send the WhatsApp code right now. Please try again or log in with a password."); }
    return "whatsapp";
  }
  if (channel === "sms") {
    const s = (await loadIntegration(env, "msg91"))!;
    const q = new URLSearchParams({ template_id: val(s, "otp_template_id"), mobile: `91${phone10}`, otp: code });
    const r = await fetch(`https://control.msg91.com/api/v5/otp?${q}`, { method: "POST", headers: { authkey: val(s, "authkey") }, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) { console.error("msg91 otp", r.status); throw new HttpError(502, "Could not send the SMS code right now. Please try again or log in with a password."); }
    return "sms";
  }
  throw new HttpError(503, "Login with a code is not switched on yet. Please log in with your password.");
}

// ---------------- Outgoing webhooks ----------------
export const WEBHOOK_EVENTS = [
  { id: "order.created", label: "New order placed" },
  { id: "order.updated", label: "Order status changed" },
  { id: "order.paid", label: "Order paid" },
  { id: "enquiry.created", label: "New event / bulk enquiry" },
  { id: "customer.created", label: "New customer account" },
] as const;

export function isSafeHookUrl(u: string): boolean {
  let url: URL;
  try { url = new URL(u); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const h = url.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^[0-9.]+$/.test(h) || h.includes(":")) return false;
  return true;
}

export async function newHookSecret(env: Env): Promise<{ plain: string; stored: string }> {
  const plain = `whsec_${randomHex(24)}`;
  return { plain, stored: await encryptJson(env, "webhook", { s: plain }) };
}

async function telegram(i: Integration, text: string): Promise<boolean> {
  const r = await fetch(`https://api.telegram.org/bot${encodeURIComponent(val(i, "bot_token"))}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: val(i, "chat_id"), text: text.slice(0, 3500), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return !!r?.ok;
}

/**
 * Sends `event` to every active webhook that listens for it, and (if `alert` is given) a Telegram alert
 * to the owner. Runs after the response (waitUntil), so it never slows the customer down.
 */
export function emit(ctx: Ctx, event: string, data: Record<string, unknown>, alert?: string) {
  ctx.waitUntil((async () => {
    const env = ctx.env;
    if (alert) {
      const tg = await loadIntegration(env, "telegram");
      if (tg && val(tg, "bot_token") && val(tg, "chat_id")) {
        const sent = await telegram(tg, alert);
        if (!sent) await env.DB.prepare("INSERT INTO webhook_log (direction, source, event, ok, status, detail) VALUES ('out', 'telegram', ?, 0, 0, 'Alert could not be sent')").bind(event).run();
      }
    }
    const hooks = await env.DB.prepare("SELECT id, name, url, events, secret FROM webhooks WHERE active = 1").all<{ id: number; name: string; url: string; events: string; secret: string }>();
    for (const h of hooks.results) {
      const events = h.events.split(",").map((s) => s.trim());
      if (!events.includes(event) && !events.includes("*")) continue;
      if (!isSafeHookUrl(h.url)) continue;
      let status = 0;
      let detail = "";
      try {
        const { s: secret } = await decryptJson(env, "webhook", h.secret);
        const ts = Math.floor(Date.now() / 1000).toString();
        const body = JSON.stringify({ event, created_at: new Date().toISOString(), data });
        const r = await fetch(h.url, {
          method: "POST",
          headers: {
            "content-type": "application/json", "user-agent": "InsiHouse-Webhooks/1.0", "x-insihouse-event": event,
            "x-insihouse-timestamp": ts, "x-insihouse-signature": `sha256=${await hmacHex(secret, `${ts}.${body}`)}`,
          },
          body, redirect: "manual", signal: AbortSignal.timeout(10_000),
        });
        status = r.status;
      } catch (e) {
        detail = e instanceof Error ? e.message : "failed";
      }
      await env.DB.batch([
        env.DB.prepare("UPDATE webhooks SET last_status = ?, last_at = datetime('now') WHERE id = ?").bind(status, h.id),
        env.DB.prepare("INSERT INTO webhook_log (direction, source, event, ok, status, detail) VALUES ('out', ?, ?, ?, ?, ?)")
          .bind(h.name, event, status >= 200 && status < 300 ? 1 : 0, status, detail.slice(0, 300)),
      ]);
    }
  })().catch((e) => console.error("emit", e)));
}

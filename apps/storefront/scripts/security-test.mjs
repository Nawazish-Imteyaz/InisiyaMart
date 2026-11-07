// Security attack tests (proof-of-concept for docs/security/2026-11-07-security-review.md). LOCAL TEST SERVER ONLY.
// Needs the local D1 test data described in the report (test owner/staff logins, coupons ONCE50 and LAST1). Usage: node scripts/security-test.mjs [http://localhost:8788]
import { createHmac } from "node:crypto";
const BASE = process.argv[2] || "http://localhost:8788";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error("Refusing: this harness only targets the local test server."); process.exit(1); }

const results = [];
const rec = (id, title, blocked, info = "") => { results.push({ id, title, blocked, info }); console.log(`${blocked ? "BLOCKED   " : "VULNERABLE"} ${id} ${title}${info ? `  → ${info}` : ""}`); };
let ipN = 1;
const freshIp = () => `10.9.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`;

async function call(path, { method = "GET", body, cookie = "", headers = {}, ip, raw } = {}) {
  const h = { ...headers };
  if (body !== undefined && !raw) h["content-type"] ??= "application/json";
  if (cookie) h.cookie = cookie;
  if (ip) h["cf-connecting-ip"] = ip;
  const r = await fetch(BASE + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect: "manual" });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  const sc = r.headers.get("set-cookie") ?? "";
  return { status: r.status, json, text, cookie: sc.split(";")[0], headers: r.headers };
}
const admin = (path, o = {}) => call(`/api/admin${path}`, { ...o, headers: { "x-requested-with": "insihouse", ...(o.headers ?? {}) } });

async function adminLogin(email, password) {
  const r = await admin("/login", { method: "POST", body: { email, password }, ip: email.startsWith("owner") ? "10.200.0.1" : "10.200.0.2" });
  if (r.status !== 200) throw new Error(`admin login ${email} failed: ${r.status} ${r.text}`);
  return r.cookie;
}
async function customer(phone, ip = freshIp()) {
  const r = await call("/api/account/register", { method: "POST", body: { name: "Cust " + phone, phone, password: "Customer#Pass1", consent: true }, ip });
  if (r.status !== 200) throw new Error(`register ${phone}: ${r.status} ${r.text}`);
  return r.cookie;
}
const addr = (phone) => ({ name: "Test Buyer", phone, address: "12 Test Lane", city: "Azamgarh", state: "Uttar Pradesh", pincode: "276001" });
const order = (items, extra = {}, phone = "9876500001") => ({ consent: true, customer: addr(phone), items, payment_method: "upi", ...extra });

const SLUGS = ["etched-black-pottery-vase", "black-pottery-tea-set", "pottery-diya-set"];
let OWNER = await adminLogin("owner@test.local", "OwnerPass#2026");
const STAFF = await adminLogin("staff@test.local", "StaffPass#2026");
const setStock = async (slug, stock) => {
  const list = (await admin("/products", { cookie: OWNER })).json.products;
  const p = list.find((x) => x.slug === slug);
  await admin(`/products/${p.id}`, { method: "PUT", cookie: OWNER, body: { stock, price_inr: 500, mrp_inr: 600, status: "active" } });
  return p.id;
};
const stockOf = async (slug) => (await admin("/products", { cookie: OWNER })).json.products.find((x) => x.slug === slug).stock;

// ---------------- Is the IP header honoured locally? (needed to isolate per-IP limits) ----------------
{
  const ipA = freshIp();
  for (let i = 0; i < 4; i++) await call("/api/enquiry", { method: "POST", ip: ipA, body: { consent: true, name: "x", phone: "9876543210" } });
  const r = await call("/api/enquiry", { method: "POST", ip: freshIp(), body: { consent: true, name: "x", phone: "9876543210" } });
  console.log(`(local IP spoofing for test isolation: ${r.status === 201 ? "works" : "NOT honoured, per-IP results may mix"})`);
}

// ================= PHASE 2/3: authentication & sessions =================
{
  const ip = freshIp(); let last;
  for (let i = 0; i < 10; i++) last = await admin("/login", { method: "POST", ip, body: { email: "owner@test.local", password: "wrong" + i } });
  rec("AUTH-1", "Admin login brute force from one IP is throttled", last.status === 429, `10th try → ${last.status}`);
}
{
  const a = await admin("/login", { method: "POST", ip: freshIp(), body: { email: "nobody@test.local", password: "x" } });
  const b = await admin("/login", { method: "POST", ip: freshIp(), body: { email: "owner@test.local", password: "x" } });
  rec("AUTH-2", "Admin login does not reveal which emails exist", a.text === b.text && a.status === b.status);
}
{
  const ph = "9811100001"; await customer(ph);
  const a = await call("/api/account/login", { method: "POST", ip: freshIp(), body: { phone: "9811199999", password: "x" } });
  const b = await call("/api/account/login", { method: "POST", ip: freshIp(), body: { phone: ph, password: "x" } });
  rec("AUTH-3", "Customer login does not reveal which numbers have accounts", a.text === b.text, `${a.json?.error} | ${b.json?.error}`);
}
{
  const r = await call("/api/account/register", { method: "POST", ip: freshIp(), body: { name: "x", phone: "9811100002", password: "password", consent: true } });
  rec("AUTH-4", "Very common passwords are refused", r.status === 400, `"password" → ${r.status}`);
}
{
  // Session theft → attacker turns on 2-step login with THEIR secret → the real owner is locked out.
  const stolen = await adminLogin("owner@test.local", "OwnerPass#2026");
  const s = await admin("/me/2fa/setup", { method: "POST", cookie: stolen, body: {} });
  let blocked = true, info = `setup ${s.status}`;
  if (s.status === 200) {
    const step = Math.floor(Date.now() / 30000);
    const code = totp(s.json.secret, step);
    const e = await admin("/me/2fa/enable", { method: "POST", cookie: stolen, body: { code } });
    blocked = e.status !== 200; info = `enable without password → ${e.status}`;
    if (blocked) {
      const ok = await admin("/me/2fa/enable", { method: "POST", cookie: stolen, body: { code, password: "OwnerPass#2026" } });
      info += `; with password → ${ok.status} (owner can still turn it on)`;
      if (ok.status === 200) { await new Promise((r) => setTimeout(r, 31000)); const d = await admin("/me/2fa/disable", { method: "POST", cookie: await adminLogin2fa(s.json.secret), body: { password: "OwnerPass#2026", code: totp(s.json.secret, Math.floor(Date.now() / 30000)) } }); info += ` cleanup ${d.status}`; }
    }
    if (!blocked) { // clean up so later tests can log in
      await new Promise((r) => setTimeout(r, 31000));
      const d = await admin("/me/2fa/disable", { method: "POST", cookie: stolen, body: { password: "OwnerPass#2026", code: totp(s.json.secret, Math.floor(Date.now() / 30000)) } });
      info += ` (cleanup ${d.status})`;
    }
  }
  rec("AUTH-5", "A stolen admin session cannot turn on 2-step login without the password", blocked, info);
  OWNER = await adminLogin("owner@test.local", "OwnerPass#2026");
}
{
  const sessions = (await admin("/me/sessions", { cookie: OWNER })).json?.sessions ?? [];
  const r = await admin("/logout", { method: "POST", cookie: STAFF });
  const after = await admin("/me", { cookie: STAFF });
  rec("SESS-1", "Admin logout kills the session on the server", after.status === 401);
  globalThis.STAFF2 = await adminLogin("staff@test.local", "StaffPass#2026");
  void sessions; void r;
}

{
  // Password guessing spread over many IPs (botnet) against the owner email.
  for (let i = 0; i < 25; i++) await admin("/login", { method: "POST", ip: freshIp(), body: { email: "owner@test.local", password: "guess" + i } });
  const fromNew = await admin("/login", { method: "POST", ip: freshIp(), body: { email: "owner@test.local", password: "OwnerPass#2026" } });
  const fromKnown = await admin("/login", { method: "POST", ip: "10.200.0.1", body: { email: "owner@test.local", password: "OwnerPass#2026" } });
  rec("AUTH-6", "Distributed (many-IP) guessing of the admin password is stopped, owner not locked out", fromNew.status === 429 && fromKnown.status === 200, `new device ${fromNew.status}, owner's known device ${fromKnown.status}`);
}
{
  const r = await call("/api/account/register", { method: "POST", ip: freshIp(), body: { name: "Asha", phone: "9811100055", password: "Asha#Gifts2026", consent: true } });
  const ph = await call("/api/account/register", { method: "POST", ip: freshIp(), body: { name: "x", phone: "9811100056", password: "9811100056ab", consent: true } });
  rec("FUNC-1", "Normal sign-up with a good password still works; phone-as-password refused", r.status === 200 && ph.status === 400, `${r.status}/${ph.status}`);
}

// ================= PHASE 4: access control =================
{
  const noAuth = await admin("/orders");
  rec("AC-1", "Admin API without a session", noAuth.status === 401, `${noAuth.status}`);
  const cust = await customer("9811100003");
  const c = await admin("/orders", { cookie: cust });
  rec("AC-2", "Customer session cannot call admin API", c.status === 401, `${c.status}`);
  const ownerOnly = [["/users", "GET"], ["/integrations", "GET"], ["/webhooks", "GET"], ["/activity", "GET"], ["/orders/export", "GET"], ["/coupons", "POST"], ["/settings", "PUT"]];
  const bad = [];
  for (const [p, m] of ownerOnly) { const r = await admin(p, { method: m, cookie: STAFF2, body: m === "GET" ? undefined : {} }); if (r.status !== 403) bad.push(`${m} ${p}=${r.status}`); }
  rec("AC-3", "Staff cannot use owner-only admin routes", bad.length === 0, bad.join(", "));
}
{
  const ipA = freshIp(), phA = "9822200001", phB = "9822200002";
  await setStock(SLUGS[2], 50);
  const A = await customer(phA), B = await customer(phB);
  const ob = await call("/api/order", { method: "POST", cookie: B, ip: freshIp(), body: order([{ slug: SLUGS[2], qty: 1 }], {}, phB) });
  const n = ob.json?.number;
  const t1 = await call(`/api/order/track?n=${n}`, { cookie: A, ip: ipA });
  const t2 = await call(`/api/order/track?n=${n}&phone=9999999999`, { ip: ipA });
  rec("IDOR-1", "Customer A cannot open customer B's order", t1.status === 404 && t2.status === 404, `${t1.status}/${t2.status}`);
  const addB = await call("/api/account/addresses", { method: "POST", cookie: B, body: addr(phB) });
  const id = addB.json?.id;
  const put = await call(`/api/account/addresses/${id}`, { method: "PUT", cookie: A, body: addr(phA) });
  const del = await call(`/api/account/addresses/${id}`, { method: "DELETE", cookie: A, body: {} });
  const still = (await call("/api/account/addresses", { cookie: B })).json.addresses.find((x) => x.id === id);
  rec("IDOR-2", "Customer A cannot change/delete B's address", put.status === 404 && del.status === 404 && !!still && still.phone === phB, `add ${addB.status} ${addB.json?.error ?? ""} put ${put.status} del ${del.status} still ${!!still}`);
  const pay = await call("/api/order/payment", { method: "POST", cookie: A, ip: ipA, body: { n, utr: "123456789012" } });
  rec("IDOR-3", "Customer A cannot report a payment on B's order", pay.status === 404, `${pay.status}`);
  const reg = await call("/api/account/register", { method: "POST", ip: freshIp(), body: { name: "m", phone: "9822200009", password: "Strong#Pass9", consent: true, phone_verified: 1, status: "active", id: 1 } });
  rec("MASS-1", "Register ignores extra fields (phone_verified)", reg.json?.customer?.verified === false);
}

// ================= PHASE 5: injection =================
{
  const payloads = ["' OR '1'='1", "IH1001' --", "1; DROP TABLE orders", "\" OR 1=1 --", "%' UNION SELECT pass_hash FROM admin_users --"];
  const errs = [];
  for (const p of payloads) {
    for (const r of [
      await call(`/api/order/track?n=${encodeURIComponent(p)}&phone=9876500001`, { ip: freshIp() }),
      await call("/api/order/coupon", { method: "POST", ip: freshIp(), body: { code: p, items: [{ slug: SLUGS[2], qty: 1 }] } }),
      await admin(`/orders?q=${encodeURIComponent(p)}`, { cookie: OWNER }),
      await admin(`/customers?q=${encodeURIComponent(p)}`, { cookie: OWNER }),
      await call("/api/order", { method: "POST", ip: freshIp(), body: order([{ slug: p, qty: 1 }]) }),
    ]) if (r.status >= 500 || /pass_hash|SQLITE/i.test(r.text)) errs.push(`${r.status}`);
  }
  rec("SQLI-1", "SQL injection payloads cause no SQL errors or data leaks", errs.length === 0, errs.join(","));
}
{
  const r = await call("/img/..%2f..%2fwrangler.toml"); const r2 = await call("/img/p/../../x"); const r3 = await call("/img/%2e%2e/%2e%2e/x");
  rec("PATH-1", "R2 photo route blocks path traversal", [r, r2, r3].every((x) => x.status === 404), `${r.status}/${r2.status}/${r3.status}`);
}

// ================= PHASE 6: business logic =================
{
  await setStock(SLUGS[0], 50);
  const r = await call("/api/order", { method: "POST", ip: freshIp(), body: { ...order([{ slug: SLUGS[0], qty: 1, priceInr: 1, price: 1 }]), total: 1, subtotal: 1, discount: 499, shipping: 0, payment_status: "paid" } });
  rec("PRICE-1", "Browser cannot change price/total/discount/payment status", r.json?.subtotal === 500 && r.json?.discount === 0 && r.json?.total === 580, `subtotal ${r.json?.subtotal}, total ${r.json?.total}`);
  const tr = await call(`/api/order/track?n=${r.json?.number}&phone=9876500001`, { ip: freshIp() });
  rec("PAY-1", "A new order cannot start as paid", tr.json?.order?.payment_status === "pending");
}
{
  const bad = [];
  for (const q of [-1, 0, 1.5, 1e9, "5; DROP", "NaN", null]) {
    const r = await call("/api/order", { method: "POST", ip: freshIp(), body: order([{ slug: SLUGS[0], qty: q }]) });
    if (r.status === 201 && !(q === null)) bad.push(String(q));
  }
  rec("QTY-1", "Negative / zero / decimal / huge quantities refused", bad.length === 0, bad.join(","));
}
{
  await setStock(SLUGS[1], 3);
  const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => call("/api/order", { method: "POST", ip: freshIp(), body: order([{ slug: SLUGS[1], qty: 1 }], {}, `98765${String(10000 + i).slice(1)}1`.slice(0, 10)) })));
  const ok = rs.filter((r) => r.status === 201).length;
  const left = await stockOf(SLUGS[1]);
  rec("RACE-1", "Parallel checkouts cannot oversell the last pieces", ok <= 3 && left >= 0, `${ok} orders for 3 pieces, stock now ${left}`);
}
{
  await setStock(SLUGS[2], 50);
  const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => call("/api/order", { method: "POST", ip: freshIp(), body: order([{ slug: SLUGS[2], qty: 1 }], { coupon: "LAST1" }, `97000000${10 + i}`) })));
  const ok = rs.filter((r) => r.status === 201).length;
  rec("RACE-2", "A 1-use coupon cannot be used twice in parallel", ok <= 1, `${ok} orders got LAST1`);
}
{
  const C = await customer("9833300001");
  const rs = await Promise.all(Array.from({ length: 5 }, () => call("/api/order", { method: "POST", cookie: C, ip: freshIp(), body: order([{ slug: SLUGS[2], qty: 1 }], { coupon: "ONCE50" }, "9833300001") })));
  const ok = rs.filter((r) => r.status === 201).length;
  rec("RACE-3", "A once-per-customer coupon cannot be used twice in parallel", ok <= 1, `${ok} orders got ONCE50`);
}
{
  // One attacker, one IP, fake orders → holds ALL stock of a product for 48 h (no payment needed).
  await setStock(SLUGS[1], 10);
  const ip = freshIp(); let held = 0;
  for (let i = 0; i < 5; i++) {
    const r = await call("/api/order", { method: "POST", ip, body: order([{ slug: SLUGS[1], qty: 2 }], {}, `96000000${10 + i}`) });
    if (r.status === 201) held += 2;
  }
  const left = await stockOf(SLUGS[1]);
  const real = await call("/api/order", { method: "POST", ip: freshIp(), body: order([{ slug: SLUGS[1], qty: 1 }], {}, "9600099999") });
  rec("HOLD-1", "One visitor cannot lock up all stock with unpaid orders", left > 0 && real.status === 201, `attacker held ${held}, stock left ${left}, real buyer → ${real.status}`);
}
{
  const ip = freshIp(); let last;
  for (let i = 0; i < 22; i++) last = await call(`/api/order/track?n=IH1001&phone=90000000${String(i).padStart(2, "0")}`, { ip });
  rec("TRACK-1", "Order lookup (phone guessing) is rate-limited", last.status === 429, `22nd → ${last.status}`);
}

// ================= PHASE 6: payment webhooks =================
{
  const WH = "test_webhook_secret_123";
  const setRz = await admin("/integrations/razorpay", { method: "PUT", cookie: OWNER, body: { enabled: true, mode: "test", password: "OwnerPass#2026", config: { key_id: "rzp_test_x" }, secrets: { key_secret: "ks", webhook_secret: WH } } });
  await setStock(SLUGS[0], 50);
  const o = await call("/api/order", { method: "POST", ip: freshIp(), body: order([{ slug: SLUGS[0], qty: 1 }], {}, "9844400001") });
  const num = o.json?.number;
  const evt = (amount, currency = "INR", id = "pay_" + Math.random().toString(36).slice(2)) => JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id, amount, currency, notes: { order_number: num } } } } });
  const send = (body, sig, eid) => call("/api/hooks/razorpay", { method: "POST", raw: body, headers: { "content-type": "application/json", "x-razorpay-signature": sig, ...(eid ? { "x-razorpay-event-id": eid } : {}) } });
  const status = async () => (await call(`/api/order/track?n=${num}&phone=9844400001`, { ip: freshIp() })).json?.order?.payment_status;
  const f1 = await send(evt(58000), "deadbeef");
  const f2 = await send(evt(58000), "");
  rec("HOOK-1", "Fake Razorpay 'payment captured' (bad/no signature) is refused", f1.status === 401 && f2.status === 401 && (await status()) === "pending", `${f1.status}/${f2.status}`);
  const low = evt(100); await send(low, createHmac("sha256", WH).update(low).digest("hex"));
  const usd = evt(58000, "USD"); await send(usd, createHmac("sha256", WH).update(usd).digest("hex"));
  rec("HOOK-2", "Signed webhook with too-small amount or wrong currency does not mark paid", (await status()) === "pending");
  const sh = await call("/api/hooks/courier", { method: "POST", body: { order_id: num, current_status: "CANCELED" }, headers: { "x-api-key": "guess" } });
  rec("HOOK-3", "Fake courier webhook is refused", sh.status === 401 || sh.status === 404, `${sh.status}`);
  setRz.status;
}

// ================= PHASE 7: CSRF / CORS =================
{
  const a = await call("/api/order", { method: "POST", raw: JSON.stringify(order([{ slug: SLUGS[0], qty: 1 }])), headers: { "content-type": "text/plain" }, ip: freshIp() });
  const b = await call("/api/order", { method: "POST", body: order([{ slug: SLUGS[0], qty: 1 }]), headers: { origin: "https://evil.example" }, ip: freshIp() });
  const C = await customer("9855500001");
  const c = await call("/api/account/profile", { method: "PUT", cookie: C, raw: "name=x", headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://evil.example" } });
  const d = await call("/api/admin/users", { method: "POST", cookie: OWNER, body: { email: "x@y.z" } });
  const e = await admin("/settings", { method: "PUT", cookie: OWNER, body: { announcement: "x" }, headers: { origin: "https://evil.example" } });
  rec("CSRF-1", "Cross-site form/text posts are refused (store + admin)", [a, b, c, d, e].every((r) => r.status === 403 || r.status === 415), [a, b, c, d, e].map((r) => r.status).join("/"));
  const cors = await call("/api/account", { headers: { origin: "https://evil.example" } });
  rec("CORS-1", "API never allows other websites to read responses", !cors.headers.get("access-control-allow-origin"));
}

// ================= PHASE 8: uploads =================
{
  const pid = await setStock(SLUGS[0], 50);
  const up = async (bytes, type, name) => { const fd = new FormData(); fd.append("file", new Blob([bytes], { type }), name); const r = await fetch(`${BASE}/api/admin/products/${pid}/images`, { method: "POST", body: fd, headers: { cookie: OWNER, "x-requested-with": "insihouse" } }); return r.status; };
  const svg = await up(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), "image/svg+xml", "x.svg");
  const htmlAsPng = await up(Buffer.from("<html><script>alert(1)</script></html>"), "image/png", "x.png");
  rec("UPLOAD-1", "SVG / HTML disguised as image are refused", svg === 400 && htmlAsPng === 400, `${svg}/${htmlAsPng}`);
}

// ================= PHASE 11: abuse =================
{
  const big = "x".repeat(2_000_000);
  const r = await call("/api/order", { method: "POST", ip: freshIp(), body: order([{ slug: SLUGS[0], qty: 1 }], { notes: big }) });
  const nest = "[".repeat(5000) + "]".repeat(5000);
  const r2 = await call("/api/order", { method: "POST", ip: freshIp(), raw: `{"items":${nest}}`, headers: { "content-type": "application/json" } });
  rec("ABUSE-1", "Huge strings / deeply nested JSON are refused without a crash", r.status === 400 && r2.status < 500, `${r.status}/${r2.status}`);
}

const vuln = results.filter((r) => !r.blocked);
console.log(`\n${results.length} tests: ${results.length - vuln.length} blocked, ${vuln.length} vulnerable${vuln.length ? `: ${vuln.map((v) => v.id).join(", ")}` : ""}`);

async function adminLogin2fa(secret) {
  const r = await admin("/login", { method: "POST", ip: "10.200.0.1", body: { email: "owner@test.local", password: "OwnerPass#2026", code: totp(secret, Math.floor(Date.now() / 30000)) } });
  return r.cookie;
}
function totp(secret, step) {
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, val = 0; const out = [];
  for (const ch of secret) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", Buffer.from(out)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, "0");
}

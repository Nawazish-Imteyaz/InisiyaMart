// Marketplace phase 1 tests (decision 010): seller journey + seller-isolation attacks. LOCAL TEST SERVER ONLY.
// Needs local D1 with migrations 0001–0004 and the test admins owner@test.local / staff@test.local (see docs/security report).
// Usage: node scripts/marketplace-test.mjs [http://localhost:8788]
const BASE = process.argv[2] || "http://localhost:8788";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error("Refusing: local test server only."); process.exit(1); }

const results = [];
const check = (id, title, ok, info = "") => { results.push({ id, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${title}${info ? `  → ${info}` : ""}`); };
let n = 0;
const ip = () => `10.60.${Math.floor(n / 250)}.${(n++ % 250) + 1}`;
const RUN = String(Date.now()).slice(-6);
const phone = (k) => `9${String(k).padStart(3, "0")}${RUN}`.slice(0, 10);

async function call(path, { method = "GET", body, cookie, headers = {}, form, app = false } = {}) {
  const h = { "cf-connecting-ip": ip(), ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  if (cookie) h.cookie = cookie;
  if (app) h["x-requested-with"] = "insihouse";
  const r = await fetch(BASE + path, { method, headers: h, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect: "manual" });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: r.status, json, text, cookie: (r.headers.get("set-cookie") ?? "").split(";")[0], headers: r.headers };
}
const seller = (path, o = {}) => call(`/api/seller${path ? `/${path}` : ""}`, { ...o, app: true });
const admin = (path, o = {}) => call(`/api/admin/${path}`, { ...o, headers: { "x-requested-with": "insihouse", ...(o.headers ?? {}) } });
async function adminLogin(email, password, knownIp) {
  const r = await call("/api/admin/login", { method: "POST", body: { email, password }, headers: { "x-requested-with": "insihouse", "cf-connecting-ip": knownIp } });
  if (r.status !== 200) throw new Error(`admin login ${email}: ${r.status} ${r.text}`);
  return r.cookie;
}
async function customer(k, name) {
  const r = await call("/api/account/register", { method: "POST", body: { name, phone: phone(k), password: "Maker#Pass2026", consent: true } });
  if (r.status !== 200) throw new Error(`register: ${r.status} ${r.text}`);
  return r.cookie;
}
// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const photoForm = () => { const fd = new FormData(); fd.append("file", new Blob([PNG], { type: "image/png" }), "p.png"); return fd; };

const OWNER = await adminLogin("owner@test.local", "OwnerPass#2026", "10.200.0.1");
const STAFF = await adminLogin("staff@test.local", "StaffPass#2026", "10.200.0.2");
const cats = (await admin("categories", { cookie: OWNER })).json.categories;
const catId = cats.find((c) => c.slug !== "other").id;
const otherId = cats.find((c) => c.slug === "other").id;

// ================= Seller journey =================
const A = await customer(1, "Rehana Test");
const SECRET_ADDR = `House ${RUN}, Secret Lane`;
let r = await seller("shop", { method: "PUT", cookie: A, body: { shop_name: `Rehana Stitches ${RUN}`, maker_name: "Rehana", craft: "embroidery", story: "I embroider at home.", district: "Azamgarh", state: "Uttar Pradesh", full_name: "Rehana Khatoon", address: SECRET_ADDR, pincode: "276001" } });
check("J-1", "Customer can create a shop", r.status === 201, `${r.status} ${r.json?.error ?? ""}`);
const slugA = r.json?.slug;
r = await seller("products", { method: "POST", cookie: A, body: { name: "Hand embroidered cushion", category_id: catId, summary: "Cotton cushion cover with hand chikankari.", price_inr: 650, stock: 4, made_by: "me", technique: "chikankari", materials: "cotton" } });
check("J-2", "Seller can add a product (goes to review)", r.status === 201 && r.json?.review_status === "pending", `${r.status} ${r.json?.review_status ?? r.json?.error}`);
const pA = r.json?.id, pSlugA = r.json?.slug;
r = await seller(`products/${pA}/images`, { method: "POST", cookie: A, form: photoForm() });
check("J-3", "Seller can upload a product photo", r.status === 201, `${r.status} ${r.json?.error ?? ""}`);
const imgA = r.json?.id;
r = await seller("submit", { method: "POST", cookie: A, body: { undertaking: true } });
check("J-4", "Submit is refused without a UPI ID", r.status === 400, r.json?.error);
await seller("shop", { method: "PUT", cookie: A, body: { upi_id: "rehana.stitch@okaxis" } });
r = await seller("submit", { method: "POST", cookie: A, body: {} });
check("J-5", "Submit is refused without the handmade promise", r.status === 400);
r = await seller("submit", { method: "POST", cookie: A, body: { undertaking: true } });
const ov = (await seller("", { cookie: A })).json;
check("J-6", "Shop sent for approval", r.status === 200 && ov?.seller?.status === "pending" && ov.step === 6, ov?.seller?.status);

// Not visible before approval
const inCat = async (s) => (await call("/api/catalog")).json.products.some((p) => p.slug === s);
r = await call(`/api/products/${pSlugA}`);
check("V-1", "Product of an unapproved shop is not visible to buyers", !(await inCat(pSlugA)) && r.status === 404 && (await call(`/api/makers/${slugA}`)).status === 404);
r = await call("/api/order", { method: "POST", body: { consent: true, customer: { name: "B", phone: "9876500999", address: "x", city: "y", state: "Uttar Pradesh", pincode: "276001" }, items: [{ slug: pSlugA, qty: 1 }], payment_method: "upi" } });
check("V-2", "Unapproved product cannot be ordered", r.status === 409, r.json?.error);

// Admin approves
r = await admin("sellers?status=pending", { cookie: OWNER });
const sA = r.json.sellers.find((s) => s.slug === slugA);
check("A-1", "Admin sees the waiting shop with private name and phone", !!sA && sA.full_name === "Rehana Khatoon" && !!sA.phone);
r = await admin(`sellers/${sA.id}`, { method: "PUT", cookie: STAFF, body: { action: "reject", review_note: "no" } });
check("A-2", "Staff cannot reject a shop (owner only)", r.status === 403);
r = await admin(`sellers/${sA.id}`, { method: "PUT", cookie: OWNER, body: { action: "approve", with_products: true } });
check("A-3", "Owner approves shop + products", r.status === 200);
check("V-3", "Approved product appears live (no rebuild)", await inCat(pSlugA));
r = await call(`/api/products/${pSlugA}`);
const pub = JSON.stringify(r.json);
check("V-4", "Product page shows maker card", r.status === 200 && r.json?.product?.maker?.shop?.startsWith("Rehana Stitches") && r.json.product.technique === "chikankari");
const makerPage = await call(`/api/makers/${slugA}`);
const allPublic = pub + makerPage.text + (await call("/api/catalog")).text;
const leaked = ["Rehana Khatoon", SECRET_ADDR, "rehana.stitch@okaxis", phone(1)].filter((x) => allPublic.includes(x));
check("PRIV-1", "Public APIs never leak full name, address, UPI ID or phone", leaked.length === 0, leaked.join(", "));
r = await call("/api/order", { method: "POST", body: { consent: true, customer: { name: "B", phone: "9876500998", address: "x", city: "y", state: "Uttar Pradesh", pincode: "276001" }, items: [{ slug: pSlugA, qty: 1 }], payment_method: "upi" } });
check("V-5", "Maker products cannot be paid to Insi House yet (phase 2)", r.status === 409 && /maker/.test(r.json?.error ?? ""), r.json?.error);
const html = await call(`/product/?s=${pSlugA}`);
check("V-6", "Product page HTML has the product title for Google/WhatsApp", html.status === 200 && html.text.includes("Hand embroidered cushion"));
const old = await call(`/product/${pSlugA}/`);
check("V-7", "Old /product/<slug>/ links redirect", old.status === 301 && (old.headers.get("location") ?? "").includes(`/product/?s=${pSlugA}`), `${old.status} ${old.headers.get("location")}`);

// Edits by a new (untrusted) seller go back to review; price/stock edits don't
r = await seller(`products/${pA}`, { method: "PUT", cookie: A, body: { stock: 9 } });
let st = (await seller("products", { cookie: A })).json.products.find((p) => p.id === pA);
check("J-7", "Stock change keeps the product live", st.review_status === "approved" && st.stock === 9);
await seller(`products/${pA}`, { method: "PUT", cookie: A, body: { name: "Hand embroidered cushion cover" } });
st = (await seller("products", { cookie: A })).json.products.find((p) => p.id === pA);
check("J-8", "Name change by a new seller goes back to review", st.review_status === "pending");
await admin(`review/${pA}`, { method: "PUT", cookie: OWNER, body: { action: "approve" } });

// ================= Category request =================
const B = await customer(2, "Sunita Test");
r = await seller("shop", { method: "PUT", cookie: B, body: { shop_name: `Sunita Crochet ${RUN}`, maker_name: "Sunita", district: "Jaipur", state: "Rajasthan", full_name: "Sunita Devi", address: "Plot 9", pincode: "302001", upi_id: "sunita.c@ybl" } });
r = await seller("products", { method: "POST", cookie: B, body: { name: "Crochet bunny toy", category_id: otherId, requested_category: `Crochet toys ${RUN}`, summary: "Soft crochet bunny made with cotton yarn.", price_inr: 399, stock: 2 } });
const pB = r.json?.id;
const reqs = (await admin("category-requests", { cookie: OWNER })).json.requests;
const myReq = reqs.find((x) => x.name === `Crochet toys ${RUN}`);
check("C-1", "Choosing 'Other' + a name creates a category request", !!myReq && myReq.status === "pending");
r = await admin(`category-requests/${myReq.id}`, { method: "PUT", cookie: OWNER, body: { action: "approve" } });
const moved = (await seller(`products/${pB}`, { cookie: B })).json.product;
check("C-2", "Approving the request creates the category and moves the product", r.status === 200 && moved.category_id === r.json.category_id && moved.requested_category === "");

// ================= Seller isolation attacks =================
const iso = [];
for (const [m, path, body] of [["GET", `products/${pA}`], ["PUT", `products/${pA}`, { price_inr: 1, name: "hacked" }], ["DELETE", `products/${pA}`], ["PUT", `products/${pA}/images`, { order: [imgA] }], ["DELETE", `products/${pA}/images/${imgA}`]]) {
  const x = await seller(path, { method: m, cookie: B, body: m === "GET" || m === "DELETE" ? (m === "DELETE" ? {} : undefined) : body });
  if (x.status !== 404) iso.push(`${m} ${path} → ${x.status}`);
}
const up = await seller(`products/${pA}/images`, { method: "POST", cookie: B, form: photoForm() });
if (up.status !== 404) iso.push(`POST image on A's product → ${up.status}`);
const crossImg = await seller(`products/${pB}/images/${imgA}`, { method: "DELETE", cookie: B, body: {} });
if (crossImg.status !== 404) iso.push(`DELETE A's photo via own product → ${crossImg.status}`);
const aStill = (await seller(`products/${pA}`, { cookie: A })).json;
check("ISO-1", "Seller B cannot read, change or delete seller A's product or photos", iso.length === 0 && aStill.product?.price_inr === 650 && aStill.images?.length === 1, iso.join("; "));
const bList = (await seller("products", { cookie: B })).json.products;
check("ISO-2", "Seller B's product list contains only B's products", bList.length === 1 && bList[0].id === pB);
r = await seller("products", { method: "POST", cookie: B, body: { name: "Sneaky", category_id: catId, summary: "trying to post as another seller", price_inr: 10, stock: 1, seller_id: sA.id, review_status: "approved", status: "active" } });
const sneaky = (await seller(`products/${r.json?.id}`, { cookie: B })).json?.product;
const aList = (await seller("products", { cookie: A })).json.products;
check("ISO-3", "Mass assignment: seller_id / review_status in the request are ignored", sneaky?.review_status === "pending" && !aList.some((p) => p.name === "Sneaky"));
await seller("shop", { method: "PUT", cookie: B, body: { status: "approved", id: sA.id, customer_id: 1, slug: slugA } });
const bShop = (await seller("", { cookie: B })).json.seller;
check("ISO-4", "Seller cannot approve their own shop or take another shop's id/address", bShop.status === "draft" && bShop.id !== sA.id && bShop.slug !== slugA, `${bShop.status} ${bShop.slug}`);
const actB = (await seller("activity", { cookie: B })).json.activity;
check("ISO-5", "Activity log shows only the seller's own events", !actB.some((a) => /Rehana/.test(a.detail)));

// ================= Access & CSRF =================
r = await call("/api/seller/products", { method: "POST", cookie: A, body: { name: "x" } });
check("SEC-1", "Seller writes without our app header are blocked (CSRF)", r.status === 403);
r = await call("/api/seller/products", { method: "POST", cookie: A, body: { name: "x" }, app: true, headers: { origin: "https://evil.example" } });
check("SEC-2", "Seller writes from another website are blocked", r.status === 403);
r = await seller("", {});
check("SEC-3", "Seller API needs a login", r.status === 401);
const C = await customer(3, "Plain Buyer");
r = await seller("products", { cookie: C });
check("SEC-4", "A buyer without a shop cannot use seller product routes", r.status === 404);
r = await admin("sellers", { cookie: A });
check("SEC-5", "Seller cannot use the admin API", r.status === 401);
r = await seller("shop/photo", { method: "POST", cookie: A, form: (() => { const fd = new FormData(); fd.append("file", new Blob(["<svg onload=alert(1)>"], { type: "image/png" }), "x.png"); return fd; })() });
check("SEC-6", "Fake image (SVG/HTML) upload refused", r.status === 400);

// XSS in public text → escaped in HTML meta, plain text in JSON
await seller("shop", { method: "PUT", cookie: A, body: { story: `"><script>alert(1)</script>` } });
const mh = await call(`/maker/?s=${slugA}`);
check("XSS-1", "Shop story with <script> is escaped in the page HTML", mh.status === 200 && !mh.text.includes("<script>alert(1)</script>"));

// Suspend
await admin(`sellers/${sA.id}`, { method: "PUT", cookie: OWNER, body: { action: "suspend" } });
r = await seller("products", { method: "POST", cookie: A, body: { name: "After pause", category_id: catId, summary: "should be blocked now", price_inr: 100, stock: 1 } });
check("SUS-1", "Paused seller cannot add products and their products disappear", r.status === 403 && !(await inCat(pSlugA)));
await admin(`sellers/${sA.id}`, { method: "PUT", cookie: OWNER, body: { action: "reactivate" } });
check("SUS-2", "Re-opened shop's products come back", await inCat(pSlugA));

// House shop still sells normally
const house = (await call("/api/catalog")).json.products.find((p) => p.maker?.slug === "insi-house-originals" && p.inStock && p.priceInr);
if (house) {
  r = await call("/api/order", { method: "POST", body: { consent: true, customer: { name: "Buyer", phone: phone(9), address: "12 Lane", city: "Lucknow", state: "Uttar Pradesh", pincode: "226001" }, items: [{ slug: house.slug, qty: 1 }], payment_method: "upi" } });
  check("FUNC-1", "Insi House Originals products can still be ordered", r.status === 201, `${r.status} ${r.json?.error ?? r.json?.number}`);
}

const fails = results.filter((x) => !x.ok);
console.log(`\n${results.length} checks: ${results.length - fails.length} passed, ${fails.length} failed${fails.length ? `: ${fails.map((f) => f.id).join(", ")}` : ""}`);
process.exit(fails.length ? 1 : 0);

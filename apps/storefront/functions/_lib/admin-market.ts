// Admin console: marketplace sellers, product checks and category requests (decision 010).
import { contentChanged, idParam, log, requireOwner, uniqueSlug, type User } from "./admin-core";
import { sellerLog, type SellerRow } from "./market";
import { HttpError, int, json, oneOf, readJson, str, type Ctx } from "./util";

const SELLER_ACTIONS = ["approve", "changes", "reject", "suspend", "reactivate"] as const;

export async function sellers(ctx: Ctx, user: User, m: string, b?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  if (!b && m === "GET") {
    const st = new URL(req.url).searchParams.get("status") ?? "";
    const where = ["draft", "pending", "approved", "changes", "rejected", "suspended"].includes(st) ? "WHERE s.status = ?" : "";
    const r = await db.prepare(`SELECT s.id, s.slug, s.shop_name, s.maker_name, s.full_name, s.district, s.state, s.status, s.gst_type, s.photo_key,
          s.submitted_at, s.approved_at, s.created_at, c.phone,
          (SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id) AS products,
          (SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id AND p.review_status = 'pending') AS to_check
        FROM sellers s LEFT JOIN customers c ON c.id = s.customer_id ${where}
        ORDER BY CASE s.status WHEN 'pending' THEN 0 WHEN 'changes' THEN 1 ELSE 2 END, s.id DESC LIMIT 500`).bind(...(where ? [st] : [])).all();
    const counts = await db.prepare(`SELECT SUM(status = 'pending') AS pending, SUM(status = 'approved') AS approved, SUM(status = 'draft') AS draft,
          (SELECT COUNT(*) FROM products WHERE review_status = 'pending') AS products_to_check,
          (SELECT COUNT(*) FROM category_requests WHERE status = 'pending') AS category_requests FROM sellers`).first();
    return json({ sellers: r.results, counts });
  }
  const id = idParam(b, "Seller");
  const s = await db.prepare("SELECT s.*, c.phone AS login_phone FROM sellers s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?").bind(id).first<SellerRow & { login_phone: string | null }>();
  if (!s) throw new HttpError(404, "Seller not found");

  if (m === "GET") {
    const [prods, acts, reqs] = await db.batch([
      db.prepare(`SELECT p.id, p.slug, p.name, p.price_inr, p.stock, p.status, p.review_status, p.review_note, c.name AS category_name,
                  (SELECT key FROM product_images i WHERE i.product_id = p.id ORDER BY sort, id LIMIT 1) AS image_key
                  FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.seller_id = ? ORDER BY p.id DESC LIMIT 300`).bind(id),
      db.prepare("SELECT actor, action, detail, created_at FROM seller_activity WHERE seller_id = ? ORDER BY id DESC LIMIT 200").bind(id),
      db.prepare("SELECT id, name, status, created_at FROM category_requests WHERE seller_id = ? ORDER BY id DESC LIMIT 50").bind(id),
    ]);
    return json({ seller: { ...s, photo: s.photo_key ? `/img/${s.photo_key}` : null }, products: prods.results, activity: acts.results, requests: reqs.results });
  }

  if (m === "PUT") {
    const body = await readJson(req);
    const stmts = [];
    const notes: string[] = [];
    if (body.admin_note !== undefined) stmts.push(db.prepare("UPDATE sellers SET admin_note = ? WHERE id = ?").bind(str(body.admin_note, 1000, "Note"), id));
    if (body.action !== undefined) {
      if (id === 1) throw new HttpError(400, "The Insi House Originals shop is always open");
      const action = oneOf(body.action, SELLER_ACTIONS, "Action");
      if (action === "reject" || action === "suspend") requireOwner(user);
      const message = str(body.review_note, 500, "Message to the seller");
      if ((action === "changes" || action === "reject") && !message) throw new HttpError(400, "Write a short message so the seller knows what to fix");
      const next = { approve: "approved", changes: "changes", reject: "rejected", suspend: "suspended", reactivate: "approved" }[action];
      stmts.push(db.prepare(`UPDATE sellers SET status = ?, review_note = ?, ${next === "approved" ? "approved_at = COALESCE(approved_at, datetime('now')), " : ""}updated_at = datetime('now') WHERE id = ?`)
        .bind(next, message, id));
      // "Approve shop + its first products" in one click.
      if (action === "approve" && body.with_products === true) {
        stmts.push(db.prepare("UPDATE products SET review_status = 'approved', review_note = '' WHERE seller_id = ? AND review_status = 'pending'").bind(id));
      }
      notes.push(`${s.status} → ${next}`);
    }
    if (stmts.length) {
      await db.batch(stmts);
      const who = `admin:${user.name || user.email}`;
      if (notes.length) await sellerLog(db, id, who, "Shop status changed", `${notes.join(", ")}${body.review_note ? `: ${String(body.review_note).slice(0, 200)}` : ""}`);
      await log(db, user, "Updated seller", `${s.shop_name}${notes.length ? ` (${notes.join(", ")})` : ""}`);
      if (notes.length) await contentChanged(ctx, user);
    }
    return json({ ok: true });
  }
  throw new HttpError(405, "Not allowed");
}

/** Products waiting for a check (new sellers' first products, and fixes after "changes needed"). */
export async function review(ctx: Ctx, user: User, m: string, b?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  if (!b && m === "GET") {
    const r = await db.prepare(`SELECT p.id, p.slug, p.name, p.summary, p.details, p.price_inr, p.mrp_inr, p.stock, p.made_by, p.technique, p.materials,
          p.made_to_order_days, p.requested_category, p.updated_at, c.name AS category_name, s.id AS seller_id, s.shop_name, s.status AS seller_status
        FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN sellers s ON s.id = p.seller_id
        WHERE p.review_status = 'pending' ORDER BY p.updated_at LIMIT 200`).all<{ id: number } & Record<string, unknown>>();
    const ids = r.results.map((p) => p.id);
    const images = new Map<number, string[]>();
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      const x = await db.prepare(`SELECT product_id, key FROM product_images WHERE product_id IN (${chunk.map(() => "?").join(",")}) ORDER BY sort, id`).bind(...chunk).all<{ product_id: number; key: string }>();
      for (const im of x.results) { const l = images.get(im.product_id) ?? []; l.push(`/img/${im.key}`); images.set(im.product_id, l); }
    }
    return json({ products: r.results.map((p) => ({ ...p, images: images.get(p.id) ?? [] })) });
  }
  const id = idParam(b, "Product");
  if (m !== "PUT") throw new HttpError(405, "Not allowed");
  const p = await db.prepare("SELECT id, name, seller_id FROM products WHERE id = ?").bind(id).first<{ id: number; name: string; seller_id: number | null }>();
  if (!p) throw new HttpError(404, "Product not found");
  const body = await readJson(req);
  const action = oneOf(body.action, ["approve", "changes", "reject"] as const, "Action");
  const note = str(body.note, 500, "Message to the seller");
  if (action !== "approve" && !note) throw new HttpError(400, "Write a short message so the seller knows what to fix");
  const next = { approve: "approved", changes: "changes", reject: "rejected" }[action];
  await db.prepare("UPDATE products SET review_status = ?, review_note = ?, updated_at = datetime('now') WHERE id = ?").bind(next, note, id).run();
  if (p.seller_id) await sellerLog(db, p.seller_id, `admin:${user.name || user.email}`, `Product ${next}`, `${p.name}${note ? `: ${note}` : ""}`);
  await log(db, user, "Checked product", `${p.name} → ${next}`);
  if (action === "approve") await contentChanged(ctx, user);
  return json({ ok: true });
}

/** Sellers' requests for a new category: approve (new category), merge (into an existing one) or reject. */
export async function categoryRequests(ctx: Ctx, user: User, m: string, b?: string): Promise<Response> {
  const { env, request: req } = ctx;
  const db = env.DB;
  if (!b && m === "GET") {
    const r = await db.prepare(`SELECT r.id, r.name, r.note, r.status, r.admin_note, r.created_at, r.product_id, p.name AS product_name, s.id AS seller_id, s.shop_name,
          (SELECT COUNT(*) FROM category_requests x WHERE x.status = 'pending' AND lower(x.name) = lower(r.name)) AS same_asks
        FROM category_requests r LEFT JOIN products p ON p.id = r.product_id LEFT JOIN sellers s ON s.id = r.seller_id
        ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.id DESC LIMIT 300`).all();
    return json({ requests: r.results });
  }
  const id = idParam(b, "Request");
  if (m !== "PUT") throw new HttpError(405, "Not allowed");
  const r = await db.prepare("SELECT * FROM category_requests WHERE id = ?").bind(id).first<{ id: number; name: string; seller_id: number; product_id: number | null; status: string }>();
  if (!r) throw new HttpError(404, "Request not found");
  if (r.status !== "pending") throw new HttpError(400, "This request was already answered");
  const body = await readJson(req);
  const action = oneOf(body.action, ["approve", "merge", "reject"] as const, "Action");
  const note = str(body.note, 300, "Message to the seller");
  let categoryId: number | null = null;
  if (action === "approve") {
    const name = str(body.name ?? r.name, 60, "Category name", true);
    const slug = await uniqueSlug(db, "categories", name);
    const parent = int(body.parent_id, "Parent category", { min: 1, nullable: true });
    const c = await db.prepare("INSERT INTO categories (slug, name, sub, art, color, sort, visible, parent_id) VALUES (?, ?, '', 'gift', 'rose', 500, 1, ?)").bind(slug, name, parent).run();
    categoryId = c.meta.last_row_id as number;
  } else if (action === "merge") {
    categoryId = int(body.category_id, "Category", { min: 1 }) as number;
    if (!(await db.prepare("SELECT id FROM categories WHERE id = ?").bind(categoryId).first())) throw new HttpError(400, "That category does not exist");
  }
  // Every open request with the same name is answered together, and their products move to the category.
  const same = await db.prepare("SELECT id, seller_id, product_id FROM category_requests WHERE status = 'pending' AND lower(name) = lower(?)").bind(r.name).all<{ id: number; seller_id: number; product_id: number | null }>();
  const stmts = [];
  for (const x of same.results) {
    stmts.push(db.prepare("UPDATE category_requests SET status = ?, category_id = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(action === "reject" ? "rejected" : "approved", categoryId, note, x.id));
    if (categoryId && x.product_id) stmts.push(db.prepare("UPDATE products SET category_id = ?, requested_category = '' WHERE id = ? AND seller_id = ?").bind(categoryId, x.product_id, x.seller_id));
  }
  await db.batch(stmts);
  for (const x of same.results) await sellerLog(db, x.seller_id, `admin:${user.name || user.email}`, `Category request ${action === "reject" ? "not accepted" : "accepted"}`, `${r.name}${note ? `: ${note}` : ""}`);
  await log(db, user, "Answered category request", `${r.name} → ${action}`);
  if (categoryId) await contentChanged(ctx, user);
  return json({ ok: true, category_id: categoryId });
}

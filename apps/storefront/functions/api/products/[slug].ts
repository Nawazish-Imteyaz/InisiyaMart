// GET /api/products/<slug> — one product (live) + "more from this maker", "same craft, other makers", "same district".
import { publicProducts } from "../../_lib/market";
import { json, type Ctx } from "../../_lib/util";

export const onRequestGet = async ({ env, params }: Ctx): Promise<Response> => {
  const slug = String(params.slug ?? "");
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return json({ error: "Product not found" }, 404);
  const db = env.DB;
  const [p] = await publicProducts(db, "p.slug = ?", [slug], 1);
  if (!p) return json({ error: "This product is not available" }, 404);
  const row = await db.prepare("SELECT p.id, p.seller_id, p.category_id, s.district, s.state FROM products p LEFT JOIN sellers s ON s.id = p.seller_id WHERE p.slug = ?")
    .bind(slug).first<{ id: number; seller_id: number | null; category_id: number | null; district: string; state: string }>();
  const [fromMaker, sameCraft, sameDistrict] = await Promise.all([
    row?.seller_id ? publicProducts(db, "p.seller_id = ? AND p.id != ?", [row.seller_id, row.id], 8) : [],
    row?.category_id ? publicProducts(db, "p.category_id = ? AND p.id != ? AND COALESCE(p.seller_id, 0) != ?", [row.category_id, row.id, row.seller_id ?? 0], 8, "RANDOM()") : [],
    row?.district ? publicProducts(db, "s.district = ? AND s.state = ? AND COALESCE(p.seller_id, 0) != ?", [row.district, row.state, row.seller_id ?? 0], 8, "RANDOM()") : [],
  ]);
  return json({ product: p, fromMaker, sameCraft, sameDistrict }, 200, { "cache-control": "public, max-age=30" });
};

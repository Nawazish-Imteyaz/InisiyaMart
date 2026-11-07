// GET /api/makers/<slug> — a maker's public shop page: public card + story + their products. Never private details.
import { makerCard, publicProducts, type SellerRow } from "../../_lib/market";
import { json, type Ctx } from "../../_lib/util";

export const onRequestGet = async ({ env, params }: Ctx): Promise<Response> => {
  const slug = String(params.slug ?? "");
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return json({ error: "Shop not found" }, 404);
  const s = await env.DB.prepare("SELECT * FROM sellers WHERE slug = ? AND status = 'approved'").bind(slug).first<SellerRow>();
  if (!s) return json({ error: "This shop is not open" }, 404);
  const products = await publicProducts(env.DB, "p.seller_id = ?", [s.id], 300);
  return json({ maker: { ...makerCard(s), story: s.story, since: s.created_at.slice(0, 10), holiday: !!s.holiday, dispatchDays: s.dispatch_days }, products },
    200, { "cache-control": "public, max-age=30" });
};

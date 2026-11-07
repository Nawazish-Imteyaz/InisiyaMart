// GET /product/?s=<slug> → the product page shell with this product's title/description for Google & link previews.
import { shellWithMeta } from "../_lib/meta";
import { publicProducts } from "../_lib/market";
import type { Ctx } from "../_lib/util";

export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const slug = new URL(ctx.request.url).searchParams.get("s") ?? "";
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return shellWithMeta(ctx, "/product/", null);
  const [p] = await publicProducts(ctx.env.DB, "p.slug = ?", [slug], 1).catch(() => []);
  return shellWithMeta(ctx, "/product/", p ? { title: p.name, description: p.summary || `Handmade ${p.craft}`, image: p.images[0] } : null);
};

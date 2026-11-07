// GET /maker/?s=<shop-slug> → the maker page shell with the shop's title/story for Google & link previews.
import { shellWithMeta } from "../_lib/meta";
import type { Ctx } from "../_lib/util";

export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const slug = new URL(ctx.request.url).searchParams.get("s") ?? "";
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return shellWithMeta(ctx, "/maker/", null);
  const s = await ctx.env.DB.prepare("SELECT shop_name, story, district, state, photo_key, show_photo FROM sellers WHERE slug = ? AND status = 'approved'").bind(slug)
    .first<{ shop_name: string; story: string; district: string; state: string; photo_key: string | null; show_photo: number }>().catch(() => null);
  return shellWithMeta(ctx, "/maker/", s ? { title: s.shop_name, description: s.story || `Handmade in ${s.district}, ${s.state}`, image: s.show_photo && s.photo_key ? `/img/${s.photo_key}` : null } : null);
};

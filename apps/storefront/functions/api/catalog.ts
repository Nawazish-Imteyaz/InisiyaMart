// GET /api/catalog — public catalogue used to build the website (and later by the live shop).
import { json, PUBLIC_SETTINGS, type Ctx } from "../_lib/util";

type CatRow = { id: number; slug: string; name: string; sub: string; art: string; color: string; image_key: string | null };
type ProdRow = {
  id: number; slug: string; name: string; category_id: number | null; collection: string; badge: string; summary: string;
  details: string; price_inr: number | null; mrp_inr: number | null; stock: number; track_stock: number;
  personalisable: number; occasions: string; tone: string; art: string;
};

export const onRequestGet = async ({ env }: Ctx): Promise<Response> => {
  const [cats, prods, imgs, sets] = await env.DB.batch([
    env.DB.prepare("SELECT id, slug, name, sub, art, color, image_key FROM categories WHERE visible = 1 ORDER BY sort, name"),
    env.DB.prepare("SELECT * FROM products WHERE status = 'active' ORDER BY sort, id DESC"),
    env.DB.prepare("SELECT product_id, key FROM product_images ORDER BY sort, id"),
    env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${PUBLIC_SETTINGS.map(() => "?").join(",")})`).bind(...PUBLIC_SETTINGS),
  ]);

  const allCats = await env.DB.prepare("SELECT id, slug, name FROM categories").all<{ id: number; slug: string; name: string }>();
  const catById = new Map(allCats.results.map((c) => [c.id, c]));
  const images = new Map<number, string[]>();
  for (const r of imgs.results as { product_id: number; key: string }[]) {
    const list = images.get(r.product_id) ?? [];
    list.push(`/img/${r.key}`);
    images.set(r.product_id, list);
  }

  const settings: Record<string, string> = {};
  for (const r of sets.results as { key: string; value: string }[]) settings[r.key] = r.value;

  return json(
    {
      source: "live",
      generatedAt: new Date().toISOString(),
      settings,
      categories: (cats.results as CatRow[]).map((c) => ({
        slug: c.slug, name: c.name, sub: c.sub, art: c.art, color: c.color, image: c.image_key ? `/img/${c.image_key}` : null,
      })),
      products: (prods.results as ProdRow[]).map((p) => {
        const cat = p.category_id ? catById.get(p.category_id) : undefined;
        return {
          slug: p.slug,
          name: p.name,
          category: cat?.slug ?? "",
          craft: cat?.name ?? "Handmade",
          collection: p.collection,
          badge: p.badge,
          summary: p.summary,
          details: p.details,
          priceInr: p.price_inr,
          mrpInr: p.mrp_inr,
          inStock: !p.track_stock || p.stock > 0,
          personalisable: !!p.personalisable,
          occasions: p.occasions ? p.occasions.split(",").map((s) => s.trim()).filter(Boolean) : [],
          tone: p.tone,
          art: p.art,
          images: images.get(p.id) ?? [],
        };
      }),
    },
    200,
    { "cache-control": "public, max-age=30" },
  );
};

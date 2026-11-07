// GET /api/catalog — public catalogue used to build the website and refresh it live in the browser.
// Only products buyers may see (active + approved + shop approved), each with its public maker card.
import { publicProducts } from "../_lib/market";
import { json, PUBLIC_SETTINGS, type Ctx } from "../_lib/util";

type CatRow = { id: number; slug: string; name: string; sub: string; art: string; color: string; image_key: string | null };
type OccRow = { slug: string; name: string; urdu: string; blurb: string; color: string; grp: string; image_key: string | null };

export const onRequestGet = async ({ env }: Ctx): Promise<Response> => {
  const [cats, sets, occ] = await env.DB.batch([
    env.DB.prepare("SELECT id, slug, name, sub, art, color, image_key FROM categories WHERE visible = 1 ORDER BY sort, name"),
    env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${PUBLIC_SETTINGS.map(() => "?").join(",")})`).bind(...PUBLIC_SETTINGS),
    env.DB.prepare("SELECT slug, name, urdu, blurb, color, grp, image_key FROM occasions WHERE visible = 1 ORDER BY sort, name"),
  ]);
  const products = await publicProducts(env.DB);
  const settings: Record<string, string> = {};
  for (const r of sets.results as { key: string; value: string }[]) settings[r.key] = r.value;

  return json(
    {
      source: "live",
      generatedAt: new Date().toISOString(),
      settings,
      occasions: (occ.results as OccRow[]).map((o) => ({ slug: o.slug, name: o.name, urdu: o.urdu, blurb: o.blurb, color: o.color, group: o.grp, image: o.image_key ? `/img/${o.image_key}` : null })),
      categories: (cats.results as CatRow[]).map((c) => ({ slug: c.slug, name: c.name, sub: c.sub, art: c.art, color: c.color, image: c.image_key ? `/img/${c.image_key}` : null })),
      products,
    },
    200,
    { "cache-control": "public, max-age=30" },
  );
};

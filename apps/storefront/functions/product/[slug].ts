// Old links /product/<slug>/ (shared on WhatsApp, found on Google) → the live product page /product/?s=<slug>.
import type { Ctx } from "../_lib/util";

export const onRequestGet = async ({ request, params }: Ctx): Promise<Response> => {
  const slug = String(params.slug ?? "").toLowerCase();
  const url = new URL(request.url);
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return Response.redirect(new URL("/shop/", url).toString(), 302);
  return Response.redirect(new URL(`/product/?s=${slug}`, url).toString(), 301);
};

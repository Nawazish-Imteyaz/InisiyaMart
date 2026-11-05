// GET /img/<key> — serves product and category photos from R2.
import type { Ctx } from "../_lib/util";

export const onRequestGet = async ({ env, params }: Ctx): Promise<Response> => {
  const key = Array.isArray(params.key) ? params.key.join("/") : params.key ?? "";
  if (!key || !/^[a-z0-9][a-z0-9/._-]*$/i.test(key) || key.includes("..")) return new Response("Not found", { status: 404 });
  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  // Keys are random and never reused, so photos can be cached for a year.
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  // Only photos are ever served from here.
  const type = headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp)$/.test(type)) return new Response("Not found", { status: 404 });
  return new Response(obj.body, { headers });
};

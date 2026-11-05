// Shared admin-console helpers (server side).
import { getSetting, HttpError, looksLikeImage, randomHex, setSetting, slugify, type Ctx, type D1Database, type Env } from "./util";

export type Role = "owner" | "staff";
export interface User { id: number; email: string; name: string; role: Role }

export const PUBLISH_GAP_MS = 3 * 60 * 1000; // at most one website rebuild every 3 minutes (free plan: 500 builds/month)
const MAX_UPLOAD = 8 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export function requireOwner(user: User) {
  if (user.role !== "owner") throw new HttpError(403, "Only the owner can do this");
}


export async function log(db: D1Database, user: User, action: string, detail = "") {
  await db.prepare("INSERT INTO activity (user_name, action, detail) VALUES (?, ?, ?)").bind(user.name || user.email, action, detail.slice(0, 500)).run();
}

export async function uniqueSlug(db: D1Database, table: "products" | "categories" | "occasions", base: string, excludeId?: number): Promise<string> {
  const root = slugify(base);
  for (let i = 1; i < 200; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    const hit = await db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`).bind(slug, excludeId ?? 0).first();
    if (!hit) return slug;
  }
  return `${root}-${randomHex(3)}`;
}

export function idParam(v: string | undefined, what: string): number {
  const n = Number(v);
  if (!v || !Number.isInteger(n) || n < 1) throw new HttpError(404, `${what} not found`);
  return n;
}

/** Website content changed → remember it and rebuild the website (throttled). */
export async function contentChanged(ctx: Ctx, user: User) {
  await setSetting(ctx.env.DB, "_last_change", new Date().toISOString());
  ctx.waitUntil(publish(ctx.env, user, false).catch((e) => console.error("publish failed", e)));
}

export async function publishState(env: Env) {
  const [lastChange, lastPublish] = await Promise.all([getSetting(env.DB, "_last_change"), getSetting(env.DB, "_last_publish")]);
  return {
    hook: !!env.DEPLOY_HOOK_URL,
    lastChange: lastChange || null,
    lastPublish: lastPublish || null,
    pending: !!lastChange && (!lastPublish || lastChange > lastPublish),
    nextAllowedAt: lastPublish ? new Date(Date.parse(lastPublish) + PUBLISH_GAP_MS).toISOString() : null,
  };
}

export async function publish(env: Env, user: User, manual: boolean) {
  if (!env.DEPLOY_HOOK_URL) return { ...(await publishState(env)), started: false, reason: "The deploy hook is not set up yet" };
  const last = await getSetting(env.DB, "_last_publish");
  if (last && Date.now() - Date.parse(last) < PUBLISH_GAP_MS) {
    return { ...(await publishState(env)), started: false, reason: "The website was refreshed less than 3 minutes ago. It will refresh again automatically." };
  }
  const r = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
  if (!r.ok) return { ...(await publishState(env)), started: false, reason: `Cloudflare refused the rebuild (HTTP ${r.status})` };
  await setSetting(env.DB, "_last_publish", new Date().toISOString());
  if (manual) await log(env.DB, user, "Refreshed the website");
  return { ...(await publishState(env)), started: true };
}

export async function readImage(req: Request): Promise<{ data: ArrayBuffer; type: string; ext: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Please choose a photo to upload");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "Please choose a photo to upload");
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new HttpError(400, "Photos must be JPG, PNG or WebP");
  if (file.size > MAX_UPLOAD) throw new HttpError(400, "Photo is too large (max 8 MB)");
  const data = await file.arrayBuffer();
  if (!looksLikeImage(data, file.type)) throw new HttpError(400, "This file is not a real photo. Please choose a JPG, PNG or WebP picture.");
  return { data, type: file.type, ext };
}


// Puts the real title, description and preview image into a static page shell, so Google and WhatsApp
// link previews show the product / shop (the page itself then loads the data live in the browser).
import type { Ctx } from "./util";

declare class HTMLRewriter {
  on(selector: string, handlers: { element?(el: { setAttribute(n: string, v: string): void; setInnerContent(c: string): void; append(c: string, o?: { html: boolean }): void }): void }): HTMLRewriter;
  transform(res: Response): Response;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function shellWithMeta(ctx: Ctx, shellPath: string, meta: { title: string; description: string; image?: string | null } | null): Promise<Response> {
  const { request, env } = ctx;
  const assets = (env as unknown as { ASSETS?: { fetch(r: Request): Promise<Response> } }).ASSETS;
  if (!assets) return new Response("Not found", { status: 404 });
  const shell = await assets.fetch(new Request(new URL(shellPath, request.url).toString(), { headers: request.headers }));
  if (!meta || !shell.ok || typeof HTMLRewriter === "undefined") return shell;
  const origin = new URL(request.url).origin;
  const title = `${meta.title} · Insi House`;
  const desc = meta.description.slice(0, 200);
  const tags = [
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(request.url)}">`,
    meta.image ? `<meta property="og:image" content="${esc(origin + meta.image)}">` : "",
  ].join("");
  return new HTMLRewriter()
    .on("title", { element: (el) => el.setInnerContent(esc(title)) })
    .on('meta[name="description"]', { element: (el) => el.setAttribute("content", esc(desc)) })
    .on("head", { element: (el) => el.append(tags, { html: true }) })
    .transform(shell);
}

import type { NextConfig } from "next";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Fully static site + Cloudflare Pages Functions for /api and /img (see docs/ops/cloudflare.md).
// NEXT_PUBLIC_BASE_PATH is only for sub-folder hosting; Cloudflare leaves it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

/**
 * Before every build, download the live catalogue (products, categories, settings) that the
 * admin console saved in the database, into src/data/generated/catalog.json.
 * - API not deployed yet (404) or local offline build → sample catalogue.
 * - Any other failure on Cloudflare → stop the build, so the live site keeps its current products.
 */
async function syncCatalog() {
  if (process.env.IH_CATALOG_SYNCED) return;
  process.env.IH_CATALOG_SYNCED = "1";
  const file = path.join(process.cwd(), "src", "data", "generated", "catalog.json");
  const url = process.env.CATALOG_URL || "https://insihouse.pages.dev/api/catalog";
  let data: unknown = { source: "sample" };
  let note = "sample catalogue (CATALOG_OFFLINE=1)";

  if (process.env.CATALOG_OFFLINE !== "1") {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "cache-control": "no-cache" } });
      const isJson = (r.headers.get("content-type") ?? "").includes("application/json");
      if (r.ok && isJson) {
        data = await r.json();
        note = `live catalogue from ${url}`;
      } else if (r.status === 404 || (r.ok && !isJson)) {
        note = `catalogue API not deployed yet at ${url}; using sample catalogue`;
      } else {
        throw new Error(`HTTP ${r.status}`);
      }
    } catch (e) {
      if (process.env.CF_PAGES) {
        throw new Error(`Could not load the catalogue from ${url} (${String(e)}). Build stopped so the live website keeps its current products.`);
      }
      note = `could not reach ${url} (${String(e)}); using sample catalogue`;
    }
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  console.log(`[insihouse] ${note}`);
}

export default async function config(): Promise<NextConfig> {
  await syncCatalog();
  return nextConfig;
}

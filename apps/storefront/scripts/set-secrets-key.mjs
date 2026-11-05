// One-time setup: creates the AES-256 key that encrypts partner API keys (Razorpay, Shiprocket, WhatsApp…)
// and saves it (1) in .secrets/cloudflare.env on this PC and (2) as the SECRETS_KEY secret in Cloudflare Pages.
// Run from the repo root:  node apps/storefront/scripts/set-secrets-key.mjs
// The key is never printed. Running it again does nothing if a key already exists (changing it would make
// saved partner keys unreadable).
import { appendFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const file = path.join(root, ".secrets", "cloudflare.env");
const text = readFileSync(file, "utf8");
const env = Object.fromEntries(text.split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));

let key = env.SECRETS_KEY;
if (key) {
  console.log("A SECRETS_KEY already exists in .secrets/cloudflare.env. Re-sending it to Cloudflare.");
} else {
  key = randomBytes(32).toString("hex");
  appendFileSync(file, `\n# AES-256 key for partner API keys (Pages secret SECRETS_KEY). Never change it.\nSECRETS_KEY=${key}\n`);
  console.log("Created a new key and saved it in .secrets/cloudflare.env");
}

const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/insihouse`, {
  method: "PATCH",
  headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify({ deployment_configs: { production: { env_vars: { SECRETS_KEY: { type: "secret_text", value: key } } } } }),
});
const d = await r.json();
if (!d.success) { console.error("Cloudflare refused:", JSON.stringify(d.errors)); process.exit(1); }
const vars = Object.entries(d.result.deployment_configs.production.env_vars ?? {}).map(([k, v]) => `${k} (${v.type})`);
console.log("Done. Cloudflare production secrets now:", vars.join(", "));
console.log("It takes effect on the next deploy.");

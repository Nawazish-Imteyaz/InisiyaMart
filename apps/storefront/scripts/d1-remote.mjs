// Runs a .sql file on the LIVE Cloudflare D1 database through the Cloudflare API.
// Reads credentials from ../../.secrets/cloudflare.env (git-ignored). Usage: node scripts/d1-remote.mjs <file.sql | -e "SQL">
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(path.join(here, "..", "..", "..", ".secrets", "cloudflare.env"), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const [flag, arg] = process.argv.slice(2);
const sql = flag === "-e" ? arg : readFileSync(flag, "utf8");
if (!sql) { console.error("Usage: node scripts/d1-remote.mjs <file.sql | -e SQL>"); process.exit(1); }

const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.D1_DATABASE_ID}/query`;
const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ sql }) });
const data = await r.json();
if (!data.success) { console.error(JSON.stringify(data.errors, null, 2)); process.exit(1); }
for (const res of data.result) {
  if (res.results?.length) console.log(JSON.stringify(res.results, null, 1));
}
console.log(`OK: ${data.result.length} statement(s) ran.`);

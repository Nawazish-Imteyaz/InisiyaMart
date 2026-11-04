// Prints SQL that creates (or resets) an admin login. Usage:
//   node scripts/create-admin.mjs <email> "<name>" <owner|staff> [password]
// If no password is given, a strong one is generated and printed to stderr.
// Hashing matches functions/_lib/util.ts (PBKDF2-SHA256, 100k iterations).
import { pbkdf2Sync, randomBytes } from "node:crypto";

const [email, name = "Owner", role = "owner", given] = process.argv.slice(2);
if (!email || !["owner", "staff"].includes(role)) {
  console.error('Usage: node scripts/create-admin.mjs <email> "<name>" <owner|staff> [password]');
  process.exit(1);
}
const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const password = given ?? Array.from(randomBytes(14), (b) => alphabet[b % alphabet.length]).join("");
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
console.log(
  `INSERT INTO admin_users (email, name, role, pass_hash, pass_salt, active) VALUES (${q(email.toLowerCase())}, ${q(name)}, ${q(role)}, ${q(hash)}, ${q(salt.toString("hex"))}, 1)` +
    ` ON CONFLICT(email) DO UPDATE SET name = excluded.name, role = excluded.role, pass_hash = excluded.pass_hash, pass_salt = excluded.pass_salt, active = 1;`,
);
if (!given) console.error(`PASSWORD: ${password}`);

// After `next build` (static export): Next.js writes page-prefetch files for route groups as folders,
// e.g. out/account/__next.!KHN0b3JlKQ/account/__PAGE__.txt, but the browser asks for the dotted name
// out/account/__next.!KHN0b3JlKQ.account.__PAGE__.txt. Without a copy, every prefetch is a 404 and
// links do a full page reload. This writes the dotted copies.
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "out");
let n = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith("__next.")) flatten(p, dir, name);
    else if (name !== "_next") walk(p);
  }
}

function flatten(root, parent, prefix) {
  const stack = [[root, prefix]];
  while (stack.length) {
    const [dir, dotted] = stack.pop();
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) stack.push([p, `${dotted}.${name}`]);
      else {
        const target = path.join(parent, `${dotted}.${name}`);
        if (!existsSync(target)) { copyFileSync(p, target); n++; }
      }
    }
  }
}

if (!existsSync(out)) { console.error(`[flatten-rsc] ${out} not found`); process.exit(1); }
walk(out);
console.log(`[flatten-rsc] wrote ${n} prefetch file(s)`);

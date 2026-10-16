// Verifies every internal href/src in dist/ resolves to a built file.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const html = walk(dist).filter((f) => f.endsWith(".html"));
const missing = new Map();
let checked = 0;

for (const file of html) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[#?][^"]*)?"/g)) {
    let p = decodeURIComponent(m[1]);
    if (p.startsWith("//")) continue;
    checked++;
    const target = p.endsWith("/") ? join(dist, p, "index.html") : join(dist, p);
    const ok = existsSync(target) || existsSync(join(target, "index.html")) || existsSync(target + ".html");
    if (!ok) missing.set(p, (missing.get(p) || 0) + 1);
  }
}
console.log(`Checked ${checked} internal references across ${html.length} pages.`);
if (missing.size) {
  console.log("Missing targets:");
  for (const [p, n] of [...missing].sort()) console.log(`  ${p}  (${n}x)`);
  process.exitCode = 1;
} else console.log("All internal links resolve.");

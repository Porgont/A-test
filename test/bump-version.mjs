// 版本号递增 + 打时间戳。用法：
//   node test/bump-version.mjs minor   → 1.0 → 1.1（每次变动用这个）
//   node test/bump-version.mjs major   → 1.3 → 2.0（设计大变动用这个）
//   node test/bump-version.mjs set 1.4 → 直接设成 1.4
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "src", "version.json");
const cur = JSON.parse(readFileSync(file, "utf8"));

const mode = process.argv[2] || "minor";
const [maj, min] = String(cur.version).split(".").map(Number);

let next;
if (mode === "major") next = (maj + 1) + ".0";
else if (mode === "minor") next = maj + "." + (min + 1);
else if (mode === "set") next = String(process.argv[3] || cur.version);
else { console.error("用法：node test/bump-version.mjs [minor|major|set X.Y]"); process.exit(2); }

const d = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());

writeFileSync(file, JSON.stringify({ version: next, updated: stamp }, null, 2) + "\n");
console.log("版本 " + cur.version + " → " + next + "   更新于 " + stamp);

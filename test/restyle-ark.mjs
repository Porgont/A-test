// 把「方舟」皮肤改成明日方舟·终末地（Endfield）风格：白底 + 亮黄标记块 + 直角 + 细灰线。
// 用法：node test/restyle-ark.mjs    （可重复运行，幂等）
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html",
  "src/stats.template.html", "src/graph.template.html"];

// 终末地风格：白底、黑字、亮黄 #ffe600 标记、直角、细灰描边、斜纹肌理
const NEW_ARK = `:root[data-skin="ark"]{
  --bg:#ffffff; --bg-image:repeating-linear-gradient(135deg, rgba(17,17,17,.022) 0 10px, transparent 10px 20px);
  --fg:#111213; --fg-dim:#6b7280;
  --card:#ffffff; --card-border:#d5d9de; --card-bw:1px; --radius:2px; --skin-bw:1px;
  --shadow:0 1px 2px rgba(17,17,17,.05); --track:#f1f3f5;
  --chip:#f6f7f9; --chip-border:#c9ced4;
  --chip-on-bg:#ffe600; --chip-on-fg:#111213;
  --mark:#111213; --mark-fg:#ffe600; --logo-shadow:none;
}`;

let n = 0;
for (const rel of FILES) {
  const p = join(root, rel);
  if (!existsSync(p)) { console.log("  跳过 " + rel + "（不存在）"); continue; }
  let t = readFileSync(p, "utf8");
  const m = /:root\[data-skin="ark"\]\{[\s\S]*?\n\}/.exec(t);
  if (!m) { console.log("  跳过 " + rel + "（没有 ark 皮肤块）"); continue; }
  if (m[0] === NEW_ARK) { console.log("  = " + rel + " 已经是终末地风格"); continue; }
  t = t.slice(0, m.index) + NEW_ARK + t.slice(m.index + m[0].length);
  writeFileSync(p, t);
  n++;
  console.log("  ✓ " + rel + " 方舟皮肤 → 终末地风格（白底）");
}
console.log("共改动 " + n + " 个文件。");

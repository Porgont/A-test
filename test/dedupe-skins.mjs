// 清理重复的皮肤变量块：早期注入脚本跑了两遍，留下两份 :root[data-skin="ark"]{...}，
// 后一份（旧的黑色版本）覆盖了新的白色版本。这里只保留含 --bg:#ffffff 的那一份。
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html",
  "src/stats.template.html", "src/graph.template.html"];

for (const f of FILES) {
  if (!existsSync(f)) continue;
  let t = readFileSync(f, "utf8");
  const re = /:root\[data-skin="ark"\]\{[\s\S]*?\n\}/g;
  const blocks = [...t.matchAll(re)];
  if (blocks.length <= 1) { console.log("  = " + f + " 只有 " + blocks.length + " 个 ark 块"); continue; }

  const white = blocks.filter((b) => b[0].includes("--bg:#ffffff"));
  const dark = blocks.filter((b) => !b[0].includes("--bg:#ffffff") && /--bg:#/.test(b[0]));
  console.log("  " + f + "：ark 块 " + blocks.length + " 个（白色 " + white.length + "，其它 " + dark.length + "）");

  // 从后往前删掉非白色的变量块（保留第一份白色块）
  const kill = white.length ? dark : blocks.slice(1);
  for (const k of kill.reverse()) {
    t = t.slice(0, k.index) + t.slice(k.index + k[0].length);
  }
  // 删掉后可能留下空行，收一下
  t = t.replace(/\n{3,}/g, "\n\n");
  writeFileSync(f, t);
  console.log("     → 删掉 " + kill.length + " 份，剩下 " + (blocks.length - kill.length) + " 份");
}
console.log("完成。");

// 给「方舟」皮肤补齐漏定义的 CSS 变量（输入框、按钮、聚焦环、强调线等）。
// 缺变量时会回落到别的皮肤的取值 —— 白底白框就是这么来的。
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html",
  "src/stats.template.html", "src/graph.template.html"];

// 终末地风格：输入框浅灰底 + 清晰黑描边；主按钮黑实心；聚焦环亮黄
const ADD = [
  "--input-bg:#f4f5f7; --input-border:#111213; --input-bw:1px;",
  "--btn-bg:#111213; --btn-fg:#ffffff; --btn-shadow:none;",
  "--focus-ring:#ffe600; --accent-line:#111213; --chip-on-shadow:none; --danger:#d92d20; --blur:none;",
];

let n = 0;
for (const rel of FILES) {
  if (!existsSync(rel)) { console.log("  跳过 " + rel); continue; }
  let t = readFileSync(rel, "utf8");
  const m = /:root\[data-skin="ark"\]\{([\s\S]*?)\n\}/.exec(t);
  if (!m) { console.log("  跳过 " + rel + "（没有 ark 皮肤块）"); continue; }
  const block = m[1];
  if (block.includes("--input-bg") && block.includes("--btn-bg") && block.includes("--focus-ring")) {
    console.log("  = " + rel + " 已补齐");
    continue;
  }
  const addText = ADD.filter((line) => {
    const first = line.split(":")[0].trim();
    return !block.includes(first + ":");
  }).join("\n  ");
  if (!addText) { console.log("  = " + rel + " 无需补"); continue; }
  const newBlock = block.trimEnd() + "\n  " + addText + "\n";
  t = t.slice(0, m.index) + ':root[data-skin="ark"]{' + newBlock + "}" + t.slice(m.index + m[0].length);
  writeFileSync(rel, t);
  n++;
  console.log("  ✓ " + rel + " 补齐：" + addText.split("\n").map((s) => s.trim().split(":")[0]).join(" "));
}
console.log("共改动 " + n + " 个文件。");

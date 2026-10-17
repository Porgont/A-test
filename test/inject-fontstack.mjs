// 字体栈：优先本机已装的开源中文字体（HarmonyOS Sans SC / Noto Sans SC），
// 其次回到系统 UI 字体。零外部请求、零字节膨胀；插到 </style> 之前，幂等。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html",
  "src/stats.template.html", "src/graph.template.html"];
const MARK = "/* ===== 字体栈 ===== */";
const CSS = `${MARK}
body{font-family:"HarmonyOS Sans SC","HarmonyOS Sans","Noto Sans SC","Source Han Sans SC","Segoe UI Variable Display","Segoe UI",system-ui,-apple-system,"PingFang SC","Microsoft YaHei UI","Microsoft YaHei",sans-serif;font-optical-sizing:auto}
.heroTitle,.ptitle,.chead b,.chips .chip,.run{font-weight:800;font-synthesis-weight:none}
.rcell,.res,.bigval,.val,.formula,.ctag{font-family:"HarmonyOS Sans","Noto Sans SC","Segoe UI",system-ui,sans-serif;font-variant-numeric:tabular-nums}
`;
let n = 0;
for (const f of FILES) {
  if (!existsSync(f)) continue;
  let t = readFileSync(f, "utf8");
  if (t.indexOf(MARK) >= 0) { console.log("  = " + f); continue; }
  const i = t.indexOf("</style>");
  if (i < 0) { console.log("  ⚠ " + f); continue; }
  writeFileSync(f, t.slice(0, i) + CSS + t.slice(i));
  n++; console.log("  ✓ " + f);
}
console.log("共注入 " + n + " 个文件。");

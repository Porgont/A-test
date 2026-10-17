// 内嵌字体：@font-face 指向 assets/pugua-sans.woff2（同源、单文件 113.5 KB），
// 字体栈把它放在最前面；取不到时自动回落到本机字体，不影响使用。
// 插到 </style> 之前，幂等。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html",
  "src/stats.template.html", "src/graph.template.html"];
const MARK = "/* ===== 内嵌字体 ===== */";
const CSS = `${MARK}
@font-face{
  font-family:"Pugua Sans";
  src:url("assets/pugua-sans.woff2") format("woff2");
  font-weight:400;font-style:normal;font-display:swap;
}
body{font-family:"Pugua Sans","HarmonyOS Sans SC","Noto Sans SC","Segoe UI",system-ui,-apple-system,"PingFang SC","Microsoft YaHei UI","Microsoft YaHei",sans-serif}
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

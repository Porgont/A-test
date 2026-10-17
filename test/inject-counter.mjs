// 每页页脚注入 Moe-Counter 访问计数器，并把「不上传数据」改成诚实表述。
// 幂等：靠标记判断。只在 </body> 前插入，只替换固定的原句，不动其它内容。
// 用法：node test/inject-counter.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html",
  "src/stats.template.html", "src/graph.template.html"];

const CSS_MARK = "/* ===== 访问计数器 ===== */";
const CSS = `${CSS_MARK}
.hitcounter{display:flex;justify-content:center;align-items:center;padding:18px 0 10px;min-height:52px}
.hitcounter img{height:40px;width:auto;max-width:100%;opacity:.95;border-radius:4px}
.hitcounter .hcfail{font-size:13px;color:var(--fg-dim);opacity:.75}
@media (min-width:1000px){.hitcounter img{height:52px}}
`;

const COUNTER = `
<div class="wrap hitcounter" aria-label="页面访问量">
  <img src="https://count.getloli.com/get/@pugua-calc?theme=moebooru" alt="页面访问量"
       loading="lazy" decoding="async" referrerpolicy="no-referrer"
       onerror="this.outerHTML='&lt;span class=&quot;hcfail&quot;&gt;访问量计数器暂不可用&lt;/span&gt;'">
</div>
`;

// 原文案 → 诚实表述（只替换第一句，保留各自的第二句）
const TEXT_FIXES = [
  ["全部计算都在你的浏览器里完成，不上传任何数据。",
   "计算全部在本机完成，不上传计算内容；页脚计数器只统计页面访问量。"],
  ["全部计算都在本机浏览器里完成，不上传任何数据。",
   "计算全部在本机完成，不上传计算内容；页脚计数器只统计页面访问量。"],
  ["全部计算在本机浏览器完成，不上传数据。",
   "计算全部在本机完成，不上传计算内容；页脚计数器只统计页面访问量。"],
  ["全部计算在本机浏览器完成，不上传数据",
   "计算全部在本机完成，不上传计算内容；页脚计数器只统计页面访问量"],
];

let n = 0;
for (const f of FILES) {
  if (!existsSync(f)) { console.log("  跳过 " + f); continue; }
  let t = readFileSync(f, "utf8");
  const before = t;
  const did = [];

  if (t.indexOf(CSS_MARK) < 0) {
    const i = t.indexOf("</style>");
    if (i > 0) { t = t.slice(0, i) + CSS + t.slice(i); did.push("CSS"); }
  }

  if (t.indexOf('class="wrap hitcounter"') < 0) {
    const i = t.lastIndexOf("</body>");
    if (i > 0) { t = t.slice(0, i) + COUNTER + t.slice(i); did.push("计数器"); }
    else console.log("  ⚠ " + f + " 没有 </body>");
  }

  for (const [from, to] of TEXT_FIXES) {
    if (t.indexOf(from) >= 0) { t = t.split(from).join(to); did.push("文案"); }
  }

  if (t !== before) { writeFileSync(f, t); n++; console.log("  ✓ " + f + "  (" + [...new Set(did)].join(" + ") + ")"); }
  else console.log("  = " + f + " 已是最新");
}
console.log("共改动 " + n + " 个文件。");

// 给所有页面注入统一的动效层（CSS + 少量 JS）。幂等。
// 安全原则：只用「插到 </style> 前」和「插到最后一段 <script> 末尾」两处插入，
// 不用任何跨块的替换正则（上一版就是因为跨块匹配把整页脚本吃掉了）。
// 用法：node test/inject-motion.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html",
  "src/stats.template.html", "src/graph.template.html"];

const CSS_MARK = "/* ===== 动效层 ===== */";
const JS_MARK = "/* ===== 动效层 JS ===== */";

const CSS = `${CSS_MARK}
@media (prefers-reduced-motion: no-preference){
  @keyframes dshRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes dshFade{from{opacity:0}to{opacity:1}}
  @keyframes dshPop{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}
  .hero,.toprow,.tabs,.skins,.heroTitle{animation:dshFade .3s ease both}
  .card,.pick{animation:dshRise .44s cubic-bezier(.22,.9,.3,1) both}
  .card:nth-of-type(2){animation-delay:.06s}
  .card:nth-of-type(3){animation-delay:.12s}
  .card:nth-of-type(4){animation-delay:.18s}
  .card:nth-of-type(5){animation-delay:.22s}
  .picks .pick:nth-child(1){animation-delay:.02s}
  .picks .pick:nth-child(2){animation-delay:.05s}
  .picks .pick:nth-child(3){animation-delay:.08s}
  .picks .pick:nth-child(4){animation-delay:.11s}
  .picks .pick:nth-child(5){animation-delay:.14s}
  .picks .pick:nth-child(6){animation-delay:.17s}
  .picks .pick:nth-child(7){animation-delay:.2s}
  .res,.stepbox,.rgrid,.calclab,.formula,.legend,.msgbox{animation:dshPop .26s ease both}
  body,.card,.chip,.tabs,.tabs span,.skins button,.pick{transition:background-color .32s ease,color .32s ease,border-color .32s ease}
  .chip:active,.run:active,.kk:active,.st:active,.skins button:active,.pick:active{transform:scale(.955);transition:transform .09s ease}
  .chip:hover,.run:hover,.tabs a:hover{transform:translateY(-1px)}
  html.dsh-leaving body{opacity:0;transform:translateY(-8px);transition:opacity .17s ease,transform .17s ease}
  .keypad:not([hidden]){animation:dshPop .2s ease both}
}
html{scroll-behavior:smooth}
`;

const JS = `
${JS_MARK}
(function(){
  var root = document.documentElement;
  root.classList.remove("dsh-leaving");
  window.addEventListener("pageshow", function(){ root.classList.remove("dsh-leaving"); });
  document.addEventListener("click", function(e){
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var href = a.getAttribute("href") || "";
    if (href.indexOf(".html") < 0) return;
    if (/^[a-z]+:/i.test(href) || a.target === "_blank") return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    e.preventDefault();
    root.classList.add("dsh-leaving");
    setTimeout(function(){ location.href = href; }, 165);
  }, true);
})();
`;

let n = 0;
for (const rel of FILES) {
  if (!existsSync(rel)) { console.log("  跳过 " + rel); continue; }
  let t = readFileSync(rel, "utf8");
  const before = t;
  let did = [];

  // 1) CSS：插到 </style> 之前
  if (t.indexOf(CSS_MARK) < 0) {
    const i = t.indexOf("</style>");
    if (i > 0) { t = t.slice(0, i) + CSS + t.slice(i); did.push("CSS"); }
    else console.log("  ⚠ " + rel + " 没有 </style>");
  }

  // 2) JS：插到最后一段 <script> 的末尾（不新增 <script> 块）
  if (t.indexOf(JS_MARK) < 0) {
    const i = t.lastIndexOf("</script>");
    if (i > 0) { t = t.slice(0, i) + JS + t.slice(i); did.push("JS"); }
    else console.log("  ⚠ " + rel + " 没有 </script>");
  }

  if (t !== before) { writeFileSync(rel, t); n++; console.log("  ✓ " + rel + "  (" + did.join(" + ") + ")"); }
  else console.log("  = " + rel + " 已是最新");
}
console.log("共改动 " + n + " 个文件。");

// 高级感细节层：纯 CSS，插到每个页面 </style> 之前。幂等（看标记），不做任何内容替换。
// 用法：node test/inject-polish.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html",
  "src/stats.template.html", "src/graph.template.html"];

const MARK = "/* ===== 高级感细节层 ===== */";

const CSS = `${MARK}
/* 1. 排版：更紧的标题字距、抗锯齿、数字等宽 */
body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
.heroTitle{letter-spacing:-.022em}
.heroSub{letter-spacing:.1em;opacity:.85}
h1,h2,h3,.ptitle,.rtitle,.chead b,.chips .chip{letter-spacing:-.008em}
.rcell,.res,.bigval,.val,.num,.ctag,input,table,.formula{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
.glabel,.calclab,.note,.limit,.tag,.chip i,.ptag{letter-spacing:.03em}
/* 2. 吸顶磨砂导航 + 发丝渐变分隔线 */
.tabs{position:sticky;top:8px;z-index:30;backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px)}
.tabs::after{content:"";position:absolute;left:14px;right:14px;bottom:-1px;height:1px;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(128,128,128,.35),transparent)}
.tabs .on{box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 2px 10px -5px rgba(0,0,0,.45)}
/* 3. 卡片：发丝描边 + 两层柔和投影，悬停微抬 */
.card{position:relative;box-shadow:0 1px 2px rgba(16,18,20,.045),0 12px 32px -20px rgba(16,18,20,.38)}
.card:hover{box-shadow:0 1px 2px rgba(16,18,20,.05),0 18px 44px -22px rgba(16,18,20,.42)}
/* 4. 主按钮：顶部光泽 + 分层投影，按下回弹更深 */
.run{background-image:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 46%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 2px 6px rgba(16,18,20,.16),0 14px 30px -16px rgba(16,18,20,.55)}
.run:hover{filter:brightness(1.04)}
.run:active{filter:brightness(.98);box-shadow:inset 0 2px 6px rgba(16,18,20,.22)}
/* 5. 选中芯片 / 当前页：内高光，像是被"点亮" */
.chip.on,.tabs .on,.skins button.on{box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 2px 8px -4px rgba(0,0,0,.4)}
/* 6. 结果区与输入区在质感上区分开：结果矩阵用更淡的发丝边 */
.rgrid .rcell{border-color:rgba(128,128,128,.24)}
/* 7. 键盘可达性：焦点环（鼠标点击不出现，只有 Tab 时显示） */
:where(a,button,input,select,textarea):focus-visible{outline:2px solid var(--mark,#f5e400);outline-offset:2px}
/* 8. 选中文字与滚动条收敛 */
::selection{background:var(--mark,#f5e400);color:var(--mark-fg,#111213)}
*::-webkit-scrollbar{width:11px;height:11px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:rgba(128,128,128,.32);border-radius:99px;border:3px solid transparent;background-clip:content-box}
*::-webkit-scrollbar-thumb:hover{background:rgba(128,128,128,.5);background-clip:content-box}
/* 9. 标题区收一条发丝渐变短线，视觉有个落点 */
.hero{position:relative}
.hero::after{content:"";display:block;width:68px;height:2px;margin:16px auto 0;border-radius:2px;
  background:linear-gradient(90deg,transparent,var(--mark,#f5e400),transparent);opacity:.9}
`;

let n = 0;
for (const rel of FILES) {
  if (!existsSync(rel)) { console.log("  跳过 " + rel); continue; }
  let t = readFileSync(rel, "utf8");
  if (t.indexOf(MARK) >= 0) { console.log("  = " + rel + " 已注入"); continue; }
  const i = t.indexOf("</style>");
  if (i < 0) { console.log("  ⚠ " + rel + " 没有 </style>"); continue; }
  t = t.slice(0, i) + CSS + t.slice(i);
  writeFileSync(rel, t);
  n++;
  console.log("  ✓ " + rel);
}
console.log("共注入 " + n + " 个文件。");

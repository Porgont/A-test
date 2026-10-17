// 电脑端宽屏：按页面内容密度分别放宽 .wrap 的最大宽度，减少左右空白。
// 只有 >=1000px 才生效，手机端布局完全不变。纯 CSS 注入，幂等。
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CONF = {
  "src/home.html":                { w: 1080, wide: 1240, extra: ".picks{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}" },
  "algebra.html":                 { w: 900,  wide: 1000, extra: ".rgrid .rcell{font-size:16px}" },
  "src/transform.template.html":  { w: 1040, wide: 1200, extra: "" },
  "src/calc.template.html":       { w: 880,  wide: 980,  extra: "" },
  "src/stats.template.html":      { w: 940,  wide: 1060, extra: "" },
  "src/graph.template.html":      { w: 1200, wide: 1400, extra: "" },
};
const MARK = "/* ===== 电脑端宽屏 ===== */";

let n = 0;
for (const [file, c] of Object.entries(CONF)) {
  if (!existsSync(file)) { console.log("  跳过 " + file); continue; }
  let t = readFileSync(file, "utf8");
  if (t.indexOf(MARK) >= 0) { console.log("  = " + file + " 已有"); continue; }
  const i = t.indexOf("</style>");
  if (i < 0) { console.log("  ⚠ " + file + " 没有 </style>"); continue; }
  const css = `${MARK}
@media (min-width:1000px){
  .wrap{max-width:${c.w}px}
  .heroTitle{font-size:34px}
  .heroSub{font-size:14px}
  ${c.extra}
}
@media (min-width:1440px){
  .wrap{max-width:${c.wide}px}
}
`;
  t = t.slice(0, i) + css + t.slice(i);
  writeFileSync(file, t);
  n++;
  console.log("  ✓ " + file + "  1000px→" + c.w + "  ／ 1440px→" + c.wide);
}
console.log("共改动 " + n + " 个文件。");

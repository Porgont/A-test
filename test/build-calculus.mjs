// 用一份模板 src/calc.template.html 生成三个页面：
//   limits.html（极限）/ deriv.html（微分）/ integral.html（积分）
// 三页共用同一份引擎（src/calc-core.mjs）与同一套 UI 代码，只有 __PAGE_ID__ 不同。
// 另外把旧的 calculus.html 写成一个「已拆分」的指路页，避免老链接失效。
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const PAGES = [
  { id: "limits", title: "极限", out: "limits.html" },
  { id: "deriv", title: "微分", out: "deriv.html" },
  { id: "integral", title: "积分", out: "integral.html" },
];

let engine = readFileSync(join(root, "src", "calc-core.mjs"), "utf8");
engine = engine.replace(/^export\s+default\s+/gm, "var __defaultExport = ");
engine = engine.replace(/^export\s*\{[^}]*\}\s*;?[ \t]*$/gm, "");
engine = engine.replace(/^export\s+(async\s+function|function|const|let|var|class)\s/gm, "$1 ");
engine = engine.replace(/<\/script/gi, "<\\/script");
if (/^export\s/m.test(engine)) {
  console.error("FAIL: 引擎里还有 export 没剥掉，请更新 build-calculus.mjs 的规则");
  process.exit(2);
}
const SHIM = `
var Calc = {
  parse: parse, simplify: simplify, str: toString, evalAt: evalAt,
  deriv: deriv, taylor: taylor, limit: limit,
  integrate: integrate, definiteIntegral: definiteIntegral
};
`;

const tpl = readFileSync(join(root, "src", "calc.template.html"), "utf8");
for (const need of ["__CALC_ENGINE__", "__PAGE_ID__", "__PAGE_TITLE__"]) {
  if (tpl.indexOf(need) < 0) { console.error("FAIL: 模板里缺少占位符 " + need); process.exit(2); }
}

for (const p of PAGES) {
  const html = tpl
    .replace("__CALC_ENGINE__", engine.trim() + "\n" + SHIM)
    .replace("__PAGE_ID__", p.id)
    .replace("__PAGE_TITLE__", p.title);
  writeFileSync(join(root, p.out), html);
  console.log("wrote " + p.out.padEnd(14) + Math.round(html.length / 1024) + " KB  (" + p.title + ")");

  if (process.argv.includes("--preview")) {
    const demoFn = p.id === "limits" ? "(x^2-1)/(x-1)" : p.id === "deriv" ? "x^2*e^x" : "1/(1+x^2)";
    const demoA = p.id === "deriv" ? "0.5" : "1";
    const demo = `<script>
(function(){
  document.getElementById("fx").value = ${JSON.stringify(demoFn)};
  var a = document.getElementById("limA"); if (a) a.value = ${JSON.stringify(demoA)};
  setTimeout(function(){
    var c = document.getElementById("calcBtn");
    if (c) c.click();
  }, 30);
})();
</script>
`;
    writeFileSync(join(here, "_preview-" + p.id + ".html"), html.replace("</body>", demo + "</body>"));
    console.log("  + test/_preview-" + p.id + ".html  (演示 " + demoFn + ")");
  }
}

// 旧的 calculus.html 保留为指路页
const notice = `<!doctype html>
<html lang="zh-CN" data-skin="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#f2f2f7">
<title>微积分已拆成三页 · 蒲瓜的计算器</title>
<style>
body{margin:0;padding:32px 16px;background:#f2f2f7;color:#101014;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
.wrap{max-width:640px;margin:0 auto}
h1{font-size:21px;margin:0 0 8px}
p{color:#8a8a92;font-size:13px;line-height:1.7;margin:0 0 18px}
a.pick{display:flex;align-items:center;gap:14px;padding:16px;margin-bottom:12px;border-radius:16px;background:#fff;color:#101014;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 24px rgba(0,0,0,.05)}
a.pick b{font-size:16px}
a.pick span.ic{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#0a84ff,#5e5ce6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-style:italic;font-weight:700;flex:0 0 auto}
a.pick i{display:block;font-style:normal;font-size:12.5px;color:#8a8a92;margin-top:4px}
a.pick em{margin-left:auto;font-style:normal;color:#8a8a92}
.foot{font-size:12px;color:#8a8a92;text-align:center;margin-top:20px}
.foot a{color:#0a84ff}
</style>
</head>
<body>
<div class="wrap">
  <h1>微积分已拆成三页</h1>
  <p>原来的微积分页拆开了，按你要做的事分别打开：</p>
  <a class="pick" href="limits.html"><span class="ic">lim</span><span><b>极限</b><i>存在 / 不存在、左极限、右极限、x→±∞，以及化简判定过程</i></span><em>→</em></a>
  <a class="pick" href="deriv.html"><span class="ic">d/dx</span><span><b>微分</b><i>一阶导、二阶导、切线、泰勒展开</i></span><em>→</em></a>
  <a class="pick" href="integral.html"><span class="ic">∫</span><span><b>积分</b><i>不定积分（原函数）、定积分（精确值或数值）、面积</i></span><em>→</em></a>
  <p class="foot"><a href="index.html">← 回到首页</a></p>
</div>
</body>
</html>
`;
writeFileSync(join(root, "calculus.html"), notice);
console.log("wrote calculus.html   (旧地址指路页)");

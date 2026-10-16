// 生成「函数图像」页 graph.html：src/graph.template.html + src/calc-core.mjs（内联成普通脚本）。
//   node test/build-graph.mjs              生成 graph.html
//   node test/build-graph.mjs --preview    额外生成 test/_preview-graph.html（自动填函数并画一次图，供截图）
// 引擎的处理方式与 test/build-calculus.mjs 一致：剥掉 export，拼一层 var Calc = {...}。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/* ---------- 1. 取出引擎并剥掉 ESM 语法 ---------- */
let engine = readFileSync(join(root, "src", "calc-core.mjs"), "utf8");
engine = engine.replace(/^export\s+default\s+/gm, "var __defaultExport = ");
engine = engine.replace(/^export\s*\{[^}]*\}\s*;?[ \t]*$/gm, "");
engine = engine.replace(/^export\s+(async\s+function|function|const|let|var|class)\s/gm, "$1 ");
engine = engine.replace(/<\/script/gi, "<\\/script");
if (/^export\s/m.test(engine)) {
  console.error("FAIL: 引擎里还有 export 没剥掉，请更新 build-graph.mjs 的规则");
  process.exit(2);
}

// 图像页只做解析、化简、求值，导数 / 极限 / 积分不必暴露
const SHIM = `
var Calc = {
  parse: parse, simplify: simplify, str: toString, evalAt: evalAt,
  deriv: deriv, taylor: taylor, limit: limit,
  integrate: integrate, definiteIntegral: definiteIntegral, Rat: Rat
};
`;

/* ---------- 2. 读模板，替换引擎占位符 ---------- */
const tpl = readFileSync(join(root, "src", "graph.template.html"), "utf8");
if (tpl.indexOf("__CALC_ENGINE__") < 0) {
  console.error("FAIL: 模板里缺少占位符 __CALC_ENGINE__");
  process.exit(2);
}

const html = tpl.replace("__CALC_ENGINE__", engine.trim() + "\n" + SHIM);
const left = html.match(/__[A-Z_]+__/g);
if (left) {
  console.error("FAIL: 还有占位符没替换: " + Array.from(new Set(left)).join(", "));
  process.exit(2);
}
writeFileSync(join(root, "graph.html"), html);
console.log("wrote graph.html   " + Math.round(Buffer.byteLength(html) / 1024) + " KB（UTF-8 实际字节）");

/* ---------- 3. 预览页：自动填好函数并画一次图 ---------- */
if (process.argv.includes("--preview")) {
  const demo = `<script>
(function(){
  function ready(){
    var f = document.getElementById("fx");
    var g = document.getElementById("gx");
    var z = document.getElementById("fxy");
    if (f) f.value = "sin(x)/x";
    if (g) g.value = "cos(x)";
    if (z) z.value = "sin(x)*cos(y)";
    // 触发一遍输入事件，让页面把两条曲线和三维曲面都画出来
    ["fx", "gx", "fxy"].forEach(function(id){
      var n = document.getElementById(id);
      if (n) n.dispatchEvent(new Event("input", { bubbles: true }));
    });
    var fit = document.getElementById("plotFit");
    if (fit) fit.click();
  }
  if (window.__graphReady) ready();
  else setTimeout(ready, 60);
  // 给截图留出绘制时间：画完之后再打一个标记
  setTimeout(function(){ document.documentElement.setAttribute("data-graph-preview", "done"); }, 400);
})();
</script>
`;
  writeFileSync(join(here, "_preview-graph.html"), html.replace("</body>", demo + "</body>"));
  console.log("  + test/_preview-graph.html  (f=sin(x)/x, g=cos(x), z=sin(x)*cos(y))");
}

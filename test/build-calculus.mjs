// Builds calculus.html from src/calculus.template.html by inlining
// src/calc-core.mjs (ES module -> classic script, exports stripped) and
// exposing a Calc namespace for the page UI.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let engine = readFileSync(join(root, "src", "calc-core.mjs"), "utf8");
const before = engine.length;
// ES module -> classic script：剥掉各种 export 写法
engine = engine.replace(/^export\s+default\s+/gm, "var __defaultExport = ");
engine = engine.replace(/^export\s*\{[^}]*\}\s*;?[ \t]*$/gm, "");
engine = engine.replace(/^export\s+(async\s+function|function|const|let|var|class)\s/gm, "$1 ");
engine = engine.replace(/<\/script/gi, "<\\/script");
if (engine === readFileSync(join(root, "src", "calc-core.mjs"), "utf8")) console.log("提示：没有剥到 export（可能已经内联过）");
if (/^export\s/m.test(engine)) {
  console.error("FAIL: 还有 export 没剥掉，请更新 build-calculus.mjs 的规则");
  process.exit(2);
}

const SHIM = `
var Calc = {
  parse: parse, simplify: simplify, str: toString, evalAt: evalAt,
  deriv: deriv, taylor: taylor, limit: limit,
  integrate: integrate, definiteIntegral: definiteIntegral
};
`;

const tplPath = join(root, "src", "calculus.template.html");
const tpl = readFileSync(tplPath, "utf8");
if (tpl.indexOf("__CALC_ENGINE__") < 0) {
  console.error("FAIL: __CALC_ENGINE__ 占位符不在 " + tplPath);
  process.exit(2);
}
const out = tpl.replace("__CALC_ENGINE__", engine.trim() + "\n" + SHIM);
const outPath = join(root, "calculus.html");
writeFileSync(outPath, out);
console.log("wrote calculus.html  " + Math.round(out.length / 1024) + " KB  (引擎 "
  + engine.trim().split("\n").length + " 行)");

if (process.argv.includes("--preview")) {
  const demo = `<script>
(function(){
  var fx = document.getElementById("fx");
  fx.value = "(3*x^2+2*x)/(x^2-5)";
  setTimeout(function(){
    var b = document.querySelector('[data-op="limPosInf"]');
    if (b) b.click();
  }, 30);
})();
</script>
`;
  writeFileSync(join(here, "_preview-calculus.html"), out.replace("</body>", demo + "</body>"));
  console.log("wrote test/_preview-calculus.html  (演示：lim (3x²+2x)/(x²−5), x→+∞)");
}

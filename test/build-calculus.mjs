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
engine = engine.replace(/^export\s+(function|const|let|var|class)\s/gm, "$1 ");
if (engine.length === before) console.log("提示：引擎里没有 export 关键字（可能已经内联过）");

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

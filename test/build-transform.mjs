// Builds transform.html from src/transform.template.html by splicing in the
// engine block taken from index.html, so both pages share one engine source.
// With --preview it also writes test/_preview-transform.html with demo values.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const srcHtml = readFileSync(join(root, "index.html"), "utf8");
const parts = srcHtml.split("/* ==== ENGINE START ==== */");
const engine = parts[1] ? parts[1].split("/* ==== ENGINE END ==== */")[0] : "";
if (!engine.trim()) {
  console.error("FAIL: engine block not found in index.html");
  process.exit(2);
}

const tplPath = join(root, "src", "transform.template.html");
const tpl = readFileSync(tplPath, "utf8");
if (tpl.indexOf("__ENGINE__") < 0) {
  console.error("FAIL: __ENGINE__ placeholder missing in " + tplPath);
  process.exit(2);
}

const out = tpl.replace("__ENGINE__", engine.trim());
const outPath = join(root, "transform.html");
writeFileSync(outPath, out);
console.log("wrote transform.html  " + Math.round(out.length / 1024) + " KB  (engine "
  + engine.trim().split("\n").length + " lines)");

if (process.argv.includes("--preview")) {
  const demo = `<script>
(function(){
  var A = ["1.4","0.6","0","0.2","1.1","0","0","0","1.3"];
  var X = ["1","1","0.5"];
  var set = function(sel, vals){
    var g = document.querySelectorAll(sel);
    for (var i = 0; i < g.length && i < vals.length; i++){ g[i].value = vals[i]; g[i].dispatchEvent(new Event("input", { bubbles: true })); }
  };
  set("#gridA input", A);
  set("#gridX input", X);
})();
</script>
`;
  const prev = out.replace("</body>", demo + "</body>");
  writeFileSync(join(here, "_preview-transform.html"), prev);
  console.log("wrote test/_preview-transform.html  (demo: 剪切+缩放矩阵)");
}

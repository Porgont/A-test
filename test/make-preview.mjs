// Builds screenshot previews: one file per skin, each pre-loaded with a demo
// computation, so the rendered result can be checked without a real click.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "algebra.html"), "utf8");

const CASES = [
  {
    name: "glass",
    skin: "glass",
    label: "A⁻¹（精确分数）",
    script: `
      shrink("A", 1, 1);
      fillA(["4","7","2","6"]);
      pick("inv");`,
  },
  {
    name: "light",
    skin: "light",
    label: "解 Ax = b（向量结果）",
    script: `
      shrink("A", 1, 1);
      shrink("B", 1, 2);
      fillA(["2","1","1","3"]);
      fillB(["3","5"]);
      pick("solve");`,
  },
  {
    name: "brutal",
    skin: "brutal",
    label: "特征值（精确解）",
    script: `
      shrink("A", 1, 1);
      fillA(["2","1","1","2"]);
      pick("eig");`,
  },
  {
    name: "geo",
    skin: "glass",
    label: "REF + 空间几何表示",
    script: `
      fillA(["1.5","0.6","0","0.2","1.2","0","0.3","0.1","1.7"]);
      pick("ref");`,
  },
  {
    name: "gensol",
    skin: "light",
    label: "通解（向量形式）",
    script: `
      shrink("A", 1, 0);
      shrink("B", 1, 2);
      fillA(["1","2","3","2","4","6"]);
      fillB(["1","2"]);
      pick("solve");`,
  },
  {
    name: "enter",
    skin: "glass",
    label: "回车跳格功能测试",
    script: `
      var cells = document.querySelectorAll('#gridA input');
      cells[0].focus();
      cells[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      var idx1 = Array.prototype.indexOf.call(cells, document.activeElement);
      cells[8].focus();
      cells[8].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      var idx2 = Array.prototype.indexOf.call(cells, document.activeElement);
      document.getElementById('ophint').textContent = "回车测试: 第0格→第" + idx1 + "格 (应为1) ; 第8格→第" + idx2 + "格 (应为0, 绕回第一格)";`,
  },
  {
    name: "steps",
    skin: "light",
    label: "初等行变换步骤",
    script: `
      shrink("A", 1, 0);
      fillA(["1","2","3","4","5","6"]);
      pick("steps");`,
  },
];

const helper = `
<script>
function shrink(k, rows, cols){
  var b = document.querySelectorAll('.st[data-k="' + k + '"][data-d="-1"]');
  for (var i = 0; i < rows; i++) b[0].click();
  for (var j = 0; j < cols; j++) b[1].click();
}
function fillA(v){
  var g = document.getElementById("gridA").querySelectorAll("input");
  for (var i = 0; i < v.length && i < g.length; i++){ g[i].value = v[i]; g[i].dispatchEvent(new Event("input", { bubbles: true })); }
}
function fillB(v){
  var g = document.getElementById("gridB").querySelectorAll("input");
  for (var i = 0; i < v.length && i < g.length; i++){ g[i].value = v[i]; g[i].dispatchEvent(new Event("input", { bubbles: true })); }
}
function pick(op){ document.querySelector('.chip[data-op="' + op + '"]').click(); }
(function(){
  var st = document.createElement("style");
  st.textContent = "*{transition:none !important;animation:none !important}";
  document.head.appendChild(st);
  __SCRIPT__
  document.getElementById("run").click();
  __DIAG__
})();
</script>
`;

const diagCode = `  var on = [].slice.call(document.querySelectorAll(".chip[data-op]"))
    .filter(function(b){ return b.classList.contains("on"); })
    .map(function(b){ return b.getAttribute("data-op"); });
  var d = document.createElement("div");
  d.style.cssText = "margin:0 0 10px;padding:8px 12px;font:14px/1.4 monospace;background:#fff;color:#000;border:2px solid #000";
  d.textContent = "chip.on = [" + on.join(",") + "]  tokens=" + document.querySelectorAll(".chip[data-op]").length;
  document.body.insertBefore(d, document.body.firstChild);`;

const wantDiag = process.argv.includes("--diag");

for (const c of CASES) {
  let out = src.replace(
    '<html lang="zh-CN" data-skin="glass">',
    '<html lang="zh-CN" data-skin="' + c.skin + '">'
  );
  const injected = helper
    .replace("__SCRIPT__", c.script)
    .replace("__DIAG__", wantDiag ? diagCode : "");
  out = out.replace("</body>", injected + "\n</body>");
  writeFileSync(join(here, "_preview-" + c.name + ".html"), out);
  console.log("wrote _preview-" + c.name + ".html  (" + c.label + ")" + (wantDiag ? "  [diag]" : ""));
}

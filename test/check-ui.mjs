// Structural checks for the calculator UI (no DOM engine needed).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "algebra.html"), "utf8");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  (" + detail + ")" : "")); }
}

const blocks = html.split("<script>");
check("两个 script 块", blocks.length === 3, "found " + (blocks.length - 1));

const engine = blocks[1].split("</script>")[0];
const ui = blocks[2].split("</script>")[0];

check("引擎块存在", engine.indexOf("const LinAlg") >= 0);
check("引擎块无 DOM 依赖", !/\bdocument\b|\bwindow\b/.test(engine));

try { new Function(ui); check("UI 脚本语法", true); }
catch (e) { check("UI 脚本语法", false, e.message); }

const chipOps = [...html.matchAll(/data-op="([A-Za-z]+)"/g)].map((m) => m[1]);
check("运算按钮数量", chipOps.length === 19, chipOps.join(","));
check("每个按钮都带中文名", (html.match(/<button class="chip[^"]*" data-op="[A-Za-z]+">[^<]+<i>[^<]+<\/i><\/button>/g) || []).length === 19,
  "带中文名的有 " + (html.match(/<button class="chip[^"]*" data-op="[A-Za-z]+">[^<]+<i>[^<]+<\/i><\/button>/g) || []).length + " 个");
check("有矩阵求幂与施密特正交化按钮",
  html.indexOf('data-op="pow"') >= 0 && html.indexOf('data-op="gs"') >= 0 &&
  ui.indexOf("L.matPow(") >= 0 && ui.indexOf("L.gramSchmidt(") >= 0);
check("有增广矩阵求解按钮", html.indexOf('data-op="aug"') >= 0 && ui.indexOf("augSolve") >= 0);
check("有页内数字条（手机上不用系统键盘）",
  html.indexOf('id="padA"') >= 0 && html.indexOf('id="padB"') >= 0 &&
  ui.indexOf("function padInsert(") >= 0 && ui.indexOf("padBuild();") >= 0 &&
  ui.indexOf('closest(".kk")') >= 0 && ui.indexOf("preventDefault();") >= 0);
check("数字条含数字与分数线/负号/小数点/退格",
  ui.indexOf('var PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "/", ".", "⌫"]') >= 0);
check("RREF 步骤里有放大的最终矩阵",
  ui.indexOf('data: rs.R, big: true') >= 0 && ui.indexOf('(b.big ? " big" : "")') >= 0 &&
  html.indexOf(".rgrid.big .rcell{font-size:20px") >= 0);
check("格子解析支持符号（用 L.val）", ui.indexOf("L.val(") >= 0 && ui.indexOf("isSym(f)") >= 0);
check("符号渲染有上标样式", html.indexOf("renderSym") >= 0);
check("REF/RREF 在运算卡片里、基本运算之上",
  html.indexOf('id="g0"') >= 0 &&
  html.indexOf('data-op="ref"') < html.indexOf('id="g1"') &&
  html.indexOf('data-op="rref"') < html.indexOf('id="g1"') &&
  html.indexOf('id="g0"') > html.indexOf('id="cardB"'));
check("REF/RREF 用大号按钮", (html.match(/class="chip big"/g) || []).length === 3);
check("有初等行变换步骤功能", html.indexOf('data-op="steps"') >= 0 && ui.indexOf("rowSteps") >= 0 && ui.indexOf("初等矩阵") >= 0);
check("步骤按钮写明化简到什么形式", html.indexOf("化到行最简形") >= 0 && ui.indexOf("行最简形（RREF）") >= 0);
check("步骤块有渲染分支", ui.indexOf('b.type === "step"') >= 0 && ui.indexOf("stepbox") >= 0 && ui.indexOf("stepDescHTML") >= 0);
check("分组标签齐全", html.indexOf("基本运算") >= 0 && html.indexOf("单个矩阵") >= 0 && html.indexOf("方程与特征") >= 0);
check("有解集形式输出", ui.indexOf("解集") >= 0 && ui.indexOf("setHTML") >= 0 && ui.indexOf("coordLines") >= 0);
check("有一键清空按钮", html.indexOf('data-fill="A:clear"') >= 0 && html.indexOf('data-fill="B:clear"') >= 0 && ui.indexOf('kind === "clear"') >= 0);

for (const op of chipOps) {
  check("已实现：" + op, ui.indexOf('op === "' + op + '"') >= 0 || ui.indexOf('"' + op + '":') >= 0);
}
check("未知运算兜底", ui.indexOf("未知运算") >= 0);

const skins = [...html.matchAll(/data-skin-set="([a-z]+)"/g)].map((m) => m[1]);
check("皮肤数量 6（含方舟/霓虹/终端）", skins.length === 6, skins.join(","));
for (const s of ["glass", "light", "brutal"]) {
  check("皮肤定义：" + s, html.indexOf(':root[data-skin="' + s + '"]') >= 0);
  check("皮肤可选：" + s, skins.indexOf(s) >= 0);
}
check("皮肤参数校验", ui.indexOf("SKINS.indexOf(saved)") >= 0);
check("默认皮肤是极简", html.indexOf('data-skin="ark"') >= 0 && ui.indexOf('|| "ark"') >= 0);
check("大标题与署名", html.indexOf("蒲瓜的计算器") >= 0 && html.indexOf("由 Deepseek 制作") >= 0);
check("切换皮肤会同步主题色", ui.indexOf("theme-color") >= 0);
check("八项导航齐全（顶+底各一条）",
  ["index.html", "transform.html", "limits.html", "deriv.html", "integral.html", "graph.html", "stats.html"]
    .every((h) => (html.match(new RegExp('href="' + h.replace(/\./g, "\\.") + '"', "g")) || []).length === 2) &&
  html.indexOf('<span class="on">矩阵') >= 0);
check("视口 meta", html.indexOf('name="viewport"') >= 0);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

// Structural checks for the calculator UI (no DOM engine needed).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "index.html"), "utf8");

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
check("运算按钮数量", chipOps.length === 15, chipOps.join(","));
check("每个按钮都带中文名", (html.match(/<button class="chip[^"]*" data-op="[A-Za-z]+">[^<]+<i>[^<]+<\/i><\/button>/g) || []).length === 15,
  "带中文名的有 " + (html.match(/<button class="chip[^"]*" data-op="[A-Za-z]+">[^<]+<i>[^<]+<\/i><\/button>/g) || []).length + " 个");
check("REF/RREF 在页面最上面的吸顶栏里",
  html.indexOf('class="quickbar"') >= 0 &&
  html.indexOf('data-op="ref"') < html.indexOf('id="cardA"') &&
  html.indexOf('data-op="rref"') < html.indexOf('id="cardA"'));
check("REF/RREF 用大号按钮", (html.match(/class="chip big"/g) || []).length === 2);
check("快捷栏点击会直接计算", ui.indexOf('.quickbar .chip') >= 0 && ui.indexOf("scrollIntoView") >= 0);
check("有解集形式输出", ui.indexOf("解集") >= 0 && ui.indexOf("setHTML") >= 0 && ui.indexOf("coordLines") >= 0);

for (const op of chipOps) {
  check("已实现：" + op, ui.indexOf('op === "' + op + '"') >= 0 || ui.indexOf('"' + op + '":') >= 0);
}
check("未知运算兜底", ui.indexOf("未知运算") >= 0);

const skins = [...html.matchAll(/data-skin-set="([a-z]+)"/g)].map((m) => m[1]);
check("皮肤数量 3", skins.length === 3, skins.join(","));
for (const s of ["glass", "light", "brutal"]) {
  check("皮肤定义：" + s, html.indexOf(':root[data-skin="' + s + '"]') >= 0);
  check("皮肤可选：" + s, skins.indexOf(s) >= 0);
}
check("皮肤参数校验", ui.indexOf("SKINS.indexOf(saved)") >= 0);
check("默认皮肤是极简", html.indexOf('data-skin="light"') >= 0 && ui.indexOf('|| "light"') >= 0);
check("大标题与署名", html.indexOf("蒲瓜的线性代数计算器") >= 0 && html.indexOf("由 Deepseek 制作") >= 0);
check("切换皮肤会同步主题色", ui.indexOf("theme-color") >= 0);
check("视口 meta", html.indexOf('name="viewport"') >= 0);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

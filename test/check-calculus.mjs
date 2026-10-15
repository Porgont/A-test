// Structure + engine-consistency checks for the calculus page.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const page = readFileSync(join(root, "calculus.html"), "utf8");
const engineSrc = readFileSync(join(root, "src", "calc-core.mjs"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  (" + detail + ")" : "")); }
}
function engineOf(html) {
  const p = html.split("/* ==== CALC ENGINE START ==== */");
  return p[1] ? p[1].split("/* ==== CALC ENGINE END ==== */")[0].trim() : "";
}

const inline = engineOf(page);
check("内联了微积分引擎", inline.length > 500, inline.length + " 字符");
check("占位符已被替换", page.indexOf("__CALC_ENGINE__") < 0);
check("引擎里的 export 已剥掉", !/^export\s/m.test(inline));
check("Calc 命名空间已生成", page.indexOf("var Calc = {") >= 0);
check("内联内容来自 src/calc-core.mjs",
  inline.indexOf(engineSrc.trim().slice(0, 200)) === 0,
  "开头不一致");

const scripts = page.split("<script>");
const ui = scripts[2] ? scripts[2].split("</script>")[0] : "";
try { new Function(ui); check("页面 UI 脚本语法", true); }
catch (e) { check("页面 UI 脚本语法", false, e.message); }
try { new Function(inline); check("内联引擎语法", true); }
catch (e) { check("内联引擎语法", false, e.message); }

check("大标题与署名", page.indexOf("蒲瓜的计算器") >= 0 && page.indexOf("由 Deepseek 制作") >= 0);
check("默认皮肤是极简", page.indexOf('data-skin="light"') >= 0 && ui.indexOf('|| "light"') >= 0);
check("三套皮肤齐全",
  page.indexOf(':root[data-skin="glass"]') >= 0 && page.indexOf(':root[data-skin="light"]') >= 0 && page.indexOf(':root[data-skin="brutal"]') >= 0);
check("三页切换栏（顶+底各一条）", (page.match(/class="tabs"/g) || []).length === 2);
check("当前页标记", page.indexOf('class="tag">当前') >= 0);
check("指向矩阵计算器", (page.match(/href="index\.html"/g) || []).length === 2);
check("指向线性变换页", (page.match(/href="transform\.html"/g) || []).length === 2);

check("有函数输入框", page.indexOf('id="fx"') >= 0);
check("极限三个按钮", page.indexOf('data-op="limBoth"') >= 0 && page.indexOf('data-op="limLeft"') >= 0 && page.indexOf('data-op="limRight"') >= 0);
check("求导两个按钮", page.indexOf('data-op="d1"') >= 0 && page.indexOf('data-op="d2"') >= 0);
check("泰勒展开按钮", page.indexOf('data-op="taylor"') >= 0);
check("积分两个按钮", page.indexOf('data-op="integ"') >= 0 && page.indexOf('data-op="defint"') >= 0);
check("有图像画布", page.indexOf('id="plot"') >= 0 && ui.indexOf("plotDraw") >= 0);
check("显示左右极限", ui.indexOf("左极限") >= 0 && ui.indexOf("右极限") >= 0);
check("显示化简过程", ui.indexOf("化简与判定过程") >= 0 && ui.indexOf("stepsHTML") >= 0);
check("结果存在/不存在都要写", ui.indexOf("极限存在") >= 0 && ui.indexOf("不存在") >= 0);
check("复制结果按钮", page.indexOf('id="copy"') >= 0);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

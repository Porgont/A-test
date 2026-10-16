// 三个微积分页面（极限 / 微分 / 积分）+ 旧 calculus.html 指路页的结构检查
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const engineSrc = readFileSync(join(root, "src", "calc-core.mjs"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  (" + detail + ")" : "")); }
}

const PAGES = [
  { id: "limits", file: "limits.html", title: "极限", ops: ["limBoth", "limLeft", "limRight", "limPosInf", "limNegInf"], needs: ["a"] },
  { id: "deriv", file: "deriv.html", title: "微分", ops: ["d1", "d2", "taylor"], needs: ["limA", "order"] },
  { id: "integral", file: "integral.html", title: "积分", ops: ["integ", "defint"], needs: ["intA", "intB"] },
];

for (const p of PAGES) {
  console.log("\n== " + p.file + "（" + p.title + "） ==");
  const page = readFileSync(join(root, p.file), "utf8");
  const scripts = page.split("<script>");
  const ui = scripts[2] ? scripts[2].split("</script>")[0] : "";
  const inline = (page.split("/* ==== CALC ENGINE START ==== */")[1] || "").split("/* ==== CALC ENGINE END ==== */")[0].trim();

  check("占位符全部替换", page.indexOf("__PAGE_ID__") < 0 && page.indexOf("__PAGE_TITLE__") < 0 && page.indexOf("__CALC_ENGINE__") < 0);
  check("页面标识正确", page.indexOf('var PAGE_ID = "' + p.id + '";') >= 0);
  check("标题正确", page.indexOf("<title>" + p.title + " · 蒲瓜的计算器</title>") >= 0);
  check("内联了引擎", inline.length > 500 && !/^export\s/m.test(inline), inline.length + " 字符");
  check("内联内容来自 src/calc-core.mjs", inline.indexOf(engineSrc.trim().slice(0, 120)) === 0);
  try { new Function(inline); check("内联引擎语法", true); } catch (e) { check("内联引擎语法", false, e.message); }
  try { new Function(ui); check("页面 UI 脚本语法", true); } catch (e) { check("页面 UI 脚本语法", false, e.message); }
  check("Calc 命名空间", page.indexOf("var Calc = {") >= 0);

  check("大标题与署名", page.indexOf("蒲瓜的计算器") >= 0 && page.indexOf("由 Deepseek 制作") >= 0);
  check("默认极简 + 三套皮肤",
    page.indexOf('data-skin="ark"') >= 0 && page.indexOf(':root[data-skin="glass"]') >= 0 &&
    page.indexOf(':root[data-skin="brutal"]') >= 0 && ui.indexOf('|| "ark"') >= 0);

  check("导航表有八项（含本页与图像/概率）",
    ["首页", "矩阵", "变换", "极限", "微分", "积分", "图像", "概率"].every((t) => ui.indexOf('label: "' + t + '"') >= 0) &&
    ui.indexOf('href: "limits.html"') >= 0 && ui.indexOf('href: "deriv.html"') >= 0 &&
    ui.indexOf('href: "integral.html"') >= 0 && ui.indexOf('href: "index.html"') >= 0 &&
    ui.indexOf('href: "algebra.html"') >= 0 && ui.indexOf('href: "transform.html"') >= 0 &&
    ui.indexOf('href: "graph.html"') >= 0 && ui.indexOf('href: "stats.html"') >= 0);
  check("符号面板含 csc/sec/cot 与反三角",
    ui.indexOf('t: "csc"') >= 0 && ui.indexOf('t: "sec"') >= 0 && ui.indexOf('t: "cot"') >= 0 &&
    ui.indexOf('t: "arcsin"') >= 0 && ui.indexOf('t: "arccos"') >= 0 && ui.indexOf('t: "arctan"') >= 0);
  check("说明文字列出 csc/sec/cot", page.indexOf("csc sec cot") >= 0);
  check("a 与积分上下限支持 π/e 表达式",
    ui.indexOf("function readPoint(") >= 0 && ui.indexOf("pi / e 的表达式") >= 0 &&
    ui.indexOf('readPoint(el("intA")') >= 0 && ui.indexOf('readPoint(el("limA")') >= 0);
  check("有导数曲线开关", page.indexOf('id="plotDeriv"') >= 0 && ui.indexOf("PLOT.showDeriv") >= 0);
  check("例子含 cot 一条", ui.indexOf('src: "x*cot(x)"') >= 0);
  check("顶部与底部各一条导航", (page.match(/id="nav"/g) || []).length === 1 && (page.match(/id="nav2"/g) || []).length === 1);
  check("本页的运算都在配置里", p.ops.every((op) => ui.indexOf(op + ":") >= 0));
  check("本页需要的输入框对", p.needs.every((id) => ui.indexOf('"' + id + '"') >= 0 || ui.indexOf(id) >= 0));

  check("有函数输入框 + 符号面板", page.indexOf('id="fx"') >= 0 && page.indexOf('id="syms"') >= 0 && ui.indexOf("insertSym") >= 0);
  check("例子按钮用真上标（不露 ^ 和 *）",
    ui.indexOf('label: "x<sup>2</sup>"') >= 0 && ui.indexOf('label: "x<sup>2</sup>·e<sup>x</sup>"') >= 0 &&
    ui.indexOf('label: "|x|/x"') >= 0 && ui.indexOf('label: "e<sup>−x<sup>2</sup></sup>"') >= 0 &&
    ui.indexOf("b.innerHTML = s.label") >= 0 && page.indexOf(".chip sup{") >= 0);
  check("点例子仍然插入可解析的原始写法",
    ui.indexOf("el(\"fx\").value = s.src") >= 0 && ui.indexOf('src: "abs(x)/x"') >= 0 && ui.indexOf('src: "x*sin(1/x)"') >= 0);
  check("识别为那行也不露 *（用 · 和上标）", ui.indexOf('.replace(/\\s*\\*\\s*/g, "·")') >= 0);
  check("有计算按钮（先选后算）", page.indexOf('id="calcBtn"') >= 0 &&
    ui.indexOf('el("opsArea").addEventListener("click"') >= 0 &&
    ui.indexOf('el("calcBtn").addEventListener("click", runCalc)') >= 0);
  check("渲染在事件绑定之前", ui.indexOf("renderChrome();   //") >= 0 && ui.indexOf("renderChrome();   //") < ui.indexOf('el("opsArea").addEventListener'));
  check("有运算说明行", page.indexOf('id="ophint"') >= 0 && ui.indexOf("OPDEF") >= 0);
  check("有函数图像画布", page.indexOf('id="plot"') >= 0 && ui.indexOf("plotDraw") >= 0);
  check("有复制结果按钮", page.indexOf('id="copy"') >= 0);
}

console.log("\n== calculus.html（旧地址指路页） ==");
const legacy = readFileSync(join(root, "calculus.html"), "utf8");
check("写明已拆分", legacy.indexOf("微积分已拆成三页") >= 0);
check("指向三个新页面",
  legacy.indexOf('href="limits.html"') >= 0 && legacy.indexOf('href="deriv.html"') >= 0 && legacy.indexOf('href="integral.html"') >= 0);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

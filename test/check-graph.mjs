// 「函数图像」页 graph.html 的结构自检：
//   node test/check-graph.mjs
// 覆盖皮肤 / 标题署名 / 八项导航与当前页标记 / 两个画布 / 内联引擎语法 /
// 页面脚本可编译 / 符号面板 / 非法输入的中文提示 / 交互与数字格式化。
import { readFileSync, existsSync } from "node:fs";
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
function count(hay, needle) {
  let n = 0, i = 0;
  for (;;) {
    i = hay.indexOf(needle, i);
    if (i < 0) return n;
    n++; i += needle.length;
  }
}

console.log("== graph.html（函数图像） ==");
if (!existsSync(join(root, "graph.html"))) {
  console.log("  FAIL graph.html 不存在，先跑 node test/build-graph.mjs");
  console.log("\n0 passed, 1 failed");
  process.exit(1);
}
const page = readFileSync(join(root, "graph.html"), "utf8");
if (!existsSync(join(here, "_preview-graph.html"))) {
  console.log("  note test/_preview-graph.html 还没有（build 时加 --preview 会生成）");
}

const blocks = page.split("<script>");
const ui = blocks[2] ? blocks[2].split("</script>")[0] : "";
const inline = (page.split("/* ==== CALC ENGINE START ==== */")[1] || "")
  .split("/* ==== CALC ENGINE END ==== */")[0].trim();

/* ---------- 构建与引擎 ---------- */
check("内联了引擎", inline.length > 500 && !/^export\s/m.test(inline), inline.length + " 字符");
check("内联内容来自 src/calc-core.mjs",
  inline.indexOf(engineSrc.trim().slice(0, 120)) === 0);
check("Calc 命名空间齐全",
  page.indexOf("var Calc = {") >= 0 && page.indexOf("evalAt: evalAt") >= 0 && page.indexOf("parse: parse") >= 0);
try { new Function(inline); check("内联引擎语法可编译", true); }
catch (e) { check("内联引擎语法可编译", false, e.message); }
try { new Function(ui); check("页面脚本 new Function 可编译", true); }
catch (e) { check("页面脚本 new Function 可编译", false, e.message); }
check("页面脚本非空", ui.length > 3000, ui.length + " 字符");
const kb = Math.round(Buffer.byteLength(page) / 1024);
check("体积在合理范围（模板 ~48 KB + 引擎 ~72 KB）", kb >= 100 && kb <= 140, kb + " KB");

/* ---------- 外观：标题、署名、皮肤 ---------- */
check("大标题与署名", page.indexOf("蒲瓜的计算器") >= 0 && page.indexOf("由 Deepseek 制作") >= 0);
check("lang 与默认极简皮肤",
  page.indexOf('<html lang="zh-CN" data-skin="light">') >= 0 && ui.indexOf('|| "light"') >= 0);
check("三套皮肤变量齐全",
  page.indexOf(':root[data-skin="glass"]') >= 0 &&
  page.indexOf(':root[data-skin="light"]') >= 0 &&
  page.indexOf(':root[data-skin="brutal"]') >= 0);
check("皮肤切换按钮三枚", count(page, "data-skin-set=") === 3);
check("皮肤写进 localStorage 的 la-skin-v2",
  ui.indexOf('localStorage.setItem("la-skin-v2", s)') >= 0 && ui.indexOf('localStorage.getItem("la-skin-v2")') >= 0);
check("同步 theme-color 与 iOS 状态栏",
  page.indexOf('name="theme-color"') >= 0 &&
  page.indexOf('name="apple-mobile-web-app-status-bar-style"') >= 0 &&
  ui.indexOf('meta[name="theme-color"]') >= 0 &&
  ui.indexOf("apple-mobile-web-app-status-bar-style") >= 0);
check("品牌行：ƒ 与标语",
  page.indexOf('<span class="logo">ƒ</span>') >= 0 && page.indexOf("二维曲线 · 三维曲面") >= 0);

/* ---------- 导航 ---------- */
const NAVORDER = [
  { id: "home", label: "首页", href: "index.html" },
  { id: "algebra", label: "矩阵", href: "algebra.html" },
  { id: "transform", label: "变换", href: "transform.html" },
  { id: "limits", label: "极限", href: "limits.html" },
  { id: "deriv", label: "微分", href: "deriv.html" },
  { id: "integral", label: "积分", href: "integral.html" },
  { id: "graph", label: "图像", href: "graph.html" },
  { id: "stats", label: "概率", href: "stats.html" },
];
check("八项导航顺序固定",
  (function () {
    let pos = -1;
    return NAVORDER.every((n) => {
      const i = ui.indexOf('id: "' + n.id + '", label: "' + n.label + '"');
      if (i < 0 || i < pos) return false;
      pos = i;
      return true;
    });
  })());
check("七个其它页面的 href 都在",
  NAVORDER.filter((n) => n.href !== "graph.html").every((n) => ui.indexOf('href: "' + n.href + '"') >= 0));
check("本页写成 span.on + 当前标记",
  ui.indexOf('PAGE_ID = "graph"') >= 0 &&
  ui.indexOf("'<span class=\"on\">' + n.label + '<span class=\"tag\">当前</span></span>'") >= 0);
check("顶部与底部各一条导航", page.indexOf('id="nav"') >= 0 && page.indexOf('id="nav2"') >= 0 &&
  (page.match(/id="nav2"/g) || []).length === 1);
check("导航渲染进两个容器", ui.indexOf('el("nav").innerHTML = navHTML()') >= 0 &&
  ui.indexOf('el("nav2").innerHTML = navHTML()') >= 0);
check("导航排三行（flex-wrap + 33.333%）",
  page.indexOf(".tabs{display:flex;flex-wrap:wrap;") >= 0 &&
  page.indexOf("flex:1 1 calc(33.333% - 4px)") >= 0);
check("导航字号约 13px", page.indexOf("border-radius:11px;font-size:13px") >= 0);
check("页脚说明写全",
  page.indexOf("全部计算在本机浏览器完成，不上传数据。") >= 0);

/* ---------- 板块一：二维 ---------- */
check("两个画布都在", page.indexOf('id="plot"') >= 0 && page.indexOf('id="geo3d"') >= 0);
check("二维画布有高度与 touch-action",
  page.indexOf(".geo{display:block;width:100%;height:300px") >= 0 && page.indexOf("touch-action:none") >= 0);
check("两条曲线输入框 f(x) 与 g(x)",
  page.indexOf('id="fx"') >= 0 && page.indexOf('id="gx"') >= 0 &&
  page.indexOf('value="sin(x)/x"') >= 0);
check("g(x) 可留空", page.indexOf('placeholder="留空不画"') >= 0 && ui.indexOf('if (g.trim())') >= 0);
check("两条曲线不同颜色并画进图例",
  page.indexOf("--f1:") >= 0 && page.indexOf("--f2:") >= 0 &&
  page.indexOf('id="legend2d"') >= 0 && ui.indexOf("renderLegend") >= 0);
check("拖动平移（pointer 事件）",
  ui.indexOf('cv2.addEventListener("pointerdown"') >= 0 &&
  ui.indexOf('cv2.addEventListener("pointermove"') >= 0 &&
  ui.indexOf("P2.xmin -= (e.clientX - lx2)") >= 0);
check("滚轮缩放以光标为中心", ui.indexOf('cv2.addEventListener("wheel"') >= 0 &&
  ui.indexOf("function zoom2D(cx, cy, factor)") >= 0);
check("双指捏合缩放", ui.indexOf('cv2.addEventListener("touchmove"') >= 0 && ui.indexOf("Math.hypot") >= 0);
check("按钮：自动取景 / 重置",
  page.indexOf('id="plotFit"') >= 0 && page.indexOf('id="plotReset"') >= 0 && ui.indexOf("autoY()") >= 0);
check("零轴加粗", ui.indexOf("ctx.lineWidth = 1.8") >= 0 && ui.indexOf("var ax = (P2.xmin <= 0 && P2.xmax >= 0)") >= 0);
check("刻度数字（好看的步长 + 画数字）",
  ui.indexOf("function tickStep(raw)") >= 0 && ui.indexOf("ctx.fillText(lb, lx, ly)") >= 0 &&
  ui.indexOf('ctx.font = "10.5px system-ui,-apple-system,sans-serif"') >= 0);
check("曲线断开处不连线", ui.indexOf("if (!isFinite(v)){ started = false;") >= 0);
check("光标坐标读数",
  ui.indexOf("P2.readout = { x:") >= 0 && ui.indexOf('"f(x) = " + (isFinite(v1) ? unary(sig6(v1)) : "不存在")') >= 0);

/* ---------- 符号面板 ---------- */
check("符号面板存在", page.indexOf('id="syms"') >= 0 && ui.indexOf("var SYMS = [") >= 0);
check("符号面板按钮数量 >= 18",
  (function () { const m = /var SYMS = \[([\s\S]*?)\];/.exec(ui); return !!m && count(m[1], "{ t:") >= 18; })(),
  (function () { const m = /var SYMS = \[([\s\S]*?)\];/.exec(ui); return m ? count(m[1], "{ t:") + " 个" : "解析失败"; })());
check("含 csc / sec / cot", ui.indexOf('csc(') >= 0 && ui.indexOf('sec(') >= 0 && ui.indexOf('cot(') >= 0);
check("插到光标处",
  ui.indexOf("function insertSym(v)") >= 0 &&
  ui.indexOf("inp.setSelectionRange(caret, caret)") >= 0 &&
  ui.indexOf("inp.selectionStart") >= 0);
check("符号插到当前聚焦的那个输入框",
  ui.indexOf("var activeInput = \"fx\"") >= 0 && ui.indexOf('el(id).addEventListener("focus"') >= 0);
check("符号面板按钮是脚本建的（数量与 SYMS 一致）",
  ui.indexOf('el("syms").appendChild(b)') >= 0);

/* ---------- 板块二：三维 ---------- */
check("三维函数输入与默认值", page.indexOf('id="fxy"') >= 0 && page.indexOf('value="sin(x)*cos(y)"') >= 0);
check("x/y 范围默认 −3 到 3",
  page.indexOf('id="x0" value="-3"') >= 0 && page.indexOf('id="x1" value="3"') >= 0 &&
  page.indexOf('id="y0" value="-3"') >= 0 && page.indexOf('id="y1" value="3"') >= 0);
check("网格密度默认 40", page.indexOf('id="dens" value="40"') >= 0);
check("手写三维投影", ui.indexOf("function P(x, y, z)") >= 0 &&
  ui.indexOf("var depth = y1 * cp - st * sp;") >= 0);
check("拖动旋转 + 滚轮缩放 + 重置视角",
  ui.indexOf('cv3.addEventListener("pointerdown"') >= 0 &&
  ui.indexOf('cv3.addEventListener("wheel"') >= 0 &&
  page.indexOf('id="geoReset"') >= 0);
check("线框 / 实体可切换", page.indexOf('id="geoMode"') >= 0 && ui.indexOf("G3.solid = !G3.solid") >= 0 &&
  ui.indexOf('el("geoMode").textContent = G3.solid ? "线框" : "实体面"') >= 0);
check("实体面有明暗（法向 + 光向）",
  ui.indexOf("VIEWPOS") >= 0 && ui.indexOf("shadeOf(br, bg, bb, shade)") >= 0);
check("自动旋转按钮", page.indexOf('id="geoSpin"') >= 0 && ui.indexOf('el("geoSpin").textContent = G3.spin ? "停止旋转" : "自动旋转"') >= 0);
check("requestAnimationFrame 只给自动旋转用",
  count(ui, "requestAnimationFrame") === 2 && ui.indexOf("function spinLoop()") >= 0);
check("隐藏标签页时停掉动画", ui.indexOf("document.hidden") >= 0 && ui.indexOf("visibilitychange") >= 0);
check("网格只在需要时重建（旋转不重建）",
  ui.indexOf("function buildGrid()") >= 0 && ui.indexOf("if (need || !G3.built) buildGrid();") >= 0 &&
  ui.indexOf("function paint3D()") >= 0);
check("三维有坐标轴与刻度标签",
  ui.indexOf('label("x", [ax1, ay0, 0]') >= 0 && ui.indexOf('label("y", [ax0, ay1, 0]') >= 0 &&
  ui.indexOf('label("z", [ax0, ay0, G3.zmax]') >= 0 &&
  ui.indexOf('label(unary(sig6(t)), [t, ay0, 0], 0, 13, dim, "center")') >= 0 &&
  ui.indexOf('label(unary(sig6(t)), [ax0, ay0, t], -6, 0, dim, "right")') >= 0);
check("显示当前视角角度", ui.indexOf('"° / 俯仰 " + Math.round(G3.pitch * 180 / Math.PI)') >= 0);
check("数值超出显示范围不硬画", ui.indexOf("function readInRange(v, lo, hi, pad)") >= 0 &&
  ui.indexOf("G3.zok[j3][i3]") >= 0);

/* ---------- 数字格式化与错误提示 ---------- */
check("6 位有效数字 + 去尾零", ui.indexOf("if (a >= 1e6 || a < 1e-4) return String(Number(x.toPrecision(6)));") >= 0 &&
  ui.indexOf("return String(Number(x.toFixed(6)));") >= 0);
check("大数/小数都走 toPrecision（不出 0.30000000000000004）",
  ui.indexOf("function sig6(x)") >= 0 && ui.indexOf("unary(sig6(") >= 0);
check("非法输入走中文提示分支",
  ui.indexOf("function parseExpr(src)") >= 0 &&
  ui.indexOf("function errHTML(msg)") >= 0 &&
  ui.indexOf("var(--danger)") >= 0 &&
  ui.indexOf("请先输入一个函数") >= 0);
check("括号不匹配单独提示",
  ui.indexOf("function checkBrackets(s)") >= 0 &&
  ui.indexOf("括号不匹配：多了一个右括号「)」") >= 0 &&
  ui.indexOf("括号不匹配：还有 ") >= 0);
check("范围/密度填错也有中文提示",
  ui.indexOf("x、y 的范围要填数字") >= 0 &&
  ui.indexOf("范围的「到」必须大于「从」") >= 0 &&
  ui.indexOf("网格密度请填 8 到 80 之间") >= 0);
check("求值用 safeEval 兜住异常（不抛未捕获异常）",
  ui.indexOf("function safeEval(node, x, varName)") >= 0 &&
  ui.indexOf("} catch (e){ return NaN; }") >= 0);
check("二元函数靠代换 y 求值（引擎 evalAt 只认一个变量）",
  ui.indexOf("function substVar(node, name, value)") >= 0 &&
  ui.indexOf('safeEval(substVar(G3.node, "y", G3.ys[j]), G3.xs[i], "x")') >= 0);
check("起手就画一次（启动即渲染）",
  ui.indexOf("read2D();") >= 0 && ui.indexOf("refresh3D(true);") >= 0 &&
  ui.indexOf("window.__graphReady = true;") >= 0);

/* ---------- 预览页 ---------- */
if (existsSync(join(here, "_preview-graph.html"))) {
  const prev = readFileSync(join(here, "_preview-graph.html"), "utf8");
  console.log("\n== test/_preview-graph.html（截图用） ==");
  check("预览页含演示脚本", prev.indexOf("sin(x)/x") >= 0 && prev.indexOf("__graphReady") >= 0);
  check("预览页仍然是完整页面", prev.indexOf("蒲瓜的计算器") >= 0 && prev.indexOf('id="geo3d"') >= 0);
  check("预览页会填好 g(x) 并重画",
    prev.indexOf('g.value = "cos(x)"') >= 0 && prev.indexOf('dispatchEvent(new Event("input"') >= 0 &&
    prev.indexOf('getElementById("plotFit")') >= 0);
  check("本页脚本确实挂在预览页末尾",
    prev.lastIndexOf("__graphReady") > prev.lastIndexOf("二维曲线 · 三维曲面"));
}

/* ---------- graph.html 里不该残留的调试痕迹 ---------- */
console.log("\n== 卫生检查 ==");
check("没有 r_undefined 之类残留", page.indexOf("r_undefined") < 0);
check("没有 TODO / FIXME / console.log", page.indexOf("TODO") < 0 && page.indexOf("FIXME") < 0 &&
  page.indexOf("console.log") < 0);
check("两个画布 id 唯一", (page.match(/id="plot"/g) || []).length === 1 &&
  (page.match(/id="geo3d"/g) || []).length === 1);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

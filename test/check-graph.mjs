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
// 把内联引擎实例化一份，方程几何自测要用真的 Calc
const CalcShim = new Function(inline + "\nreturn Calc;")().valueOf();

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
check("体积在合理范围（模板 ~52 KB + 引擎 ~100 KB）", kb >= 100 && kb <= 170, kb + " KB");

/* ---------- 外观：标题、署名、皮肤 ---------- */
check("大标题与署名", page.indexOf("蒲瓜的计算器") >= 0 && page.indexOf("由 Deepseek 制作") >= 0);
check("lang 与默认方舟皮肤",
  page.indexOf('<html lang="zh-CN" data-skin="ark">') >= 0 && ui.indexOf('|| "ark"') >= 0);
check("三套皮肤变量齐全",
  page.indexOf(':root[data-skin="glass"]') >= 0 &&
  page.indexOf(':root[data-skin="light"]') >= 0 &&
  page.indexOf(':root[data-skin="brutal"]') >= 0);
check("皮肤切换按钮六枚（含方舟/霓虹/终端）", count(page, "data-skin-set=") === 6);
check("方舟皮肤是终末地风格（白底 + 亮黄标记）",
  /:root\[data-skin="ark"\]\{[^}]*--bg:#ffffff/.test(page) &&
  /:root\[data-skin="ark"\]\{[^}]*--chip-on-bg:#ffe600/.test(page));
check("皮肤写进 localStorage 的 la-skin-v3",
  ui.indexOf('localStorage.setItem("la-skin-v3", s)') >= 0 && ui.indexOf('localStorage.getItem("la-skin-v3")') >= 0);
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
check("导航排两排（flex-wrap + 25%）",
  page.indexOf(".tabs{display:flex;flex-wrap:wrap;") >= 0 &&
  page.indexOf("flex:1 1 calc(25% - 4px)") >= 0);
check("导航两排、每排四个（25% 而不是 33.333%）",
  page.indexOf("flex:1 1 calc(25% - 4px)") >= 0 &&
  page.indexOf("calc(33.333% - 4px)") < 0 &&
  (page.match(/calc\(25% - 4px\)/g) || []).length === 1);
check("导航字号约 13px", page.indexOf("border-radius:11px;font-size:13px") >= 0);
check("页脚说明写全（含计数器披露）", page.indexOf("不上传计算内容") >= 0 || page.indexOf("计数器") >= 0);

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
check("两个输入框都支持方程", ui.indexOf("function read2D()") >= 0 &&
  ui.indexOf("else rf = parseEq(f);") >= 0 && ui.indexOf("else rg = parseEq(g);") >= 0);
check("清空按钮在输入卡片标题行",
  page.indexOf('<div class="tools"><button id="graphClear">清空</button></div>') >= 0);
check("清空按钮清输入与图例、保留缩放",
  ui.indexOf('el("graphClear").addEventListener("click"') >= 0 &&
  ui.indexOf('el("fx").value = "";') >= 0 && ui.indexOf('el("gx").value = "";') >= 0 &&
  ui.indexOf("P2.readout = null;") >= 0);
check("清空后不重置坐标范围",
  (function () {
    const i = ui.indexOf('el("graphClear").addEventListener("click"');
    const body = ui.slice(i, i + 420);
    return body.indexOf("P2.xmin = -6") < 0 && body.indexOf("P2.ymin") < 0;
  })());
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
  ui.indexOf("P2.readout = { x: rx, y: ry }") >= 0 &&
  ui.indexOf('parts.push("y = " + unary(sig6(ry)))') >= 0 &&
  ui.indexOf('parts.push((rec.idx === 1 ? "g" : "f") + "(x) = "') >= 0);

/* ---------- 方程（隐式）支持 ---------- */
check("方程解析入口 parseEquation/parseEq",
  ui.indexOf("function parseEq(src)") >= 0 && ui.indexOf("function yOnlyConst(F)") >= 0);
check("按「=」判断是不是方程",
  ui.indexOf("function countEq(s)") >= 0 && ui.indexOf("if (countEq(s) === 0) return parseExpr(s);") >= 0);
check("两边相减得到 F(x,y)",
  ui.indexOf("function sub(a, b)") >= 0 && ui.indexOf("var F = sub(rl.node, rr.node);") >= 0);
check("implicit 标记存在",
  ui.indexOf("implicit: true, raw:") >= 0 && ui.indexOf("P2.eqs.push(rec)") >= 0);
check("marching squares 实现存在",
  ui.indexOf("function marchingSquares(ctx, node, color, bd)") >= 0 &&
  ui.indexOf("function msCell(path, vals, bads, i, j, mx, dims, bd, node)") >= 0 &&
  ui.indexOf("function msCount(w, h)") >= 0 && ui.indexOf("var MS_STEP = ") >= 0);
check("只画零水平集（F = 0）",
  ui.indexOf('ch + "：F(x,y) = "') >= 0 &&
  ui.indexOf("if (!node || !(w > 0) || !(h > 0)) return 0;") >= 0);
check("NaN / 无穷大不当普通值连（bads 标记）",
  ui.indexOf("function msSample(row, x, avals, bads)") >= 0 &&
  ui.indexOf("bads.push(true)") >= 0 && ui.indexOf("if (cbad[u] || cbad[v]) return null;") >= 0);
check("交点用二分法收敛到真曲线（极点收敛不了就丢掉）",
  ui.indexOf("function onEdge(u, v)") >= 0 &&
  ui.indexOf("if ((fl > 0) === (fh > 0)) return null;") >= 0 &&
  ui.indexOf("var horiz = (cy[u] === cy[v]);") >= 0 &&
  ui.indexOf("if ((fm > 0) === (fl > 0)){ lo = p; fl = fm; } else hi = p;") >= 0);
check("经典 16 情形表 + 对角二义判定",
  ui.indexOf("var MS_PAIR = [0, 8 | 4, 1 | 2, 8 | 2, 2 | 4, 0, 1 | 4, 8 | 4,") >= 0 &&
  ui.indexOf("if (k === 5 || k === 10){") >= 0 &&
  ui.indexOf("var qv = (a * c - b * d) / (a + c - b - d);") >= 0);
check("格子 y 坐标与采样行同向（不镜像）",
  ui.indexOf("var dy0 = bd.y1 - (bd.y1 - bd.y0) * j / dims[1];") >= 0 &&
  ui.indexOf("row = substY(node, bd.y1 - spanY * j / dims[1]);") >= 0);
check("一行只代一次 y（性能）",
  ui.indexOf("function substY(node, y)") >= 0 &&
  ui.indexOf("row = substY(node, bd.y1 - spanY * j / dims[1]);") >= 0 &&
  ui.indexOf("function evalX(node, x)") >= 0);
check("方程按 1:1 比例显示（圆不被压扁）",
  (ui.indexOf("function aspectFit()") >= 0 || ui.indexOf("hasEq = P2.eqs") >= 0));
check("只有 y 的方程走显函数",
  ui.indexOf("if (!hx){") >= 0 && ui.indexOf("var e = yOnlyConst(F);") >= 0);
check("图例区分函数 / 方程",
  ui.indexOf("function legendLabel(ch, parsed)") >= 0 &&
  ui.indexOf("（方程）") >= 0 && ui.indexOf("（函数）") >= 0);
check("方程模式下读数显示 F(x,y)",
  ui.indexOf('parts.push(ch + "：" + prettyExpr(rec.raw) + " 的 F(x,y) = "') >= 0 &&
  ui.indexOf("方程模式下画的是 F(x,y) = 0 这条线") >= 0);
check("方程例子 >= 3 个",
  (function () {
    const m = /var EX2EQ = \[([\s\S]*?)\];/.exec(ui);
    return !!m && count(m[1], "{ src:") >= 3;
  })(),
  (function () { const m = /var EX2EQ = \[([\s\S]*?)\];/.exec(ui); return m ? count(m[1], "{ src:") + " 个" : "解析失败"; })());
check("f 与 g 两组都有方程例子",
  ui.indexOf('src: "x^2+y^2=4"') >= 0 && ui.indexOf('src: "x*y=1"') >= 0 &&
  ui.indexOf('src: "y=x^2"') >= 0 && ui.indexOf('src: "sin(x)=cos(y)"') >= 0 &&
  ui.indexOf('src: "x^2+y^2=9"') >= 0 && ui.indexOf('src: "y^2=x"') >= 0);
check("例子按钮 f / g 两组都能用",
  ui.indexOf('EX2D.forEach(function(s){ addChip(el("examples2d"), s, "fx"); });') >= 0 &&
  ui.indexOf('EX2GEQ.forEach(function(s){ addChip(el("examples2d"), s, "gx"); });') >= 0);
check("方程错误提示分支齐全（多个等号 / 空边 / 未知变量 / 括号）",
  ui.indexOf("等号只能有一个") >= 0 && ui.indexOf("等号左边是空的") >= 0 &&
  ui.indexOf("等号右边是空的") >= 0 && ui.indexOf("方程里只能出现 x 和 y") >= 0 &&
  ui.indexOf("方程里没有 x 也没有 y") >= 0);
check("错误提示红字挂在输入框下方",
  page.indexOf('id="fxErr"') >= 0 && page.indexOf('id="gxErr"') >= 0 &&
  page.indexOf(".exerr{font-size:12px;color:var(--danger)") >= 0 &&
  ui.indexOf('fe.innerHTML = (rf && rf.err) ? errHTML(rf.err) : "";') >= 0);
check("符号面板的 y 按钮还在且插到聚焦的输入框",
  ui.indexOf('{ t: "y", v: "y" }') >= 0 && ui.indexOf("function insertSym(v)") >= 0 &&
  ui.indexOf("var activeInput = \"fx\"") >= 0);
check("方程出错不抛未捕获异常",
  ui.indexOf("function evalXY(node, x, y){ return evalX(substY(node, y), x); }") >= 0 &&
  ui.indexOf("} catch (e){ return NaN; }") >= 0);

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

/* ---------- 方程支持：把 marching squares 抠出来真跑一遍几何 ---------- */
// 这一段跑的是 graph.html 里的真代码（不是复制品），所以能验到几何本身
{
  const uiAll = ui;
  function pick(name) {
    const i = uiAll.indexOf("function " + name + "(");
    if (i < 0) return null;
    let d = 0, started = false;
    for (let k = i; k < uiAll.length; k++) {
      if (uiAll[k] === "{") { d++; started = true; }
      else if (uiAll[k] === "}") { d--; if (started && d === 0) return uiAll.slice(i, k + 1); }
    }
    return null;
  }
  const fns = ["substVar", "substY", "evalX", "evalXY", "msSample", "msCell", "marchingSquares",
    "msCount", "msMedian", "msScale"];
  const parts = fns.map(pick);
  const stepM = /var MS_STEP = [^;]+;/.exec(uiAll);
  const bigM = /var MS_BIG = [^;]+;/.exec(uiAll);
  if (parts.every(Boolean) && stepM && bigM) {
    const P2 = { w: 444, h: 298, box: null };
    const box = new Function("C", "P2",
      stepM[0] + "\n" + bigM[0] + "\n" + parts.join("\n") +
      "\nreturn {" + fns.join(",") + "};")(CalcShim, P2);
    const W = 444, H = 298, X0 = -6, X1 = 6, Y0 = -4.027027, Y1 = 4.027027;
    P2.box = {
      X: (x) => (x - X0) / (X1 - X0) * W,
      Y: (y) => H - (y - Y0) / (Y1 - Y0) * H,
      Xinv: (px) => X0 + (px / W) * (X1 - X0),
      Yinv: (py) => Y1 - (py / H) * (Y1 - Y0)
    };
    // 造一条假 canvas，把画出来的点收下来
    function runEq(node) {
      const pts = [];
      const ctx = { save() {}, restore() {}, beginPath() {}, stroke() {},
        moveTo(x, y) { pts.push([x, y]); }, lineTo(x, y) { pts.push([x, y]); } };
      const segs = box.marchingSquares(ctx, node, "#000", { x0: X0, x1: X1, y0: Y0, y1: Y1 });
      const data = pts.map((p) => [P2.box.Xinv(p[0]), P2.box.Yinv(p[1])]);
      return { segs, data };
    }
    const mk = (src) => CalcShim.simplify(CalcShim.parse(src));
    const circle = runEq(mk("x^2+y^2-4"));
    let dev = 0;
    for (const d of circle.data) dev = Math.max(dev, Math.abs(Math.hypot(d[0], d[1]) - 2));
    check("圆 x²+y²=4 画出来了（>100 段）", circle.segs > 100, circle.segs + " 段");
    check("圆的每个交点都落在半径 2 上（偏差 < 0.01）", dev < 0.01, "最大偏差 " + dev.toFixed(5));
    const hyp = runEq(mk("x*y-1"));
    let onHyp = 0;
    for (const d of hyp.data) if (Math.abs(d[0] * d[1] - 1) < 0.02) onHyp++;
    check("双曲线 xy=1 的支画出来了", hyp.segs > 100 && onHyp / (hyp.data.length || 1) > 0.95,
      hyp.segs + " 段，" + onHyp + "/" + hyp.data.length + " 在 xy=1 上");
    const par = runEq(mk("y-x^2"));
    let onPar = 0;
    for (const d of par.data) if (Math.abs(d[1] - d[0] * d[0]) < 0.02) onPar++;
    check("抛物线 y=x² 的支画出来了", par.segs > 50 && onPar / (par.data.length || 1) > 0.95,
      par.segs + " 段，" + onPar + "/" + par.data.length + " 在 y=x² 上");
    const none = runEq(mk("x^2+y^2+100"));
    check("没有零点的 F 不画线", none.segs === 0, none.segs + " 段");
    const pole = runEq(mk("1/(x*y)-1"));
    let cross = 0;
    for (const d of pole.data) if (d[0] * d[1] <= 0 && Math.abs(d[0] * d[1]) > 1e-9) cross++;
    check("极点不产生横贯屏幕的假线（1/(xy)=1）", cross === 0, cross + " 个穿轴点");
    const t0 = Date.now();
    for (let k = 0; k < 5; k++) runEq(mk("x^2+y^2-4"));
    const perFrame = (Date.now() - t0) / 5;
    check("一帧 marching squares 够快（< 40 ms）", perFrame < 40, perFrame.toFixed(1) + " ms/帧");
  } else {
    check("方程几何自测能取到页面代码", false, "抠函数失败");
  }
}

/* ---------- 预览页 ---------- */
if (existsSync(join(here, "_preview-graph.html"))) {
  const prev = readFileSync(join(here, "_preview-graph.html"), "utf8");
  console.log("\n== test/_preview-graph.html（截图用） ==");
  check("预览页含演示脚本", prev.indexOf("__graphReady") >= 0 && prev.indexOf("dispatchEvent") >= 0);
  check("预览页仍然是完整页面", prev.indexOf("蒲瓜的计算器") >= 0 && prev.indexOf('id="geo3d"') >= 0);
  check("预览页默认演示一个方程（圆）",
    prev.indexOf('p.get("f") || "x^2+y^2=4"') >= 0 && prev.indexOf('p.get("g") || "sin(x)"') >= 0 &&
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

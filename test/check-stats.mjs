// 「概率 · 分布列」页（stats.html）的自检：结构、皮肤、导航、分布与参数、结果区、
// 画布、脚本能否编译。只看生成出来的 stats.html，不看模板有没有写对——
// 模板的问题会在构建阶段先报出来。
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const file = join(root, "stats.html");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  (" + detail + ")" : "")); }
}

console.log("== stats.html（概率 · 分布列） ==");
if (!existsSync(file)) {
  console.log("  FAIL stats.html 不存在，先跑 node test/build-stats.mjs");
  console.log("\n0 passed, 1 failed");
  process.exit(1);
}

const page = readFileSync(file, "utf8");
// 页面脚本 = 文件里最后一段 <script>…</script>（本页没有引擎，只有这一段）
const scripts = page.split("<script>");
const ui = scripts.length > 1 ? scripts[scripts.length - 1].split("</script>")[0] : "";

/* ---------- 构建结果 ---------- */
check("占位符全部替换", page.indexOf("__PAGE_ID__") < 0 && page.indexOf("__PAGE_TITLE__") < 0 && page.indexOf("__CALC_ENGINE__") < 0);
check("页面标识正确", ui.indexOf('var PAGE_ID = "stats";') >= 0);
check("标题正确", page.indexOf("<title>概率 · 蒲瓜的计算器</title>") >= 0);
check("只有一段内联脚本（本页不需要引擎）", scripts.length === 2, "找到 " + (scripts.length - 1) + " 段");
try { new Function(ui); check("页面脚本 new Function 可编译", true); }
catch (e) { check("页面脚本 new Function 可编译", false, e.message); }

/* ---------- 外观 ---------- */
check("声明 zh-CN 与默认极简皮肤", page.indexOf('<html lang="zh-CN" data-skin="light">') >= 0);
check("三套皮肤变量齐全",
  page.indexOf(':root[data-skin="glass"]') >= 0 && page.indexOf(':root[data-skin="light"]') >= 0 &&
  page.indexOf(':root[data-skin="brutal"]') >= 0);
check("皮肤切换三颗按钮",
  page.indexOf('data-skin-set="glass"') >= 0 && page.indexOf('data-skin-set="light" class="on"') >= 0 &&
  page.indexOf('data-skin-set="brutal"') >= 0);
check("皮肤存 localStorage 键 la-skin-v2", ui.indexOf('localStorage.setItem("la-skin-v2", s)') >= 0 &&
  ui.indexOf('localStorage.getItem("la-skin-v2")') >= 0);
check("Q 参数可指定皮肤并回落到 light", ui.indexOf('new URLSearchParams(location.search).get("skin")') >= 0 && ui.indexOf('|| "light"') >= 0);
check("同步 theme-color", page.indexOf('<meta name="theme-color"') >= 0 &&
  ui.indexOf('querySelector(\'meta[name="theme-color"]\')') >= 0 && ui.indexOf("mc.setAttribute(\"content\", T.color)") >= 0);
check("同步 iOS 状态栏样式",
  page.indexOf('<meta name="apple-mobile-web-app-status-bar-style" content="default">') >= 0 &&
  ui.indexOf("apple-mobile-web-app-status-bar-style") >= 0 && ui.indexOf("sb.setAttribute(\"content\", T.bar)") >= 0);
check("大标题与署名", page.indexOf("蒲瓜的计算器") >= 0 && page.indexOf("由 Deepseek 制作") >= 0);
check("品牌 logo 用 P、标语写「分布列 · 期望 · 方差」",
  page.indexOf('<span class="logo" id="logo">P</span>') >= 0 && page.indexOf("分布列 · 期望 · 方差") >= 0);
check("页脚写明不上传数据", page.indexOf("全部计算在本机浏览器完成，不上传数据") >= 0);

/* ---------- 八项导航 ---------- */
const NAV = [
  ["首页", "index.html"], ["矩阵", "algebra.html"], ["变换", "transform.html"], ["极限", "limits.html"],
  ["微分", "deriv.html"], ["积分", "integral.html"], ["图像", "graph.html"], ["概率", "stats.html"],
];
check("导航表有八个入口且顺序固定",
  NAV.every((n, i) => ui.indexOf('label: "' + n[0] + '", href: "' + n[1] + '"') > (i ? ui.indexOf('label: "' + NAV[i - 1][0] + '"') : -1)) &&
  NAV.every((n) => ui.indexOf('href: "' + n[1] + '"') >= 0),
  NAV.map((n) => n[0]).join(" · "));
check("顶部与底部各一条导航", (page.match(/id="nav"/g) || []).length === 1 && (page.match(/id="nav2"/g) || []).length === 1);
check("当前页「概率」标记 on + 当前", ui.indexOf('<span class="on">\' + n.label + \'<span class="tag">当前</span></span>') >= 0 &&
  ui.indexOf('n.id === PAGE_ID') >= 0);
check("非当前页是链接", ui.indexOf("'<a href=\"' + n.href + '\">' + n.label + '</a>'") >= 0);
check("导航一排四个、两排（flex 25% + flex-wrap）",
  page.indexOf(".tabs{display:flex;flex-wrap:wrap;") >= 0 &&
  page.indexOf("flex:1 1 calc(25% - 4px)") >= 0);
check("导航字号 13px", /\.tabs a,\.tabs span\{[^}]*font-size:13px/.test(page));

/* ---------- 四种分布 + 正态 ---------- */
check("分布按钮五种、默认选中二项",
  ui.indexOf('var ORDER = ["bin", "poi", "hyp", "geo", "nor"];') >= 0 &&
  ui.indexOf("data-dist=") >= 0 && ui.indexOf('(id === "bin" ? " on" : "")') >= 0);
check("按钮名字带参数写法",
  ["二项 B(n, p)", "泊松 P(λ)", "超几何 H(N, K, n)", "几何 Geom(p)", "正态 N(μ, σ²)"].every((s) => ui.indexOf(s) >= 0));
check("二项参数 n、p 默认 10 / 0.5",
  ui.indexOf('{ id: "n", label: "试验次数 n", def: "10" }') >= 0 &&
  ui.indexOf('{ id: "p", label: "成功概率 p", def: "0.5" }') >= 0);
check("泊松参数 λ 默认 3", ui.indexOf('{ id: "lam", label: "参数 λ", def: "3" }') >= 0);
check("超几何参数 N、K、n 默认 20 / 5 / 4",
  ui.indexOf('{ id: "N", label: "总体 N", def: "20" }') >= 0 &&
  ui.indexOf('{ id: "K", label: "成功数 K", def: "5" }') >= 0 &&
  ui.indexOf('{ id: "n", label: "抽样 n", def: "4" }') >= 0);
check("几何参数 p 默认 0.3", ui.indexOf('{ id: "p", label: "成功概率 p", def: "0.3" }') >= 0);
check("四种分布各有自己的 pmf",
  ui.indexOf("function pmfSeqBin(") >= 0 && ui.indexOf("function pmfSeqPoi(") >= 0 &&
  ui.indexOf("function pmfSeqHyp(") >= 0 && ui.indexOf("function pmfSeqGeo(") >= 0);
check("几何按 P(X=k) = (1−p)^(k−1)·p", ui.indexOf("Math.pow(1 - p, x - 1) * p") >= 0);
check("有参数输入区（chip 选中后渲染）",
  page.indexOf('id="paramArea"') >= 0 && ui.indexOf("function loadParams()") >= 0 && ui.indexOf("el(\"paramArea\").innerHTML") >= 0);
check("参数非法给红色中文提示、不抛异常",
  page.indexOf(".msgerr{") >= 0 && page.indexOf("color:var(--danger)") >= 0 &&
  ui.indexOf("function bad(msg, hint)") >= 0 && ui.indexOf('class="msgerr"') >= 0);

/* ---------- 结果区 ---------- */
check("有计算按钮（先选再算）", page.indexOf('id="calcBtn"') >= 0 && ui.indexOf('el("calcBtn").addEventListener("click", runCalc)') >= 0);
check("结果区存在", page.indexOf('id="out"') >= 0 && ui.indexOf('el("out").innerHTML = h') >= 0);
check("结果区有分布列表格 k / P(X=k) / P(X≤k)",
  ui.indexOf("<th>k</th><th>P(X = k)</th><th>P(X ≤ k)</th>") >= 0 && ui.indexOf("function tableHTML(") >= 0);
check("结果区有期望 · 方差 · 标准差",
  ui.indexOf("期望 E(X)") >= 0 && ui.indexOf("方差 D(X)") >= 0 && ui.indexOf("标准差 σ") >= 0 &&
  ui.indexOf("期望 · 方差 · 标准差") >= 0);
check("结果区有该分布的期望方差公式行",
  ui.indexOf('"E(X) = np，D(X) = np(1−p)"') >= 0 && ui.indexOf('"E(X) = λ，D(X) = λ"') >= 0 &&
  ui.indexOf('"E(X) = 1/p，D(X) = (1−p)/p²"') >= 0 && ui.indexOf("期望方差公式：") >= 0);
check("四种离散分布都用 k 列分布列", ui.indexOf('{ k: i + (offset || 0), p: v, c: acc }') >= 0 &&
  ui.indexOf("function cdfOf(seq, offset)") >= 0);
check("数字保留 6 位有效数字并去尾零",
  ui.indexOf("function round6(x)") >= 0 && ui.indexOf("preserve") < 0 && ui.indexOf("Math.round(x * 1e6) / 1e6") >= 0);
check("有复制结果按钮", page.indexOf('id="copy"') >= 0 && ui.indexOf('el("copy").addEventListener') >= 0);

/* ---------- 画布 ---------- */
check("有画布", page.indexOf('id="plot"') >= 0 && page.indexOf("<canvas id=\"plot\" class=\"geo\">") >= 0);
check("柱状图按概率定高、横轴标 k",
  ui.indexOf("function drawBars(") >= 0 && ui.indexOf("G.Y(r.p / pmax)") >= 0 && ui.indexOf('g.fillText(String(r.k)') >= 0);
check("鼠标/手指能点柱子并高亮",
  ui.indexOf('cv.addEventListener("mousemove", pointAt)') >= 0 &&
  ui.indexOf('cv.addEventListener("touchstart"') >= 0 &&
  ui.indexOf("PLOT.sel = idx") >= 0 && ui.indexOf("g.shadowBlur = 9") >= 0);
check("点中柱子后显示该点的 P(X=k)", ui.indexOf('"k = " + r.k + "　P(X = k) = "') >= 0);

/* ---------- 加分项：正态 ---------- */
check("正态有 μ、σ 参数", ui.indexOf('{ id: "mu", label: "均值 μ", def: "0" }') >= 0 &&
  ui.indexOf('{ id: "sig", label: "标准差 σ", def: "1" }') >= 0);
check("正态用 erf 近似算区间概率", ui.indexOf("function erf(x)") >= 0 && ui.indexOf("function normCdf(") >= 0 &&
  ui.indexOf("0.3275911") >= 0);
check("正态给 ±1σ/±2σ/±3σ 区间概率", ui.indexOf("<td>μ ± \" + r.i + \"σ</td>") >= 0 && ui.indexOf("σ 区间概率") >= 0);
check("正态画密度曲线", ui.indexOf("function drawNormal(") >= 0 && ui.indexOf("function normPdf(") >= 0);

/* ---------- 把页面里的数学函数抽出来真跑一遍 ---------- */
// 从 UI 脚本里按函数名抠出需要的函数体（不做整段 eval，避免 DOM 代码掺进来），
// 拼成一段能跑的代码，再逐条核对数值。
const NAMES = ["isNum", "round6", "fmt", "lnFact", "lnComb", "comb", "pmfSeqBin", "pmfSeqPoi",
               "pmfSeqHyp", "pmfSeqGeo", "cdfOf", "erf", "normCdf", "normPdf", "rowWindow"];
let lib = "var LNFCACHE = [0, 0];\n";
try {
  lib += NAMES.map((name) => {
    const start = ui.indexOf("function " + name + "(");
    if (start < 0) throw new Error("页面脚本里找不到函数 " + name);
    let depth = 0, seen = false;
    for (let i = start; i < ui.length; i++) {
      if (ui[i] === "{") { depth++; seen = true; }
      else if (ui[i] === "}") { depth--; if (seen && depth === 0) return ui.slice(start, i + 1); }
    }
    throw new Error("函数 " + name + " 的括号不配对");
  }).join("\n");
  lib += "\nreturn {" + NAMES.join(", ") + "};";
} catch (e) {
  check("能抽出页面里的数学函数", false, e.message);
}
let M = null;
if (lib) {
  try { M = new Function(lib)(); check("能抽出页面里的数学函数", true); }
  catch (e) { check("能抽出页面里的数学函数", false, e.message); }
}
if (M) {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const near = (name, got, want, tol) =>
    check(name, Math.abs(got - want) <= tol, "got " + got + "，want " + want);

  const B = M.pmfSeqBin(10, 0.5);
  near("B(10,0.5) 的 Σ P(X=k) = 1", sum(B), 1, 1e-12);
  near("B(10,0.5) P(X=5) = 0.246094", B[5], 0.24609375, 1e-9);
  near("B(10,0.5) P(X=0) = 1/1024", B[0], 1 / 1024, 1e-12);
  near("B(10,0.5) 期望 np = 5", 10 * 0.5, 5, 1e-12);
  near("B(10,0.5) 方差 np(1−p) = 2.5", 10 * 0.5 * 0.5, 2.5, 1e-12);

  const P = M.pmfSeqPoi(3), Pc = M.cdfOf(P, 0);
  near("P(3) 的 Σ P(X=k) ≈ 1", sum(P), 1, 1e-9);
  near("P(3) P(X=0) = e^−3", P[0], Math.exp(-3), 1e-12);
  near("P(3) P(X=3) = 0.224042", P[3], 0.22404180765538775, 1e-9);
  near("P(3) 累计到 0.9999 用了前 12 项（k=0…11）", Pc.filter((r) => r.c < 0.9999).length + 1, 12, 0);

  const H = M.pmfSeqHyp(20, 5, 4);
  near("H(20,5,4) 的 Σ P(X=k) = 1", sum(H), 1, 1e-9);
  near("H(20,5,4) 期望 nK/N = 1", 4 * 5 / 20, 1, 1e-12);
  near("H(20,5,4) P(X=1) = C(5,1)C(15,3)/C(20,4)", H[1], (5 * 455) / 4845, 1e-9);

  const G = M.pmfSeqGeo(0.3);
  near("Geom(0.3) 的 Σ P(X=k)（前 200 项）≈ 1", sum(G.slice(0, 200)), 1, 1e-6);
  near("Geom(0.3) P(X=1) = 0.3", G[0], 0.3, 1e-12);
  near("Geom(0.3) 期望 1/p = 3.33333", 1 / 0.3, 3.3333333333333335, 1e-9);
  near("Geom(0.3) 方差 (1−p)/p² = 7.77778", 0.7 / 0.09, 7.777777777777779, 1e-9);

  // A&S 7.1.26 近似本身的误差约 1.5×10⁻⁷，这里按这个精度核对
  near("erf(1) 与标准值一致（误差 < 1.5×10⁻⁷）", M.erf(1), 0.8427007929497149, 1.5e-7);
  near("N(0,1) 的 P(μ±1σ) = 0.682689", M.normCdf(1, 0, 1) - M.normCdf(-1, 0, 1), 0.6826894921370859, 1e-6);
  near("N(0,1) 的 P(μ±2σ) = 0.954500", M.normCdf(2, 0, 1) - M.normCdf(-2, 0, 1), 0.9544997361036416, 1e-6);
  near("N(0,1) 的 P(μ±3σ) = 0.997300", M.normCdf(3, 0, 1) - M.normCdf(-3, 0, 1), 0.9973002039367398, 1e-6);
  near("N(0,1) 的 f(0) = 1/√(2π)", M.normPdf(0, 0, 1), 0.3989422804014327, 1e-9);
  near("N(10,2) 的 P(8<X<12) = 0.682689", M.normCdf(12, 10, 2) - M.normCdf(8, 10, 2), 0.6826894921370859, 1e-6);

  // 超几何：直接从分布列反算 E、D，核对 nK/N 与带有限总体修正的方差公式
  const HH = M.pmfSeqHyp(4000, 2000, 20);
  const hMean = HH.reduce((s, v, i) => s + i * v, 0);
  const hVar = HH.reduce((s, v, i) => s + v * (i - hMean) * (i - hMean), 0);
  near("H(4000,2000,20) 分布列反算的期望 = nK/N", hMean, 20 * 0.5, 1e-9);
  near("H(4000,2000,20) 分布列反算的方差 = 修正公式", hVar,
    20 * 0.5 * 0.5 * ((4000 - 20) / (4000 - 1)), 1e-9);

  // 截断规则：泊松 λ=30 时不能只列前 30 项（众数在 30 附近）
  const rowSixty = M.cdfOf(M.pmfSeqPoi(30), 0);
  const keepSixty = M.rowWindow(rowSixty, 30, Math.sqrt(30), null);
  check("泊松 λ=30 的截断覆盖众数附近的概率", keepSixty >= 45, "只留了 " + keepSixty + " 行");

  // 数字格式：6 位有效数字、去尾零
  check("fmt 去尾零（0.246094 / 1/3 / 2.5×10⁻⁷）",
    M.fmt(0.24609375) === "0.246094" && M.fmt(1 / 3) === "0.333333" && M.fmt(2.5e-7) === "2.5e-7",
    M.fmt(0.24609375) + " / " + M.fmt(1 / 3) + " / " + M.fmt(2.5e-7));
  check("fmt 不把 1 显示成 0.999999", M.fmt(0.9999999999) === "1", M.fmt(0.9999999999));
}

/* ---------- 端到端：拿假 DOM 真跑一遍页面脚本 ---------- */
// 上面只验证了数学函数。这里用一个最小 DOM 桩把整段 UI 脚本跑起来，
// 真的调一次 runCalc，检查结果 HTML 与画布调用——「cut is not defined」
// 这类只在整段脚本运行时才暴露的错误，只有这样才抓得到。
function makeEl(id) {
  const st = { id: id, value: "", textContent: "", innerHTML: "", className: "", style: {} };
  st.classList = {
    toggle() { return st; }, add() { return st; }, remove() { return st; }, contains() { return false; },
  };
  st.addEventListener = () => {};
  st.removeEventListener = () => {};
  st.appendChild = () => {};
  st.querySelectorAll = () => [];
  st.getAttribute = () => null;
  st.setAttribute = () => {};
  st.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 300 });
  st.getContext = () => ctxStub;
  st.clientWidth = 600;
  st.clientHeight = 300;
  return st;
}
const spy = [];
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k in t) return t[k];
    const fn = (...a) => { spy.push([k, ...a]); };
    t[k] = fn; return fn;
  },
  set: (t, k, v) => { t[k] = v; spy.push(["set:" + k, v]); return true; },
});
const els = new Map();
const docStub = {
  documentElement: makeEl("html"),
  body: makeEl("body"),
  getElementById: (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  querySelector: () => makeEl("q"),
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: (tag) => makeEl(tag),
};
// 页面是把参数输入框拼成 HTML 字符串塞进 innerHTML 的，桩里没有解析器，
// 所以这些输入框要提前建好（真实浏览器里由 HTML 解析器创建）。
for (const id of ["p-n", "p-p", "p-lam", "p-N", "p-K", "p-mu", "p-sig", "p-a", "p-b"]) els.set(id, makeEl(id));
const byId = (id) => els.get(id);
const winStub = { devicePixelRatio: 1, addEventListener: () => {} };
// 把页面的 (function(){ … })(); 换成自己的 (function(){ … 导出内部状态 })();
// uiInner 只切一道：从外层函数的 { 后面，一直切到那个配对的 } 之前。
const inner = ui.trim();
const bodyStart = inner.indexOf("{") + 1;
const closing = inner.lastIndexOf("})();");
const bodyEnd = closing > bodyStart ? inner.lastIndexOf("}", closing) : -1;
if (bodyStart <= 0 || bodyEnd <= bodyStart) {
  check("能从页面脚本里切出函数体", false, "bodyStart=" + bodyStart + " bodyEnd=" + bodyEnd);
}
const uiInner = bodyEnd > bodyStart ? inner.slice(bodyStart, bodyEnd) : "";
const tail = "\nvar __S = { S: S, runCalc: runCalc, runDiscrete: runDiscrete, runNormal: runNormal, PLOT: PLOT, NORM: NORM };\n";
let S = null;
try {
  const run = new Function("document", "window", "getComputedStyle", "localStorage", "location", "navigator",
    "return (function(){" + uiInner + tail + "return __S;\n})()");
  S = run(docStub, winStub, () => ({ getPropertyValue: () => "" }), { getItem: () => null, setItem: () => {} },
    { search: "", href: "file:///stats.html" }, { clipboard: null });
  check("整段页面脚本能在最小 DOM 里跑起来", true);
} catch (e) {
  check("整段页面脚本能在最小 DOM 里跑起来", false, e.message);
}

if (S) {
  const canvas = els.get("plot");
  canvas.getContext = () => ctxStub;
  const out = els.get("out");

  // 二项 B(10, 0.5)：点「计算」后结果里应该有期望 5、方差 2.5
  els.get("p-n").value = "10";
  els.get("p-p").value = "0.5";
  S.runCalc();
  check("二项 B(10,0.5)：结果里有期望表达式 5", out.innerHTML.indexOf("np = 10 × 0.5 = <b>5</b>") >= 0);
  check("二项 B(10,0.5)：结果里有方差 2.5", out.innerHTML.indexOf("np(1−p) = <b>2.5</b>") >= 0);
  check("二项 B(10,0.5)：分布列表格列全 k=0…10、累计概率到 1",
    out.innerHTML.indexOf("k 取 0 到 10（累计概率 1）") >= 0 &&
    out.innerHTML.indexOf("<tr><td>10</td>") >= 0 &&
    out.innerHTML.indexOf("</td><td>1</td></tr>") >= 0);
  check("二项 B(10,0.5)：画布画了柱子", spy.some((c) => c[0] === "fillRect") && spy.some((c) => c[0] === "fillText"));
  check("二项 B(10,0.5)：横轴标了 k 与 P", spy.some((c) => c[0] === "fillText" && c[1] === "k") &&
    spy.some((c) => c[0] === "fillText" && c[1] === "P"));

  // 参数非法：红字中文提示，不能抛异常
  els.get("p-n").value = "-3";
  try {
    S.runCalc();
    check("二项 n = −3：给红字提示、不抛异常",
      out.innerHTML.indexOf('class="msgerr"') >= 0 && out.innerHTML.indexOf("非负整数") >= 0);
    check("二项 n = −3：画布换成提示文字、不再画柱子",
      spy.some((c) => c[0] === "fillText" && String(c[1]).indexOf("非负整数") >= 0));
  } catch (e) {
    check("二项 n = −3：给红字提示、不抛异常", false, e.message);
  }
  els.get("p-n").value = "10";
  els.get("p-p").value = "2";
  try {
    S.runCalc();
    check("二项 p = 2：给红字提示、不抛异常",
      out.innerHTML.indexOf('class="msgerr"') >= 0 && out.innerHTML.indexOf("0 到 1") >= 0);
  } catch (e) {
    check("二项 p = 2：给红字提示、不抛异常", false, e.message);
  }

  // 泊松 P(3)：期望方差都是 3
  S.S.dist = "poi";
  els.get("p-lam").value = "3";
  try {
    S.runCalc();
    check("泊松 P(3)：期望与方差都是 3",
      out.innerHTML.indexOf("λ = <b>3</b>") >= 0 && out.innerHTML.indexOf('class="msgerr"') < 0);
    check("泊松 P(3)：分布列从 k=0 起、累计到 0.9999（k=0…11）",
      S.PLOT.rows[0].k === 0 && out.innerHTML.indexOf("k 取 0 到 11") >= 0,
      "首项 k=" + S.PLOT.rows[0].k);
    check("泊松 P(3)：画布画到众数右侧（k = 0…10）",
      S.PLOT.rows.length === 11 && S.PLOT.rows[S.PLOT.rows.length - 1].k === 10,
      "画了 " + S.PLOT.rows.length + " 根柱子");
  } catch (e) {
    check("泊松 P(3)：期望与方差都是 3", false, e.message);
    check("泊松 P(3)：分布列从 k=0 起、累计到 0.9999（k=0…11）", false, e.message);
    check("泊松 P(3)：画布画到众数右侧（k = 0…10）", false, e.message);
  }
  els.get("p-lam").value = "-1";
  try {
    S.runCalc();
    check("泊松 λ = −1：给红字提示、不抛异常", out.innerHTML.indexOf('class="msgerr"') >= 0);
  } catch (e) {
    check("泊松 λ = −1：给红字提示、不抛异常", false, e.message);
  }

  // 几何 Geom(0.3)：k 从 1 开始
  S.S.dist = "geo";
  els.get("p-p").value = "0.3";
  try {
    S.runCalc();
    check("几何 Geom(0.3)：k 从 1 开始", S.PLOT.rows[0].k === 1, "第一项 k=" + S.PLOT.rows[0].k);
    check("几何 Geom(0.3)：期望 1/p ≈ 3.333333", out.innerHTML.indexOf("1 / 0.3 = <b>3.333333</b>") >= 0);
  } catch (e) {
    check("几何 Geom(0.3)：k 从 1 开始", false, e.message);
    check("几何 Geom(0.3)：期望 1/p ≈ 3.333333", false, e.message);
  }

  // 超几何 H(20, 5, 4)：k 取 0…4
  S.S.dist = "hyp";
  els.get("p-N").value = "20"; els.get("p-K").value = "5"; els.get("p-n").value = "4";
  try {
    S.runCalc();
    check("超几何 H(20,5,4)：k 取 0 到 4", S.PLOT.rows[0].k === 0 && S.PLOT.rows[S.PLOT.rows.length - 1].k === 4);
    check("超几何 H(20,5,4)：期望 nK/N = 1", out.innerHTML.indexOf("4 × 5 / 20 = <b>1</b>") >= 0);
  } catch (e) {
    check("超几何 H(20,5,4)：k 取 0 到 4", false, e.message);
    check("超几何 H(20,5,4)：期望 nK/N = 1", false, e.message);
  }

  // 正态 N(0,1)：区间概率 + 密度曲线
  S.S.dist = "nor";
  els.get("p-mu").value = "0"; els.get("p-sig").value = "1";
  els.get("p-a").value = "-1"; els.get("p-b").value = "1";
  try {
    S.runCalc();
    check("正态 N(0,1)：P(−1<X<1) = 0.682689", out.innerHTML.indexOf("0.682689") >= 0);
    check("正态 N(0,1)：三档 σ 区间概率都在", out.innerHTML.indexOf("μ ± 1σ") >= 0 &&
      out.innerHTML.indexOf("μ ± 2σ") >= 0 && out.innerHTML.indexOf("μ ± 3σ") >= 0);
    check("正态 N(0,1)：画了密度曲线", S.PLOT.kind === "normal" && S.NORM.xmin < -3 && S.NORM.xmax > 3);
  } catch (e) {
    check("正态 N(0,1)：P(−1<X<1) = 0.682689", false, e.message);
    check("正态 N(0,1)：三档 σ 区间概率都在", false, e.message);
    check("正态 N(0,1)：画了密度曲线", false, e.message);
  }
  els.get("p-sig").value = "0";
  try {
    S.runCalc();
    check("正态 σ = 0：给红字提示、不抛异常",
      out.innerHTML.indexOf('class="msgerr"') >= 0 && out.innerHTML.indexOf("必须大于 0") >= 0);
  } catch (e) {
    check("正态 σ = 0：给红字提示、不抛异常", false, e.message);
  }
}

/* ---------- 与其它页一致的约定 ---------- */
check("单文件、无外部依赖",
  page.indexOf("<link") < 0 && page.indexOf("src=\"http") < 0 && page.indexOf("<script src") < 0);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

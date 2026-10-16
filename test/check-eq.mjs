// 临时：方程解析与 marching squares 的纯逻辑自测（跑完请删除）
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const page = readFileSync(join(root, "graph.html"), "utf8");
const SL = String.fromCharCode(47), ST = String.fromCharCode(42);
const eng = page.split(SL + ST + " ==== CALC ENGINE START ==== " + ST + SL)[1]
  .split(SL + ST + " ==== CALC ENGINE END ==== " + ST + SL)[0];
const Calc = new Function(eng + "; return {Calc:Calc};")().Calc;
const C = Calc;

/* --- 从 ui 脚本里抠出方程相关的函数，直接跑真代码 --- */
const ui = page.split("<script>")[2].split("</script>")[0];
function pick(name) {
  const i = ui.indexOf("function " + name + "(");
  if (i < 0) throw new Error("找不到函数 " + name);
  let d = 0, started = false;
  for (let k = i; k < ui.length; k++) {
    if (ui[k] === "{") { d++; started = true; }
    else if (ui[k] === "}") { d--; if (started && d === 0) return ui.slice(i, k + 1); }
  }
  throw new Error("函数 " + name + " 没闭合");
}
const needed = ["hasVar", "sub", "countEq", "evalXY", "evalX", "substY", "stripOuterParen",
  "parseExprNode", "parseExpr", "cleanErr", "parseEq", "yOnlyConst", "msCount", "msMedian",
  "msScale", "msSample", "msCell", "marchingSquares", "legendLabel", "prettyExpr", "supHTML",
  "unary", "sig6", "checkBrackets", "substVar", "safeEval", "errHTML"];
const src = needed.map(pick).join("\n");
/** 抠出页面脚本里的常量声明（var NAME = …;） */
function pickConst(name) {
  const m = new RegExp("var " + name + " = [^;]+;").exec(ui);
  if (!m) throw new Error("找不到常量 " + name);
  return m[0];
}
const consts = ["MS_STEP", "MS_BIG"].map(pickConst).join("\n");
const P2 = { xmin: -6, xmax: 6, ymin: -3.9, ymax: 3.9, w: 460, h: 300, box: null };
const box = new Function("C", "el", "P2", consts + "\n" + src + "\nreturn {" + needed.join(",") +
  ",setBox:function(b){P2.box=b;},MS_STEP:MS_STEP,MS_BIG:MS_BIG};")(C, () => ({ innerHTML: "" }), P2);
void box.MS_STEP;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  (" + detail + ")" : "")); }
}
const P = box.parseEq;

console.log("== 方程解析 ==");
check("parseEq 存在", typeof P === "function");
const r1 = P("x^2+y^2=4");
check("x^2+y^2=4 走隐式", r1.implicit === true && !r1.err, JSON.stringify(r1.err || r1.raw));
check("圆的 F(2,0)=0", Math.abs(box.evalXY(r1.node, 2, 0)) < 1e-12, String(box.evalXY(r1.node, 2, 0)));
check("圆的 F(0,2)=0", Math.abs(box.evalXY(r1.node, 0, 2)) < 1e-12);
check("圆的 F(0,0)=-4", Math.abs(box.evalXY(r1.node, 0, 0) + 4) < 1e-12, String(box.evalXY(r1.node, 0, 0)));
check("圆的 F(3,3)=14", Math.abs(box.evalXY(r1.node, 3, 3) - 14) < 1e-12);

const r2 = P("x^2/4+y^2=9=1");
check("两个等号报中文提示", !!r2.err && r2.err.indexOf("等号只能有一个") >= 0, r2.err);

const r3 = P("x*y=1");
check("x*y=1 走隐式", r3.implicit === true);
check("双曲线 F(1,1)=0", Math.abs(box.evalXY(r3.node, 1, 1)) < 1e-12);
check("双曲线 F(2,0.5)=0", Math.abs(box.evalXY(r3.node, 2, 0.5)) < 1e-12);
check("双曲线 F(0,0)=-1", Math.abs(box.evalXY(r3.node, 0, 0) + 1) < 1e-12);

const r4 = P("sin(x)=cos(y)");
check("sin(x)=cos(y) 走隐式", r4.implicit === true && !r4.err, String(r4.err));

const r5 = P("y=x^2");
check("y=x^2 含 x，按隐式方程画（需求如此）", !r5.err && r5.implicit === true, JSON.stringify(r5.err || ""));
check("y=x^2 的 F 在抛物线上为 0", r5.node && Math.abs(box.evalXY(r5.node, 3, 9)) < 1e-12);

const r6 = P("y = x^2 + 1");
check("y = x^2 + 1 也走隐式", !r6.err && r6.implicit === true);

const r7 = P("2y=x^2");
check("2y=x^2 走隐式", !r7.err && r7.implicit === true, r7.err);

const r7b = P("x^2=4");
check("x^2=4 走隐式", !r7b.err && r7b.implicit === true);

// 真正「只有 y 没有 x」的方程：必须走显函数那条路
const ry1 = P("y = 3");
check("y = 3（常函数）走显函数", !ry1.err && ry1.implicit !== true && !!(ry1.node || ry1.err), JSON.stringify(ry1.err || "implicit"));
const ry2 = P("1 = y");
check("1 = y 也能当显函数", !ry2.err && ry2.implicit !== true, JSON.stringify(ry2.err || "implicit"));
const ry3 = P("2*y = 6");
check("2*y = 6 走显函数", !ry3.err && ry3.implicit !== true, JSON.stringify(ry3.err || "implicit"));
check("2*y = 6 解得 y=3", !ry3.err && Math.abs(C.evalAt(ry3.node, 0, "y") - 3) < 1e-9,
  ry3.node ? String(C.evalAt(ry3.node, 0, "y")) : "-");
const ry4 = P("6 = 2*y");
check("6 = 2*y 也能解出 y=3", !ry4.err && Math.abs(C.evalAt(ry4.node, 0, "y") - 3) < 1e-9,
  ry4.err || String(ry4.node && C.evalAt(ry4.node, 0, "y")));
const ry5 = P("y/3 = 1");
check("y/3 = 1 解出 y=3", !ry5.err && Math.abs(C.evalAt(ry5.node, 0, "y") - 3) < 1e-9,
  ry5.err || String(ry5.node && C.evalAt(ry5.node, 0, "y")));
const ry6 = P("y^2 = 9");
check("y^2=9 解不出常数，给中文提示", !!ry6.err, JSON.stringify(ry6.err || ""));
const ry7 = P("2*y^2 = 8");
check("2y^2=8 也解不出，给中文提示", !!ry7.err, JSON.stringify(ry7.err || ""));

const r8 = P("x=2");
check("x=2 走隐式（两条竖线也给画）", !r8.err && r8.implicit === true, JSON.stringify(r8.err || ""));

const r9 = P("=4");
check("等号左边空有提示", !!r9.err && r9.err.indexOf("左边") >= 0, r9.err);
const r10 = P("x^2+y^2=");
check("等号右边空有提示", !!r10.err && r10.err.indexOf("右边") >= 0, r10.err);
const r11 = P("z=x+y");
check("未知变量 z 有中文提示", !!r11.err && r11.err.indexOf("只能出现 x 和 y") >= 0, r11.err);
const r12 = P("3=3");
check("没有变量的方程有提示", !!r12.err && r12.err.indexOf("没有 x 也没有 y") >= 0, r12.err);
const r13 = P("(x^2+y^2)=4");
check("外层括号能剥掉", !r13.err && r13.implicit === true, JSON.stringify(r13.err || ""));
const r14 = P("x^2+y^2=4)");
check("括号不匹配仍报错", !!r14.err, JSON.stringify(r14.err));
const r15 = P("y=1/x");
check("y=1/x 含 x，走隐式", !r15.err && r15.implicit === true, JSON.stringify(r15.err || ""));
const r15b = P("y=sin(x)");
check("y=sin(x) 含 x，走隐式", !r15b.err && r15b.implicit === true);
const r15c = P("2*y=cos(x)");
check("2*y=cos(x) 含 x，走隐式", !r15c.err && r15c.implicit === true);
const r16 = P("y^2=x");
check("y^2=x 走隐式", !r16.err && r16.implicit === true);
const r17 = P("sin(x)/x");
check("普通函数不受影响", !r17.err && !r17.implicit);
const bad = P("sin(");
check("括号未闭合报错", !!bad.err, JSON.stringify(bad.err));
const bad2 = P("x^2+y^2=foo(x)");
check("未知函数报错", !!bad2.err && /未知函数|无法识别/.test(bad2.err), bad2.err);

console.log("\n== 图例区分函数 / 方程 ==");
check("函数图例含（函数）", box.legendLabel("f", { node: r5.node }).indexOf("（函数）") >= 0, box.legendLabel("f", r5));
check("方程图例含（方程）", box.legendLabel("f", r1).indexOf("（方程）") >= 0, box.legendLabel("f", r1));
check("方程图例用原文", box.legendLabel("g", r3).indexOf("x") >= 0 && box.legendLabel("g", r3).indexOf("y") >= 0);

console.log("\n== marching squares ==");
check("msCount 有上限", box.msCount(460, 300)[0] <= 260 && box.msCount(460, 300)[1] <= 220);
check("msCount 有下限", box.msCount(50, 40)[0] >= 24);
const d0 = box.msCount(460, 300);
check("步长约 2 像素", Math.abs(460 / d0[0] - 2) < 0.5, "x 步长 " + (460 / d0[0]).toFixed(2));

// 直接跑页面里真正的 marchingSquares（不复制 msCell，免得和源文件跑偏）
function runMS(node, win) {
  const pts = [];
  let segs = 0;
  const ctx = {
    save() {}, restore() {}, beginPath() {}, stroke() {},
    moveTo(x, y) { pts.push([x, y]); },
    lineTo(x, y) { pts.push([x, y]); }
  };
  P2.xmin = win[0]; P2.xmax = win[1]; P2.ymin = win[2]; P2.ymax = win[3];
  P2.w = 460; P2.h = 300;
  const spanX = P2.xmax - P2.xmin, spanY = P2.ymax - P2.ymin;
  P2.box = {
    X: (x) => (x - P2.xmin) / spanX * P2.w,
    Y: (y) => P2.h - (y - P2.ymin) / spanY * P2.h,
    Xinv: (px) => P2.xmin + (px / P2.w) * spanX,
    Yinv: (py) => P2.ymax - (py / P2.h) * spanY
  };
  segs = box.marchingSquares(ctx, node, "#000");
  return { segs, pts, w: P2.w, h: P2.h, xmin: P2.xmin, xmax: P2.xmax, ymin: P2.ymin, ymax: P2.ymax };
}
const WIN = [-6, 6, -3.9, 3.9];
function toData(p, r) {
  const x = r.xmin + (p[0] / r.w) * (r.xmax - r.xmin);
  const y = r.ymax - (p[1] / r.h) * (r.ymax - r.ymin);
  return [x, y];
}
const rr = runMS(r1.node, WIN);
check("圆画出一圈线段（>100 段）", rr.segs > 100, rr.segs + " 段");
// 相邻线段的端点应当重合（否则等值线会画成虚线）
function connectReport(r) {
  const key = (p) => p[0].toFixed(3) + "," + p[1].toFixed(3);
  const used = new Set();
  let joined = 0, total = r.segs;
  for (let k = 0; k + 1 < r.pts.length; k += 2) {
    const a = key(r.pts[k]), b = key(r.pts[k + 1]);
    used.add(a); used.add(b);
  }
  // 统计端点出现次数：内部衔接点会出现 2 次，孤立端点 1 次
  const cnt = new Map();
  for (let k = 0; k + 1 < r.pts.length; k += 2) {
    for (const p of [r.pts[k], r.pts[k + 1]]) {
      const kk = key(p);
      cnt.set(kk, (cnt.get(kk) || 0) + 1);
    }
  }
  for (const v of cnt.values()) if (v === 2) joined++;
  let len = 0;
  for (let k = 0; k + 1 < r.pts.length; k += 2) {
    len += Math.hypot(r.pts[k + 1][0] - r.pts[k][0], r.pts[k + 1][1] - r.pts[k][1]);
  }
  const interp = new Set();
  for (const p of r.pts) interp.add(key(p));
  void used;
  return { total, joined, unique: interp.size, len: len.toFixed(1) };
}
const cr = connectReport(rr);
console.log("  dbg circle: segs=" + cr.total + " 内部衔接点=" + cr.joined +
  " 不同端点=" + cr.unique + " 总弧长=" + cr.len + " px（周长约 " + (2 * Math.PI * 2 * (rr.w / 12)).toFixed(0) + " px）");
let maxDev = 0, onCircle = 0;
for (const p of rr.pts) {
  const d = toData(p, rr);
  const dev = Math.abs(Math.hypot(d[0], d[1]) - 2);
  if (dev > maxDev) maxDev = dev;
  if (dev < 0.06) onCircle++;
}
check("每个端点都落在半径 2 的圆上（最大偏差 < 0.06）", maxDev < 0.06, "最大偏差 " + maxDev.toFixed(4));
check("端点基本都在圆上", rr.pts.length > 0 && onCircle / rr.pts.length > 0.98, onCircle + "/" + rr.pts.length);
const xs = rr.pts.map((p) => toData(p, rr)[0]);
check("圆的左右端点在 x=±2 附近",
  Math.abs(Math.max(...xs) - 2) < 0.1 && Math.abs(Math.min(...xs) + 2) < 0.1,
  Math.min(...xs).toFixed(3) + " ~ " + Math.max(...xs).toFixed(3));

const rh = runMS(r3.node, WIN);
let hypOk = 0, hypBad = 0;
for (const p of rh.pts) {
  const d = toData(p, rh);
  if (Math.abs(d[0] * d[1] - 1) < 0.08) hypOk++; else hypBad++;
}
check("双曲线 xy=1 端点满足 xy=1", rh.segs > 100 && hypOk / (hypOk + hypBad) > 0.97,
  rh.segs + " 段，" + hypOk + " 好 / " + hypBad + " 坏");

const segZero = runMS(C.parse("x^2+y^2+100"), WIN).segs;
check("没有零点的 F 不画线", segZero === 0, segZero + " 段");

// 极点过滤：1/(x*y)=1 不该在坐标轴上横贯一条假线
const rpNode = C.simplify(C.parse("1/(x*y)-1"));
const dbgCells = [];
const rp = runMS(rpNode, WIN);
let poleBad = 0, badSamples = [], hyperPts = 0;
for (const p of rp.pts) {
  const d = toData(p, rp);
  if (d[0] * d[1] > 0) { hyperPts++; continue; }     // 同号才是真支
  if (Math.abs(d[0] * d[1]) > 1e-9) {
    poleBad++;
    if (badSamples.length < 6) badSamples.push(d[0].toFixed(3) + "," + d[1].toFixed(3));
  }
}
check("1/(xy)=1 没有横贯屏幕的假线（只剩坐标轴断点）", poleBad === 0,
  poleBad + " 个穿轴端点 / 共 " + rp.pts.length + "  例: " + badSamples.join(" | "));
check("1/(xy)=1 的真实两支还在", hyperPts > 100, hyperPts + " 个同号端点");

// 一帧要够快
const t0 = Date.now();
for (let k = 0; k < 10; k++) runMS(r1.node, WIN);
const perFrame = (Date.now() - t0) / 10;
check("一帧 marching squares 够快（< 30 ms）", perFrame < 30, perFrame.toFixed(1) + " ms/帧");

const rpar = runMS(r5.node, WIN);
let parOk = 0;
for (const p of rpar.pts) {
  const d = toData(p, rpar);
  if (Math.abs(d[1] - d[0] * d[0]) < 0.15) parOk++;
}
check("y=x^2 的端点满足 y=x²", rpar.segs > 30 && parOk / rpar.pts.length > 0.95,
  rpar.segs + " 段，" + parOk + "/" + rpar.pts.length + " 在抛物线上");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

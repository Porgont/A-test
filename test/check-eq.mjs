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
const needed = ["hasVar", "sub", "countEq", "evalXY", "stripOuterParen", "parseExprNode",
  "parseExpr", "cleanErr", "parseEq", "msCount", "msMedian", "msSample", "msCell", "legendLabel",
  "prettyExpr", "supHTML", "unary", "sig6", "checkBrackets", "substVar", "safeEval", "errHTML"];
const src = needed.map(pick).join("\n");
/** 抠出页面脚本里的常量声明（var NAME = …;） */
function pickConst(name) {
  const m = new RegExp("var " + name + " = [^;]+;").exec(ui);
  if (!m) throw new Error("找不到常量 " + name);
  return m[0];
}
const consts = ["MS_STEP", "MS_BIG"].map(pickConst).join("\n");
const box = new Function("C", "el", consts + "\n" + src + "\nreturn {" + needed.join(",") +
  ",MS_STEP:MS_STEP,MS_BIG:MS_BIG};")(C, () => ({ innerHTML: "" }));

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
const F3 = box.sub(box.parseExprNode("2*y").node, box.parseExprNode("6").node);
console.log("  dbg F(0,0)=" + box.evalXY(F3, 0, 0) + " F(0,1)=" + box.evalXY(F3, 0, 1));
console.log("  dbg k=" + (box.evalXY(F3, 0, 1) - box.evalXY(F3, 0, 0)));
console.log("  dbg hasVar x=" + box.hasVar(box.parseExprNode("2*y").node, "x") + " y=" + box.hasVar(box.parseExprNode("2*y").node, "y"));
console.log("  dbg parseEq src >>>\n" + pick("parseEq") + "\n<<<");
console.log("  dbg 2*y=6 -> " + JSON.stringify(ry3, (k, v) => (typeof v === "object" && v && v.t ? "<" + v.t + ">" : v)));
check("2*y = 6 走显函数", !ry3.err && ry3.implicit !== true, JSON.stringify(ry3.err || "implicit"));

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

// 造一条假 canvas 上下文，数一数等值线画了多少段，并把端点收集起来验几何
function runMS(node, win) {
  const pts = [];
  let segs = 0;
  const path = { moveTo(x, y) { pts.push([x, y]); }, lineTo(x, y) { pts.push([x, y]); } };
  const w = 460, h = 300;
  const dims = box.msCount(w, h), mx = dims[0] + 1, my = dims[1] + 1;
  const xmin = win[0], xmax = win[1], ymin = win[2], ymax = win[3];
  const spanX = xmax - xmin, spanY = ymax - ymin;
  const vals = new Array(mx * my), iv = [], av = [];
  for (let j = 0; j < my; j++) {
    const y = ymax - spanY * j / dims[1];
    for (let i = 0; i < mx; i++) vals[j * mx + i] = box.msSample(node, xmin + spanX * i / dims[0], y, iv, av);
  }
  const skip = Math.min(1e7, Math.max(1e3, box.msMedian(av) * 64));
  for (let j = 0; j < dims[1]; j++)
    for (let i = 0; i < dims[0]; i++) segs += box.msCell(path, vals, i, j, mx, 0, 0, skip);
  return { segs, pts, w, h, dims, xmin, xmax, ymin, ymax };
}
const WIN = [-6, 6, -3.9, 3.9];
function toData(p, r) {
  const x = r.xmin + (p[0] / r.w) * (r.xmax - r.xmin);
  const y = r.ymax - (p[1] / r.h) * (r.ymax - r.ymin);
  return [x, y];
}
const rr = runMS(r1.node, WIN);
check("圆画出一圈线段（>100 段）", rr.segs > 100, rr.segs + " 段");
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
const rp = runMS(C.simplify(C.parse("1/(x*y)-1")), WIN);
let poleBad = 0;
for (const p of rp.pts) {
  const d = toData(p, rp);
  if (Math.abs(Math.abs(d[0] * d[1]) - 1) > 0.5) poleBad++;
}
check("1/(xy)=1 没有横贯屏幕的假线", poleBad === 0, poleBad + " 个越界端点 / 共 " + rp.pts.length);

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

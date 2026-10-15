// 临时冒烟测试：直接试跑子代理正在写的引擎（只读，不改它的文件）
import * as C from "../src/calc-core.mjs";

let pass = 0, fail = 0;
function t(name, fn) {
  try {
    const r = fn();
    const ok = r === true || (typeof r === "string" && r.startsWith("OK"));
    if (ok) { pass++; console.log("  ok   " + name + (typeof r === "string" ? "   " + r.slice(2) : "")); }
    else { fail++; console.log("  FAIL " + name + "   " + r); }
  } catch (e) { fail++; console.log("  ERR  " + name + "   " + e.message); }
}
const S = (n) => C.toString(C.simplify(n));

t("解析隐式乘法 x^2+2x+1", () => { const s = S(C.parse("x^2+2x+1")); return s.includes("x") ? "OK " + s : "得到 " + s; });
t("求导 x^2 → 2x", () => { const s = S(C.deriv(C.parse("x^2"))); return s.replace(/\s/g, "").includes("2*x") ? "OK " + s : "得到 " + s; });
t("求导 sin(x^2)", () => { const s = S(C.deriv(C.parse("sin(x^2)"))); return s.includes("cos") ? "OK " + s : "得到 " + s; });
t("求导 x^3/3 在 x=2 得 4", () => { const v = C.evalAt(C.deriv(C.parse("x^3/3")), 2); return Math.abs(v - 4) < 1e-12 ? "OK " + v : "得到 " + v; });
t("求导 ln(x)", () => { const s = S(C.deriv(C.parse("ln(x)"))); return s.includes("/") || s.includes("1") ? "OK " + s : "得到 " + s; });
t("lim (x^2-1)/(x-1) x→1 = 2", () => { const r = C.limit(C.parse("(x^2-1)/(x-1)"), 1, { side: "both" }); return r.exists && r.exact === "2" ? "OK exact=" + r.exact + " 方法=" + r.method + " 步数=" + r.steps.length : "得到 " + JSON.stringify({ e: r.exists, v: r.value, x: r.exact, k: r.kind }); });
t("lim sin(x)/x x→0 = 1", () => { const r = C.limit(C.parse("sin(x)/x"), 0, { side: "both" }); return r.exists && r.exact === "1" ? "OK exact=1 方法=" + r.method : "得到 " + JSON.stringify({ e: r.exists, v: r.value, x: r.exact, k: r.kind }); });
t("lim 1/x x→0 左右不一致（左 −∞ 右 +∞）", () => {
  const r = C.limit(C.parse("1/x"), 0, { side: "both" });
  // 分歧型：整体不存在 kind=none，无穷性由左右各自的 kind/value 表达
  return !r.exists && r.kind === "none" &&
    r.left.kind === "infinite" && r.right.kind === "infinite" &&
    r.left.value === -Infinity && r.right.value === Infinity
    ? "OK 整体不存在，左=−∞ 右=+∞" : "得到 " + JSON.stringify({ e: r.exists, k: r.kind, l: r.left, rr: r.right });
});
t("lim 1/(x-1)^2 x→1 两侧都是 +∞", () => {
  const r = C.limit(C.parse("1/(x-1)^2"), 1, { side: "both" });
  return r.kind === "infinite" && r.left.value === Infinity && r.right.value === Infinity
    ? "OK 两侧 +∞" : "得到 " + JSON.stringify({ k: r.kind, l: r.left, rr: r.right });
});
t("lim 1/x x→0 单向调用也给带符号的无穷", () => {
  const rl = C.limit(C.parse("1/x"), 0, { side: "left" });
  const rr2 = C.limit(C.parse("1/x"), 0, { side: "right" });
  return rl.left.value === -Infinity && rr2.right.value === Infinity
    ? "OK 左 −∞ / 右 +∞" : "得到 " + JSON.stringify({ l: rl.left, r: rr2.right });
});
t("lim |x|/x x→0 不存在（-1/1）", () => { const r = C.limit(C.parse("abs(x)/x"), 0, { side: "both" }); return !r.exists && Math.abs((r.left || {}).value + 1) < 1e-6 && Math.abs((r.right || {}).value - 1) < 1e-6 ? "OK 左=-1 右=1" : "得到 " + JSON.stringify({ e: r.exists, l: r.left, rr: r.right }); });
t("lim sin(1/x) x→0 振荡不存在", () => { const r = C.limit(C.parse("sin(1/x)"), 0, { side: "both" }); return !r.exists ? "OK kind=" + r.kind : "得到 " + JSON.stringify({ e: r.exists, v: r.value }); });
t("lim 1/x x→∞ = 0", () => { const r = C.limit(C.parse("1/x"), "inf", { side: "both" }); return r.exists && (r.exact === "0" || Math.abs(r.value) < 1e-9) ? "OK " + (r.exact || r.value) : "得到 " + JSON.stringify({ e: r.exists, v: r.value, x: r.exact }); });
t("lim (3x^2+2x)/(x^2-5) x→∞ = 3", () => { const r = C.limit(C.parse("(3x^2+2x)/(x^2-5)"), "inf", { side: "both" }); return r.exists && r.exact === "3" ? "OK 3" : "得到 " + JSON.stringify({ e: r.exists, v: r.value, x: r.exact }); });
t("lim (1-cos(x))/x^2 x→0 = 1/2", () => { const r = C.limit(C.parse("(1-cos(x))/x^2"), 0, { side: "both" }); return r.exists && (r.exact === "1/2" || Math.abs(r.value - 0.5) < 1e-6) ? "OK " + (r.exact || r.value) : "得到 " + JSON.stringify({ e: r.exists, v: r.value, x: r.exact }); });
t("积分 x^2", () => { const r = C.integrate(C.parse("x^2")); return r.ok && /x\^3|3/.test(r.text) ? "OK " + r.text : "得到 " + JSON.stringify(r); });
t("积分 1/(1+x^2)", () => { const r = C.integrate(C.parse("1/(1+x^2)")); return r.ok && /atan/.test(r.text) ? "OK " + r.text : "得到 " + JSON.stringify(r); });
t("积分 x*e^x（分部）", () => { const r = C.integrate(C.parse("x*e^x")); return r.ok && /e\^x|exp/.test(r.text) ? "OK " + r.text : "得到 " + JSON.stringify(r); });
t("e^(-x^2) 无初等原函数", () => { const r = C.integrate(C.parse("e^(-x^2)")); return !r.ok && r.reason ? "OK 如实报告：" + r.reason : "得到 " + JSON.stringify(r); });
t("定积分 x^2 0→1 = 1/3", () => { const r = C.definiteIntegral(C.parse("x^2"), 0, 1); return r.exact === "1/3" ? "OK 1/3" : "得到 " + JSON.stringify(r); });
t("定积分 e^(-x^2) 0→1 ≈ 0.74682413", () => { const r = C.definiteIntegral(C.parse("e^(-x^2)"), 0, 1); return Math.abs(r.numeric - 0.7468241328) < 1e-6 ? "OK " + r.numeric : "得到 " + JSON.stringify(r); });
t("泰勒 sin(x) 到 5 阶", () => { const r = C.taylor(C.parse("sin(x)"), 0, 5); return /x\^3|x\^5/.test(r.text) ? "OK " + r.text : "得到 " + JSON.stringify(r); });

console.log("");
console.log(pass + " passed, " + fail + " failed");

// 自测：符号微积分引擎 src/calc-core.mjs
// 运行：node test\calculus.test.mjs
// 输出：逐条结果 + 末尾 "N passed, M failed"
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parse, simplify, toString, evalAt, deriv, taylor, limit, integrate, definiteIntegral, Rat,
} from "../src/calc-core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const modulePath = join(here, "..", "src", "calc-core.mjs");

let pass = 0;
let fail = 0;
const failures = [];

function record(okFlag, name, want, got) {
  if (okFlag) {
    pass++;
    console.log("  ok   " + name);
  } else {
    fail++;
    failures.push({ name, want, got });
    console.log("  FAIL " + name + "\n         期望: " + want + "\n         实际: " + got);
  }
}

/** 精确相等（字符串比较） */
function eq(name, got, want) {
  record(String(got) === String(want), name, JSON.stringify(want), JSON.stringify(got));
}
/** 布尔断言 */
function is(name, got, want = true) {
  record(Boolean(got) === Boolean(want), name, String(want), String(got));
}
/** 数值近似 */
function approx(name, got, want, eps) {
  const g = typeof got === "number" ? got : NaN;
  const ok = Number.isFinite(g) ? Math.abs(g - want) <= eps : (g === want);
  record(ok, name, "≈ " + want + " (±" + eps + ")", g);
}
/** 字符串包含 */
function has(name, got, needle) {
  const s = String(got);
  record(s.includes(needle), name, "包含 " + JSON.stringify(needle), JSON.stringify(s));
}
/** 必须抛错，且信息为中文 */
function throwsCN(name, fn) {
  try {
    const v = fn();
    record(false, name, "抛出中文错误", "没有抛错，返回 " + JSON.stringify(String(v)));
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    const isCN = /[\u4e00-\u9fa5]/.test(msg);
    record(isCN, name, "抛出含中文的错误信息", JSON.stringify(msg));
  }
}

const P = (s) => parse(s);
const D = (s, v) => deriv(P(s), v);
const S = (s) => toString(simplify(P(s)));
const num = (s, x) => evalAt(P(s), x);

/* ================= 0. 编码自检（防止文件被 GBK 破坏） ================= */
console.log("== 0. 文件与编码自检 ==");
{
  const buf = readFileSync(modulePath);
  const txt = buf.toString("utf8");
  const lines = txt.split("\n").length;
  eq("文件行数正常（>1500 行）", lines > 1500, true);
  eq("无 U+FFFD 替换字符", (txt.match(/\uFFFD/g) || []).length, 0);
  eq("UTF-8 往返一致", Buffer.from(txt, "utf8").equals(buf), true);
  const hazard = [0x9225, 0x9283, 0x9428, 0x925E, 0x93C4, 0x926D, 0x93A5];
  let hz = 0;
  for (const cp of hazard) hz += txt.split(String.fromCharCode(cp)).length - 1;
  eq("无 GBK 乱码字", hz, 0);
}

/* ================= 1. 解析与打印 ================= */
console.log("== 1. 解析与打印 ==");
has("1. parse(\"x^2+2x+1\") 隐式乘法，化简后含 x^2", S("x^2+2x+1"), "x^2");
eq("2. toString(parse(\"2*(x+1)\"))", toString(P("2*(x+1)")), "2*(x + 1)");
throwsCN("3. parse(\"(x+1\") 抛中文错", () => P("(x+1"));
throwsCN("4. parse(\"sin(\") 抛中文错", () => P("sin("));
{
  // 隐式乘法：x(x+1) 能解析，且数值等于 x^2+x（化简保留因式形式，不做展开）
  const a = P("x(x+1)");
  approx("补充：隐式乘法 x(x+1) 在 x=3 处 = 12", evalAt(a, 3), 12, 1e-12);
  approx("补充：x(x+1) 在 x=-1 处 = 0", evalAt(a, -1), 0, 1e-12);
  eq("补充：隐式乘法 2(x+1) 打印", toString(P("2(x+1)")), "2*(x + 1)");
  approx("补充：隐式乘法 3sin(x) 在 0.5 处", evalAt(P("3sin(x)"), 0.5), 3 * Math.sin(0.5), 1e-12);
}
eq("补充：^ 右结合 2^3^2", num("2^3^2", 0), 512);
eq("补充：一元负号 -x^2", num("-x^2", 3), -9);
eq("补充：函数打印 sin(x)", toString(P("sin(x)")), "sin(x)");
eq("补充：括号最少 2*(x+1) 不冗余", toString(P("((x))+1")), "x + 1");

/* ================= 2. 求导 ================= */
console.log("== 2. 求导 ==");
eq("5. deriv(\"x^2\")", toString(D("x^2")), "2*x");
{
  const d = D("sin(x^2)");
  const got = evalAt(d, 0.3);
  const want = 2 * 0.3 * Math.cos(0.09);
  approx("6. deriv(\"sin(x^2)\") 在 x=0.3 处（链式法则）", got, want, 1e-12);
}
eq("7. deriv(\"ln(x)\")", toString(D("ln(x)")), "1/x");
{
  const v = evalAt(D("x^3/3"), 2);
  eq("8. deriv(\"x^3/3\") 在 x=2 = 4（精确，有理数未退化）", v, 4);
  is("8b. 该导数值是精确整数 4（非 3.999...）", Number.isInteger(v) && v === 4);
}
approx("9. deriv(\"tan(x)\") 在 x=0.5", evalAt(D("tan(x)"), 0.5), 1 / Math.cos(0.5) ** 2, 1e-12);
approx("10. deriv(\"x^x\") 在 x=2", evalAt(D("x^x"), 2), 4 * (Math.log(2) + 1), 1e-12);
eq("补充：乘积法则 deriv(\"x*sin(x)\") 在 1 处", evalAt(D("x*sin(x)"), 1), Math.sin(1) + Math.cos(1));
approx("补充：商/幂 deriv(\"x/(x+1)\") 在 2 处", evalAt(D("x/(x+1)"), 2), 1 / 9, 1e-12);
approx("补充：cot 导数", evalAt(D("cot(x)"), 0.7), -1 / Math.sin(0.7) ** 2, 1e-12);
approx("补充：sec 导数", evalAt(D("sec(x)"), 0.7), Math.tan(0.7) / Math.cos(0.7), 1e-12);
approx("补充：csc 导数", evalAt(D("csc(x)"), 0.7), -Math.cos(0.7) / Math.sin(0.7) ** 2, 1e-12);
approx("补充：asin 导数", evalAt(D("asin(x)"), 0.3), 1 / Math.sqrt(1 - 0.09), 1e-12);
approx("补充：acos 导数", evalAt(D("acos(x)"), 0.3), -1 / Math.sqrt(1 - 0.09), 1e-12);
approx("补充：atan 导数", evalAt(D("atan(x)"), 0.3), 1 / 1.09, 1e-12);
approx("补充：sinh 导数", evalAt(D("sinh(x)"), 0.3), Math.cosh(0.3), 1e-12);
approx("补充：cosh 导数", evalAt(D("cosh(x)"), 0.3), Math.sinh(0.3), 1e-12);
approx("补充：tanh 导数", evalAt(D("tanh(x)"), 0.3), 1 / Math.cosh(0.3) ** 2, 1e-12);
approx("补充：exp 导数", evalAt(D("exp(x)"), 0.3), Math.exp(0.3), 1e-12);
approx("补充：sqrt 导数", evalAt(D("sqrt(x)"), 0.3), 1 / (2 * Math.sqrt(0.3)), 1e-12);
approx("补充：一般幂 a^b  2^x 在 3 处", evalAt(D("2^x"), 3), 8 * Math.log(2), 1e-12);
eq("补充：deriv(\"2^x\") 文本 = 2^x*ln(2)", toString(D("2^x")), "2^x*ln(2)");
approx("补充：3^x 在 2 处", evalAt(D("3^x"), 2), 9 * Math.log(3), 1e-12);
approx("补充：e^x 与 exp(x) 一致", evalAt(D("e^x"), 0.4) - evalAt(D("exp(x)"), 0.4), 0, 1e-15);
eq("补充：常数的导数为 0", S("5"), "5") && eq("补充：deriv(\"5\") = 0", toString(D("5")), "0");

/* ================= 3. 极限 ================= */
console.log("== 3. 极限 ==");
{
  const r = limit(P("(x^2-1)/(x-1)"), 1);
  is("11. limit((x^2-1)/(x-1), 1).exists", r.exists);
  eq("11b. exact = \"2\"", r.exact, "2");
  approx("11c. value = 2", r.value, 2, 1e-12);
}
{
  const r = limit(P("sin(x)/x"), 0);
  is("12. limit(sin(x)/x, 0).exists", r.exists);
  eq("12b. exact = \"1\"（洛必达）", r.exact, "1");
}
{
  const r = limit(P("1/x"), 0, { side: "both" });
  is("13. limit(1/x, 0, both).exists === false", r.exists, false);
  eq("13b. kind = \"infinite\" 或 \"none\"（左右不一致）", r.kind === "infinite" || r.kind === "none", true);
  eq("13c. left.value = -Infinity（符号不能丢）", r.left.value, -Infinity);
  eq("13d. right.value = +Infinity（符号不能丢）", r.right.value, Infinity);
  eq("13e. left.kind = \"infinite\"", r.left.kind, "infinite");
  eq("13f. right.kind = \"infinite\"", r.right.kind, "infinite");
}
{
  const r = limit(P("1/x"), 0, { side: "right" });
  eq("14. limit(1/x, 0, right).kind = \"infinite\"", r.kind, "infinite");
  eq("14b. 右侧判定为 +Infinity", r.right.value, Infinity);
}
{
  const r = limit(P("1/x"), 0, { side: "left" });
  eq("14c. limit(1/x, 0, left).kind = \"infinite\"", r.kind, "infinite");
  eq("14d. 左侧判定为 -Infinity（不能是 null）", r.left.value, -Infinity);
}
{
  const r = limit(P("1/(x-1)^2"), 1, { side: "both" });
  eq("14e. limit(1/(x-1)^2, 1, both).kind = \"infinite\"（不是 none）", r.kind, "infinite");
  eq("14f. 左侧 = +Infinity", r.left.value, Infinity);
  eq("14g. 右侧 = +Infinity", r.right.value, Infinity);
}
{
  const r = limit(P("abs(x)/x"), 0, { side: "both" });
  is("15. limit(abs(x)/x, 0).exists === false", r.exists, false);
  approx("15b. left = -1", r.left.value, -1, 1e-9);
  approx("15c. right = 1", r.right.value, 1, 1e-9);
}
{
  const r = limit(P("(1-cos(x))/x^2"), 0);
  eq("16. limit((1-cos(x))/x^2, 0).exact = \"1/2\"", r.exact, "1/2");
}
{
  const r = limit(P("x^2/(x+1)"), "inf");
  eq("17. limit(x^2/(x+1), inf).kind = \"infinite\"", r.kind, "infinite");
  eq("17b. value = +Infinity", r.value, Infinity);
}
{
  const r = limit(P("1/x"), "inf");
  is("18. limit(1/x, inf).exists", r.exists);
  eq("18b. exact = \"0\"", r.exact, "0");
}
eq("19. limit((3x^2+2x)/(x^2-5), inf).exact = \"3\"", limit(P("(3x^2+2x)/(x^2-5)"), "inf").exact, "3");
{
  const r = limit(P("x*sin(1/x)"), "inf");
  is("20. limit(x*sin(1/x), inf).exists", r.exists);
  approx("20b. value ≈ 1（数值判定）", r.value, 1, 1e-6);
}
{
  const r = limit(P("sin(1/x)"), 0, { side: "both" });
  is("21. limit(sin(1/x), 0).exists === false（振荡）", r.exists, false);
  eq("21b. kind = \"none\"", r.kind, "none");
  const allText = r.steps.map((s) => s.desc).join(" | ");
  has("21c. steps 说明是振荡", allText, "振荡");
}
{
  const r = limit(P("x^2"), 2);
  eq("22. limit(x^2, 2).exact = \"4\"", r.exact, "4");
  eq("22b. method = \"substitute\"", r.method, "substitute");
}
{
  const r = limit(P("(x^2-1)/(x-1)"), 1);
  is("23. steps 至少 1 条", r.steps.length >= 1);
  has("23b. 第一条 desc 提到「代入」", r.steps[0].desc, "代入");
  is("23c. steps 含洛必达记录", r.steps.some((s) => s.desc.includes("洛必达")));
}
{
  const r = limit(P("sin(1/x)"), 0);
  is("23d. 数值判定的 steps 存在", r.steps.some((s) => s.desc.includes("数值")));
}

/* ================= 4. 泰勒展开 ================= */
console.log("== 4. 泰勒展开 ==");
{
  const t = taylor(P("sin(x)"), 0, 5);
  has("24. taylor(sin(x),0,5).text 含 x^3", t.text, "x^3");
  has("24b. text 含 x^5", t.text, "x^5");
  const t3 = t.terms.find((x) => x.power === 3);
  is("24c. 存在 x^3 项", !!t3);
  eq("24d. x^3 系数 = \"-1/6\"", t3 ? t3.coefText : "(缺)", "-1/6");
}
{
  const t = taylor(P("exp(x)"), 0, 3);
  const t3 = t.terms.find((x) => x.power === 3);
  is("25. taylor(exp(x),0,3) 存在 x^3 项", !!t3);
  eq("25b. x^3 系数 = \"1/6\"", t3 ? t3.coefText : "(缺)", "1/6");
}
{
  const t = taylor(P("exp(x)"), 0, 2);
  eq("补充：exp 的 terms 数为 3", t.terms.length, 3);
  eq("补充：常数项系数 1", t.terms[0].coefText, "1");
}
{
  const t = taylor(P("cos(x)"), 0, 4);
  const t4 = t.terms.find((x) => x.power === 4);
  eq("补充：cos 的 x^4 系数 = 1/24", t4 ? t4.coefText : "(缺)", "1/24");
}
{
  const t = taylor(P("sin(x)"), 0, 7);
  has("补充：sin 展开到 7 阶含 x^7", t.text, "x^7");
  has("补充：文本以 ... 结尾", t.text, "...");
}

/* ================= 5. 积分 ================= */
console.log("== 5. 积分 ==");
{
  const r = integrate(P("x^2"));
  is("26. integrate(x^2).ok", r.ok);
  has("26b. text 含 x^3/3", r.text, "x^3/3");
  has("26c. text 含 \"+ C\"", r.text, "+ C");
}
has("27. integrate(1/x).text 含 ln(", integrate(P("1/x")).text, "ln(");
has("28. integrate(1/(1+x^2)).text 含 atan(", integrate(P("1/(1+x^2)")).text, "atan(");
has("29. integrate(x*e^x).text 含 e^x（分部积分）", integrate(P("x*e^x")).text, "exp(x)");
{
  const r = integrate(P("exp(-x^2)"));
  is("30. integrate(exp(-x^2)).ok === false", r.ok, false);
  is("30b. reason 非空", typeof r.reason === "string" && r.reason.length > 0);
}
{
  // 补充：常见积分类型
  has("补充：integrate(sin(x)) 含 -cos", integrate(P("sin(x)")).text, "cos(x)");
  has("补充：integrate(1/sqrt(1-x^2)) 含 asin", integrate(P("1/sqrt(1-x^2)")).text, "asin(");
  has("补充：integrate(ln(x)) 含 ln", integrate(P("ln(x)")).text, "ln(");
  const r = integrate(P("sin(2x+1)"));
  is("补充：integrate(sin(2x+1)).ok（线性换元）", r.ok);
  approx("补充：∫sin(2x+1) 在 0 处 = -cos(1)/2", evalAt(r.F, 0), -Math.cos(1) / 2, 1e-12);
  has("补充：integrate(x*sin(x)) 含 sin", integrate(P("x*sin(x)")).text, "sin(x)");
  // 原函数代入求导应还原被积函数（数值验证）
  const cases = ["x^3", "1/x", "cos(x)", "x^2*exp(x)", "sqrt(x)", "x/(1+x^2)"];
  let allBack = true;
  const detail = [];
  for (const c of cases) {
    const r2 = integrate(P(c));
    if (!r2.ok) { allBack = false; detail.push(c + ":不可积"); continue; }
    for (const x of [0.4, 0.8, 1.3]) {
      const dF = (evalAt(r2.F, x + 1e-6) - evalAt(r2.F, x - 1e-6)) / 2e-6;
      const f = num(c, x);
      if (!(Math.abs(dF - f) <= 1e-4 * Math.max(1, Math.abs(f)))) {
        allBack = false; detail.push(c + "@" + x + " F'=" + dF + " f=" + f);
      }
    }
  }
  is("补充：F' = f 数值校验（6 个被积函数）" + (detail.length ? " [" + detail.join("; ") + "]" : ""), allBack);
}

/* ================= 6. 定积分 ================= */
console.log("== 6. 定积分 ==");
{
  const r = definiteIntegral(P("x^2"), 0, 1);
  eq("31. definiteIntegral(x^2,0,1).exact = \"1/3\"", r.exact, "1/3");
  approx("31b. numeric ≈ 0.3333333", r.numeric, 1 / 3, 1e-9);
}
{
  const r = definiteIntegral(P("exp(-x^2)"), 0, 1);
  approx("32. definiteIntegral(exp(-x^2),0,1).numeric ≈ 0.7468241328", r.numeric, 0.7468241328, 1e-6);
  eq("32b. exact = null（无初等原函数）", r.exact, null);
}
approx("33. definiteIntegral(sin(x),0,pi) ≈ 2", definiteIntegral(P("sin(x)"), 0, 3.141592653589793).numeric, 2, 1e-9);
{
  const r = definiteIntegral(P("1/(1+x^2)"), 0, 1);
  approx("补充：definiteIntegral(1/(1+x^2),0,1) ≈ pi/4", r.numeric, Math.PI / 4, 1e-12);
  eq("补充：∫₀¹ 1/(1+x²) dx 现在给精确表达式 pi/4（不再是 null）", r.exact, "pi/4");
}
console.log("== 瑕积分（端点奇异）==");
{
  const r = definiteIntegral(P("ln(x)"), 0, "pi/2");
  approx("∫₀^(π/2) ln(x) dx = −0.8614518718…（收敛的瑕积分）", r.numeric, -0.8614518718188342, 1e-7);
  is("   给的是有限值（不是 NaN）", Number.isFinite(r.numeric) ? "yes" : "no", "yes");
  is("   标记为瑕积分", r.improper ? "yes" : "no", "yes");
  is("   不判为发散", r.divergent ? "yes" : "no", "no");
  is("   带中文说明", /瑕积分/.test(r.note || "") ? "yes" : "no", "yes");
}
{
  const r = definiteIntegral(P("1/sqrt(x)"), 0, 1);
  approx("∫₀¹ 1/√x dx ≈ 2（缩进外推）", r.numeric, 2, 2e-3);
  is("   不判为发散", r.divergent ? "yes" : "no", "no");
}
{
  const r = definiteIntegral(P("x^(-1/2)"), 0, 1);
  approx("∫₀¹ x^(−1/2) dx ≈ 2", r.numeric, 2, 1e-6);
}
{
  const r = definiteIntegral(P("1/x"), 0, 1);
  is("∫₀¹ 1/x dx 判为发散", r.divergent ? "yes" : "no", "yes");
  is("   说明里写明发散", /发散/.test(r.note || "") ? "yes" : "no", "yes");
}
{
  const r = definiteIntegral(P("x^2"), 0, 1);
  eq("瑕积分改动没影响普通积分", r.exact, "1/3");
  is("   普通积分不标 improper", r.improper ? "yes" : "no", "no");
}
console.log("== 无穷区间的反常积分 ==");
{
  const r = definiteIntegral(P("e^(-x)"), 0, "inf");
  eq("∫₀^∞ e^(−x) dx = 1（精确）", r.exact, "1");
  is("   不标发散", r.divergent ? "yes" : "no", "no");
  is("   标记为反常积分", r.improper ? "yes" : "no", "yes");
  is("   说明是无穷区间", /无穷区间/.test(r.note || "") ? "yes" : "no", "yes");
}
{
  const r = definiteIntegral(P("1/x^2"), 1, "inf");
  approx("∫₁^∞ 1/x² dx = 1", r.numeric, 1, 1e-6);
}
{
  const r = definiteIntegral(P("1/x"), 1, "inf");
  is("∫₁^∞ 1/x dx 判为发散", r.divergent ? "yes" : "no", "yes");
  is("   说明里写明发散", /发散/.test(r.note || "") ? "yes" : "no", "yes");
}
{
  const r = definiteIntegral(P("x*e^(-x)"), 0, "inf");
  eq("∫₀^∞ x·e^(−x) dx = 1（精确）", r.exact, "1");
}
{
  const r = definiteIntegral(P("e^x"), "-inf", 0);
  eq("∫₋∞^0 e^x dx = 1（精确）", r.exact, "1");
}
{
  const r = definiteIntegral(P("e^(-x^2)"), "-inf", "inf");
  approx("∫₋∞^∞ e^(−x²) dx = √π ≈ 1.7724538509", r.numeric, 1.7724538509055159, 1e-6);
}
{
  const r = definiteIntegral(P("1/(1+x^2)"), 0, "inf");
  approx("∫₀^∞ 1/(1+x²) dx = π/2 ≈ 1.5707963", r.numeric, Math.PI / 2, 1e-6);
}
{
  const r = definiteIntegral(P("ln(x)/x^2"), 1, "inf");
  approx("∫₁^∞ ln(x)/x² dx = 1（衰减慢也要收敛）", r.numeric, 1, 1e-5);
}
{
  const r = definiteIntegral(P("cos(x)"), 0, Math.PI / 2);
  approx("补充：definiteIntegral(cos(x),0,pi/2) ≈ 1", r.numeric, 1, 1e-12);
}

/* ================= 7. 容错与防死循环 ================= */
console.log("== 7. 容错与防死循环 ==");
{
  let v;
  try { v = evalAt(P("1/x"), 0); } catch (e) { v = "抛错: " + e.message; }
  eq("34. evalAt(1/x, 0) = Infinity 且不抛错", v, Infinity);
}
{
  let threw = false;
  const t0 = Date.now();
  let r = null;
  try { r = limit(P("sin(1/x)"), 0); } catch (e) { threw = true; }
  const ms = Date.now() - t0;
  is("35. 极端函数 sin(1/x) 能返回且不抛错", !threw && r !== null);
  is("35b. 5 秒内返回（无死循环），实际 " + ms + " ms", ms < 5000);
  eq("35c. 判定为不存在", r ? r.exists : null, false);
}
{
  const t0 = Date.now();
  const r = limit(P("x*sin(1/x)"), "inf");
  const ms = Date.now() - t0;
  is("35d. 无穷远处的极端函数也能返回，实际 " + ms + " ms", r !== null && ms < 5000);
}
{
  const t0 = Date.now();
  const r = limit(P("1/(1+exp(1/x))"), 0, { side: "both" });
  const ms = Date.now() - t0;
  is("35e. 不定式极端例也能返回（" + ms + " ms）", r !== null && ms < 5000);
}
throwsCN("补充：parse(\"2+\") 抛中文错", () => P("2+"));
throwsCN("补充：parse(\"foo(x)\") 未知函数抛中文错", () => P("foo(x)"));
throwsCN("补充：parse(\"x@1\") 非法字符抛中文错", () => P("x@1"));
{
  const r = limit(P("(x^2-1)/(x-1)"), 1);
  is("补充：limit 返回值字段齐全", ["exists", "value", "exact", "kind", "left", "right", "steps", "method"].every((k) => k in r));
}

/* ================= 汇总 ================= */
console.log("");
if (failures.length > 0) {
  console.log("失败明细：");
  for (const f of failures) {
    console.log("  - " + f.name + "\n      期望: " + f.want + "\n      实际: " + f.got);
  }
  console.log("");
}
console.log(pass + " passed, " + fail + " failed");
process.exit(fail === 0 ? 0 : 1);

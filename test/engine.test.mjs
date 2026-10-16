// Engine tests for the linear algebra calculator.
// The engine lives inside 线代计算器/index.html between the ENGINE markers;
// this script extracts that block and runs it in Node.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, "..", "algebra.html");
const html = readFileSync(htmlPath, "utf8");
const parts = html.split("/* ==== ENGINE START ==== */");
const tail = parts[1] ? parts[1].split("/* ==== ENGINE END ==== */")[0] : "";
if (!tail.trim()) {
  console.error("ENGINE block not found in " + htmlPath);
  process.exit(2);
}
const L = new Function(tail + "\nreturn LinAlg;")();
const { F, matAdd, matSub, matMul, scaleMat, transpose, trace, det, rref, ref, rank, inverse, solve, eigen, nullspaceBasis, colspaceBasis, generalSolution, rowSteps, eyeFrac } = L;

let pass = 0;
let fail = 0;
function ok(name, got, want) {
  const g = String(got);
  const w = String(want);
  if (g === w) { pass++; console.log("  ok   " + name + " = " + g); }
  else { fail++; console.log("  FAIL " + name + "  got <" + g + ">  want <" + w + ">"); }
}
function approx(name, got, want, eps = 1e-7) {
  if (Math.abs(got - want) <= eps) { pass++; console.log("  ok   " + name + " = " + got); }
  else { fail++; console.log("  FAIL " + name + "  got <" + got + ">  want ~<" + want + ">"); }
}
function throws(name, fn) {
  try { fn(); fail++; console.log("  FAIL " + name + "  expected an error"); }
  catch (e) { pass++; console.log("  ok   " + name + "  threw: " + e.message); }
}
function M(rows) { return rows.map((r) => r.map((v) => F(v))); }
function ms(m) { return m.map((r) => r.map((v) => v.toString()).join(",")).join(";"); }
function vs(v) { return v.map((x) => x.toString()).join(";"); }

console.log("== 分数 ==");
ok("1/3 + 1/6", F("1/3").add(F("1/6")), "1/2");
ok("0.25", F("0.25"), "1/4");
ok("-2.5", F("-2.5"), "-5/2");
ok("3/4 * 2/3", F("3/4").mul(F("2/3")), "1/2");
ok("空输入 = 0", F("  "), "0");
ok("全角减号", F("−1/2"), "-1/2");
ok("指数写法", F("1e-2"), "1/100");
throws("除以 0", () => F("1/2").div(F("0")));
throws("分母为 0", () => F("1/0"));
throws("乱输", () => F("abc"));

console.log("== 矩阵基本运算 ==");
ok("A + B", ms(matAdd(M([[1, 2], [3, 4]]), M([[5, 6], [7, 8]]))), "6,8;10,12");
ok("A − B", ms(matSub(M([[1, 2], [3, 4]]), M([[1, 1], [1, 1]]))), "0,1;2,3");
ok("2×3 · 3×2", ms(matMul(M([[1, 2, 3], [4, 5, 6]]), M([[7, 8], [9, 10], [11, 12]]))), "58,64;139,154");
ok("分数乘法", ms(matMul(M([["1/2"]]), M([["2/3"]]))), "1/3");
ok("k · A", ms(scaleMat(M([[1, 2], [3, 4]]), "1/2")), "1/2,1;3/2,2");
ok("转置", ms(transpose(M([[1, 2, 3], [4, 5, 6]]))), "1,4;2,5;3,6");
ok("迹", trace(M([[1, 2], [3, 4]])), "5");
throws("尺寸不同的加法", () => matAdd(M([[1, 2]]), M([[1], [2]])));
throws("列数不匹配的乘法", () => matMul(M([[1, 2]]), M([[1, 2]])));

console.log("== 行列式 ==");
ok("det 2×2", det(M([[1, 2], [3, 4]])), "-2");
ok("det 3×3", det(M([[6, 1, 1], [4, -2, 5], [2, 8, 7]])), "-306");
ok("det 奇异", det(M([[1, 2], [2, 4]])), "0");
ok("det 1×1", det(M([[5]])), "5");
ok("det 换行求主元", det(M([[0, 1], [1, 0]])), "-1");
ok("det 4 阶单位阵", det(M([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])), "1");
throws("非方阵行列式", () => det(M([[1, 2, 3], [4, 5, 6]])));

console.log("== 逆矩阵 ==");
ok("2×2 逆", ms(inverse(M([[4, 7], [2, 6]]))), "3/5,-7/10;-1/5,2/5");
ok("对角阵逆", ms(inverse(M([[2, 0, 0], [0, 3, 0], [0, 0, 4]]))), "1/2,0,0;0,1/3,0;0,0,1/4");
throws("奇异矩阵求逆", () => inverse(M([[1, 2], [2, 4]])));

console.log("== 秩与 RREF ==");
ok("rank 3×3", rank(M([[1, 2, 3], [4, 5, 6], [7, 8, 9]])), "2");
ok("rank 单位阵", rank(M([[1, 0, 0], [0, 1, 0], [0, 0, 1]])), "3");
ok("rank 零矩阵", rank(M([[0, 0, 0], [0, 0, 0]])), "0");
ok("RREF 2×2", ms(rref(M([[1, 2], [3, 4]])).R), "1,0;0,1");
ok("RREF 2×3", ms(rref(M([[1, 2, 3], [4, 5, 6]])).R), "1,0,-1;0,1,2");

console.log("== 解方程组 ==");
ok("唯一解", vs(solve(M([[2, 1], [1, 3]]), M([[3], [5]])).x), "4/5;7/5");
ok("唯一解 2", vs(solve(M([[1, 2], [3, 4]]), M([[5], [6]])).x), "-4;9/2");
ok("无解", solve(M([[1, 1], [1, 1]]), M([[1], [2]])).type, "none");
ok("无穷多解", solve(M([[1, 2], [2, 4]]), M([[3], [6]])).type, "infinite");
ok("自由变量个数", solve(M([[1, 2], [2, 4]]), M([[3], [6]])).free, "1");
ok("特解", vs(solve(M([[1, 2], [2, 4]]), M([[3], [6]])).x), "3;0");
throws("b 不是一列", () => solve(M([[1, 0], [0, 1]]), M([[1, 2], [3, 4]])));
throws("b 行数不符", () => solve(M([[1, 0], [0, 1]]), M([[1], [2], [3]])));

console.log("== 特征值 ==");
ok("对称 2×2 精确解", eigen(M([[2, 1], [1, 2]])).map((r) => r.exact.toString()).sort().join(","), "1,3");
ok("非对称 2×2 精确解", eigen(M([[4, 1], [2, 3]])).map((r) => r.exact.toString()).sort().join(","), "2,5");
ok("三角阵 2×2 精确解", eigen(M([[1, 1], [0, 2]])).map((r) => r.exact.toString()).sort().join(","), "1,2");
ok("旋转矩阵实部为 0", eigen(M([[0, -1], [1, 0]])).map((r) => r.re.toFixed(6)).join(","), "0.000000,0.000000");
approx("旋转矩阵虚部 +1", eigen(M([[0, -1], [1, 0]])).map((r) => r.im).sort((a, b) => a - b)[1], 1);
{
  const r = eigen(M([[2, 0, 0], [0, 3, 0], [0, 0, 4]])).map((x) => x.re).sort((a, b) => a - b);
  approx("对角 3 阶 λ1", r[0], 2);
  approx("对角 3 阶 λ2", r[1], 3);
  approx("对角 3 阶 λ3", r[2], 4);
}
{
  const r = eigen(M([[1, 1, 0], [0, 2, 0], [0, 0, 3]])).map((x) => x.re).sort((a, b) => a - b);
  approx("上三角 3 阶 λ1", r[0], 1);
  approx("上三角 3 阶 λ2", r[1], 2);
  approx("上三角 3 阶 λ3", r[2], 3);
}
throws("非方阵特征值", () => eigen(M([[1, 2, 3], [4, 5, 6]])));

console.log("== REF 行阶梯形（主元下方清零、不归一） ==");
ok("REF 2×2", ms(ref(M([[1, 2], [3, 4]])).R), "1,2;0,-2");
ok("REF 秩亏", ms(ref(M([[2, 4], [1, 2]])).R), "2,4;0,0");
ok("REF 3×3", ms(ref(M([[1, 2, 3], [4, 5, 6], [7, 8, 9]])).R), "1,2,3;0,-3,-6;0,0,0");
ok("REF 主元不归一（对比 RREF）", ref(M([[2, 1], [1, 3]])).R[0][0].toString(), "2");
ok("REF 的秩", ref(M([[1, 2, 3], [4, 5, 6], [7, 8, 9]])).rank, "2");
ok("RREF 同一矩阵：主元归一", ms(rref(M([[2, 1], [1, 3]])).R), "1,0;0,1");
ok("REF 下方为 0", ref(M([[2, 1], [1, 3]])).R[1][0].toString(), "0");

console.log("== 零空间 ker 与列空间 col ==");
ok("ker 满秩为空", nullspaceBasis(M([[1, 0], [0, 1]])).dim, "0");
ok("ker 2×2 秩 1", vs(nullspaceBasis(M([[1, 2], [2, 4]])).basis[0]), "-2;1");
ok("ker 2×3 基向量", vs(nullspaceBasis(M([[1, 2, 3], [4, 5, 6]])).basis[0]), "1;-2;1");
ok("ker 维数 = 自由变量数", nullspaceBasis(M([[1, 2, 3], [4, 5, 6]])).dim, "1");
ok("col 维数 = 秩", colspaceBasis(M([[1, 2, 3], [4, 5, 6]])).dim, "2");
ok("col 取主元列 1", vs(colspaceBasis(M([[1, 2, 3], [4, 5, 6]])).basis[0]), "1;4");
ok("col 取主元列 2", vs(colspaceBasis(M([[1, 2, 3], [4, 5, 6]])).basis[1]), "2;5");
ok("col 秩亏时只取一列", vs(colspaceBasis(M([[1, 2], [2, 4]])).basis[0]), "1;2");

console.log("== 通解（向量形式：特解 + 齐次基） ==");
{
  const g = generalSolution(M([[2, 1], [1, 3]]), M([[3], [5]]));
  ok("唯一解 · 类型", g.type, "unique");
  ok("唯一解 · 特解", vs(g.particular), "4/5;7/5");
  ok("唯一解 · 基为空", g.basis.length, "0");
}
{
  const g = generalSolution(M([[1, 2], [2, 4]]), M([[3], [6]]));
  ok("无穷多解 · 类型", g.type, "infinite");
  ok("无穷多解 · 特解", vs(g.particular), "3;0");
  ok("无穷多解 · 齐次基", vs(g.basis[0]), "-2;1");
  ok("无穷多解 · 自由变量数", g.free, "1");
}
{
  const g = generalSolution(M([[1, 2, 3], [2, 4, 6]]), M([[1], [2]]));
  ok("2×3 · 自由变量数", g.free, "2");
  ok("2×3 · 基向量个数", g.basis.length, "2");
  ok("2×3 · 基向量 1", vs(g.basis[0]), "-2;1;0");
  ok("2×3 · 基向量 2", vs(g.basis[1]), "-3;0;1");
  ok("2×3 · 特解", vs(g.particular), "1;0;0");
}
{
  const g = generalSolution(M([[1, 1], [1, 1]]), M([[1], [2]]));
  ok("无解 · 类型", g.type, "none");
}

console.log("== 初等行变换步骤与初等矩阵 ==");
{
  const A = M([[1, 2], [3, 4]]);
  const rs = rowSteps(A);
  ok("步骤化到行最简形", ms(rs.R), "1,0;0,1");
  ok("累积 E 等于 A 的逆", ms(rs.E), ms(inverse(A)));
  ok("E · A = 结果", ms(matMul(rs.E, A)), ms(rs.R));
  ok("每步都附了初等矩阵", rs.steps.every((s) => s.Ei && s.Ei.length === 2) ? "yes" : "no", "yes");
  ok("每步初等矩阵左乘后结果一致",
    rs.steps.every((s, i) => {
      const before = i === 0 ? A : rs.steps[i - 1].R;
      return ms(matMul(s.Ei, before)) === ms(s.R);
    }) ? "yes" : "no", "yes");
}
{
  const A = M([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  const rs = rowSteps(A);
  ok("奇异矩阵步骤结果 = RREF", ms(rs.R), ms(rref(A).R));
  ok("奇异矩阵 E · A = 结果", ms(matMul(rs.E, A)), ms(rs.R));
  ok("奇异矩阵也有步骤", rs.steps.length > 0 ? "yes" : "no", "yes");
}
{
  const A = M([[0, 1], [1, 0]]);
  const rs = rowSteps(A);
  ok("需要换行时有 swap 步骤", rs.steps.some((s) => s.kind === "swap") ? "yes" : "no", "yes");
  ok("换行后仍得到行最简形", ms(rs.R), "1,0;0,1");
}
ok("单位阵生成", ms(eyeFrac(3)), "1,0,0;0,1,0;0,0,1");

console.log("== 符号矩阵（字母当数用） ==");
{
  const S = (t) => L.val(t);
  const SM = (rows) => rows.map((r) => r.map(S));
  const symMat = (m) => m.map((r) => r.map((v) => v.toString()).join(",")).join(";");
  const symVec = (v) => v.map((x) => x.toString()).join(",");

  ok("det[[a,1],[1,a]] = a^2 - 1（符号不能弄错）", symMat([[det(SM([["a", "1"], ["1", "a"]]))]]), "a^2 - 1");
  ok("det[[a,b],[c,d]] = a*d - b*c", symMat([[det(SM([["a", "b"], ["c", "d"]]))]]), "a*d - b*c");
  ok("det 3 阶符号：对角阵 a,b,c → a*b*c", symMat([[det(SM([["a", "0", "0"], ["0", "b", "0"], ["0", "0", "c"]]))]]), "a*b*c");
  ok("符号加法 A+B", symMat(matAdd(SM([["a", "1"], ["0", "b"]]), SM([["1", "2"], ["3", "4"]]))), "a + 1,3;3,b + 4");
  ok("符号乘法 A×B", symMat(matMul(SM([["a", "1"], ["0", "b"]]), SM([["1", "2"], ["3", "4"]]))), "a + 3,2*a + 4;3*b,4*b");
  ok("符号数乘 k=a", symMat(scaleMat(SM([["1", "2"], ["3", "4"]]), S("a"))), "a,2*a;3*a,4*a");
  ok("符号转置", symMat(transpose(SM([["a", "2"], ["3", "b"]]))), "a,3;2,b");
  ok("符号迹", trace(SM([["a", "2"], ["3", "b"]])).toString(), "a + b");
  ok("混合：数字与字母一起算", symMat(matMul(SM([["a", "0"], ["0", "1"]]), M([[2, 3], [4, 5]]))), "2*a,3*a;4,5");
  {
    let msg = "no error";
    try { rref(SM([["a", "1"], ["1", "a"]])); } catch (e) { msg = /符号/.test(e.message) ? "中文报错" : "别的错"; }
    ok("符号主元做 RREF 会中文报错（不猜零）", msg, "中文报错");
  }
  {
    let msg = "no error";
    try { inverse(SM([["a", "1"], ["1", "a"]])); } catch (e) { msg = /符号/.test(e.message) ? "中文报错" : "别的错"; }
    ok("符号矩阵求逆会中文报错", msg, "中文报错");
  }
}

console.log("== 增广矩阵求解 [A|b] ==");
{
  const S = (t) => L.val(t);
  const SM = (rows) => rows.map((r) => r.map(S));
  const r1 = L.augSolve(SM([["1", "2", "3"], ["2", "4", "6"]]));
  ok("[[1,2,3],[2,4,6]] 无穷多解", r1.type, "infinite");
  ok("   rankA = 1", r1.rankA, 1);
  ok("   rank[A|b] = 1", r1.rankAug, 1);
  ok("   自由变量 1 个", r1.free, 1);
  const r2 = L.augSolve(SM([["1", "1", "2"], ["1", "1", "3"]]));
  ok("[[1,1,2],[1,1,3]] 无解", r2.type, "none");
  ok("   rankA=1 而 rank[A|b]=2", r2.rankA + "/" + r2.rankAug, "1/2");
  const r3 = L.augSolve(SM([["2", "1", "5"], ["1", "3", "10"]]));
  ok("[[2,1,5],[1,3,10]] 唯一解", r3.type, "unique");
  ok("   解 = (1, 3)", r3.solution.particular.map((v) => v.toString()).join(","), "1,3");
  {
    let msg = "no error";
    try { L.augSolve(SM([["1"], ["2"]])); } catch (e) { msg = /至少/.test(e.message) ? "中文报错" : "别的错"; }
    ok("列数不足 2 时报中文错", msg, "中文报错");
  }
}

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

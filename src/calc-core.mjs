// 蒲瓜的计算器 · 符号微积分引擎
// 零依赖 ES module，只用 Node 内置能力（BigInt / Math），不联网、不装包。
//
// 导出：parse / simplify / toString / evalAt / deriv / taylor / limit /
//       integrate / definiteIntegral / Rat (精确有理数，便于外部复用)
//
// AST 节点形状固定：
//   { t:"num", v:Rat } | { t:"var", name:"x" } | { t:"neg", a } |
//   { t:"add", a, b }  | { t:"mul", a, b }     | { t:"pow", a, b } |
//   { t:"fn", name:"sin", arg }
//
// 内部约定：所有数值字面量与导数系数都用精确有理数（BigInt 分子/分母）表示，
// 因此 d/dx(x^3/3) 精确得到 x^2，不存在浮点退化。

/* ============================== 1. 精确有理数 ============================== */

function bigAbs(a) { return a < 0n ? -a : a; }

function bigGcd(a, b) {
  a = bigAbs(a); b = bigAbs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

/** 精确有理数：BigInt 分子 / BigInt 分母，分母恒正、自动约分。 */
class Rat {
  constructor(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d === 0n) throw new Error("有理数的分母不能为 0");
    if (d < 0n) { n = -n; d = -d; }
    const g = bigGcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }
  add(o) { return new Rat(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Rat(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Rat(this.n * o.n, this.d * o.d); }
  div(o) {
    if (o.n === 0n) throw new Error("有理数除以 0");
    return new Rat(this.n * o.d, this.d * o.n);
  }
  neg() { return new Rat(-this.n, this.d); }
  inv() {
    if (this.n === 0n) throw new Error("0 没有倒数");
    return new Rat(this.d, this.n);
  }
  abs() { return this.n < 0n ? this.neg() : this; }
  get isZero() { return this.n === 0n; }
  get isOne() { return this.n === 1n && this.d === 1n; }
  get isInt() { return this.d === 1n; }
  get sign() { return this.n < 0n ? -1 : (this.n > 0n ? 1 : 0); }
  eq(o) { return this.n === o.n && this.d === o.d; }
  cmp(o) { const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : (l > r ? 1 : 0); }
  toNumber() { return Number(this.n) / Number(this.d); }
  /** "3"、"1/6"、"-1/6" */
  toString() { return this.d === 1n ? this.n.toString() : this.n + "/" + this.d; }
}

const R0 = new Rat(0n);
const R1 = new Rat(1n);
const R2 = new Rat(2n);
const RHALF = new Rat(1n, 2n);
const RAT_CACHE = new Map();
/** 由整数构造有理数（带缓存，热路径友好）。 */
function ri(n) {
  n = BigInt(n);
  let v = RAT_CACHE.get(n);
  if (!v) { v = new Rat(n, 1n); RAT_CACHE.set(n, v); }
  return v;
}
function rn(n) { return new Rat(n); }

/**
 * 连分数有理重构：浮点数 x 若非常接近分母不大的有理数，就还原它。
 * 用于「数值判定的极限恰好是 1/2 这类精确值」的场景。
 */
function ratApprox(x, maxDen = 10000n, eps = 1e-9) {
  if (!Number.isFinite(x)) return null;
  const neg = x < 0;
  const v = Math.abs(x);
  if (v > 1e15) return null;
  let h0 = 0n, h1 = 1n, k0 = 1n, k1 = 0n;
  let frac = v;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(frac);
    if (!Number.isFinite(a) || a < 0) break;
    const ab = BigInt(a);
    const h2 = ab * h1 + h0, k2 = ab * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    const cand = Number(h1) / Number(k1);
    if (Math.abs(cand - v) <= eps * Math.max(1, Math.abs(v))) {
      const r = new Rat(h1, k1);
      return neg ? r.neg() : r;
    }
    const next = frac - a;
    if (next < 1e-15) break;
    frac = 1 / next;
  }
  return null;
}

/* ============================== 2. 数值格式化 ============================== */

/** 一般数值 → 可读文本（给 limit.value、steps 展示用）。 */
function formatNumber(x) {
  if (typeof x !== "number") return String(x);
  if (Number.isNaN(x)) return "NaN";
  if (x === Infinity) return "+inf";
  if (x === -Infinity) return "-inf";
  if (Number.isInteger(x)) return String(x);
  const r = ratApprox(x, 10000n, 1e-12);
  if (r && !r.isInt) return r.toString();
  return String(Number(x.toPrecision(12)));
}

/** 定积分数值的展示：只有能精确还原成简单分数时才写成分数，否则写十进制。 */
function numericText(x) {
  if (typeof x !== "number" || !Number.isFinite(x)) return formatNumber(x);
  if (Number.isInteger(x)) return String(x);
  const r = ratApprox(x, 10000n, 1e-13);
  if (r && !r.isInt) return r.toString();
  return String(Number(x.toPrecision(12)));
}

/* ============================== 3. AST 工具 ============================== */

const num = (v) => ({ t: "num", v: (v instanceof Rat ? v : rn(v)) });
const n0 = () => ({ t: "num", v: R0 });
const n1 = () => ({ t: "num", v: R1 });
const variable = (name) => ({ t: "var", name });
const isNum = (x) => x.t === "num";
const isZeroNode = (x) => x.t === "num" && x.v.isZero;
const isOneNode = (x) => x.t === "num" && x.v.isOne;
const PI_NODE = () => ({ t: "fn", name: "pi", arg: null });
const E_NODE = () => ({ t: "fn", name: "e", arg: null });

/** 是否是自然常数 e 这个节点。 */
function isENode(n) {
  return !!n && n.t === "fn" && n.name === "e" && n.arg === null;
}

/** 稳定结构键：结构等价的子树 → 同一字符串（用于排序/同类项合并）。 */
function key(n) {
  switch (n.t) {
    case "num": return "#" + n.v.toString();
    case "var": return "$" + n.name;
    case "neg": return "-(" + key(n.a) + ")";
    case "add": return "+(" + key(n.a) + "," + key(n.b) + ")";
    case "mul": return "*(" + key(n.a) + "," + key(n.b) + ")";
    case "pow": return "^(" + key(n.a) + "," + key(n.b) + ")";
    case "fn": return "@" + n.name + "(" + (n.arg ? key(n.arg) : "") + ")";
    default: throw new Error("未知的 AST 节点类型：" + n.t);
  }
}

const CMP = (a, b) => (a < b ? -1 : (a > b ? 1 : 0));

/** 深拷贝。 */
function clone(n) {
  switch (n.t) {
    case "num": return { t: "num", v: n.v };
    case "var": return { t: "var", name: n.name };
    case "neg": return { t: "neg", a: clone(n.a) };
    case "add": return { t: "add", a: clone(n.a), b: clone(n.b) };
    case "mul": return { t: "mul", a: clone(n.a), b: clone(n.b) };
    case "pow": return { t: "pow", a: clone(n.a), b: clone(n.b) };
    case "fn": return { t: "fn", name: n.name, arg: n.arg ? clone(n.arg) : null };
    default: throw new Error("未知的 AST 节点类型：" + n.t);
  }
}

function walk(n, f) {
  f(n);
  if (n.t === "neg") walk(n.a, f);
  else if (n.t === "add" || n.t === "mul" || n.t === "pow") { walk(n.a, f); walk(n.b, f); }
  else if (n.t === "fn" && n.arg) walk(n.arg, f);
}

/* ============================== 4. 词法分析 ============================== */

const FUNCS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc",
  "asin", "acos", "atan", "sinh", "cosh", "tanh",
  "ln", "log", "exp", "sqrt", "abs",
]);
const CONSTS = new Set(["pi", "e"]);

function tokenize(src) {
  if (typeof src !== "string") throw new Error("表达式必须是字符串");
  const s = src.replace(/\u03C0/g, " pi ").replace(/\u221E/g, " inf ").replace(/\*\*/g, "^");
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] || ""))) {
      let j = i, seenDot = false;
      while (j < s.length && (/[0-9]/.test(s[j]) || (s[j] === "." && !seenDot))) {
        if (s[j] === ".") seenDot = true;
        j++;
      }
      if (s[j] === "e" || s[j] === "E") {
        let k = j + 1;
        if (s[k] === "+" || s[k] === "-") k++;
        if (/[0-9]/.test(s[k] || "")) { while (k < s.length && /[0-9]/.test(s[k])) k++; j = k; }
      }
      out.push({ k: "num", v: s.slice(i, j) });
      i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      out.push({ k: "name", v: s.slice(i, j) });
      i = j; continue;
    }
    if ("+-*/^(),".includes(c)) { out.push({ k: c }); i++; continue; }
    throw new Error("无法识别的字符「" + c + "」（位置 " + i + "）");
  }
  out.push({ k: "eof" });
  return out;
}

/* ============================== 5. 语法分析 ============================== */

/** 把十进制字面量精确转成有理数（不用 parseFloat，避免精度丢失）。 */
function decToRat(text) {
  let s = String(text);
  let exp = 0;
  const eIdx = s.search(/[eE]/);
  if (eIdx >= 0) {
    exp = parseInt(s.slice(eIdx + 1), 10);
    s = s.slice(0, eIdx);
  }
  let intPart = s, fracPart = "";
  const dot = s.indexOf(".");
  if (dot >= 0) { intPart = s.slice(0, dot); fracPart = s.slice(dot + 1); }
  if (intPart === "") intPart = "0";
  let n = BigInt(intPart || "0") * BigInt("1" + "0".repeat(fracPart.length)) + BigInt(fracPart || "0");
  let d = BigInt("1" + "0".repeat(fracPart.length));
  if (exp > 0) n *= BigInt("10") ** BigInt(exp);
  else if (exp < 0) d *= BigInt("10") ** BigInt(-exp);
  return new Rat(n, d);
}

/**
 * 解析字符串 → AST。
 * 支持隐式乘法（2x、3sin(x)、x(x+1)、2(x+1)）、^ 右结合、一元负号、括号。
 * 出错时 throw new Error(中文错误信息)。
 */
export function parse(src) {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const at = (k) => toks[pos].k === k;

  function expect(k, msg) {
    if (!at(k)) throw new Error("语法错误：" + msg + "，但读到" + describe(peek()));
    return next();
  }
  function describe(t) {
    if (!t || t.k === "eof") return "表达式结尾";
    if (t.k === "num") return "数字「" + t.v + "」";
    if (t.k === "name") return "「" + t.v + "」";
    return "「" + t.k + "」";
  }

  function parseExpr() {
    let left = parseMul();
    while (at("+") || at("-")) {
      const op = next().k;
      const right = parseMul();
      left = op === "+" ? { t: "add", a: left, b: right } : { t: "add", a: left, b: { t: "neg", a: right } };
    }
    return left;
  }

  // 乘法层：连续的「因子」自动视为相乘（隐式乘法）
  function parseMul() {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      if (t.k === "num" || t.k === "name" || t.k === "(") {
        const right = parseUnary();
        left = { t: "mul", a: left, b: right };
      } else if (t.k === "*" || t.k === "/") {
        next();
        const right = parseUnary();
        left = t.k === "*"
          ? { t: "mul", a: left, b: right }
          : { t: "mul", a: left, b: { t: "pow", a: right, b: num(ri(-1)) } };
      } else break;
    }
    return left;
  }

  // 一元层：-x、+x，然后进入幂层
  function parseUnary() {
    if (at("-")) { next(); return { t: "neg", a: parseUnary() }; }
    if (at("+")) { next(); return parseUnary(); }
    return parsePower();
  }

  // 幂层：右结合，指数本身可以带一元负号（x^-1）
  function parsePower() {
    const base = parseAtom();
    if (at("^")) {
      next();
      const exp = parseUnary();
      return { t: "pow", a: base, b: exp };
    }
    return base;
  }

  function parseAtom() {
    const t = peek();
    if (t.k === "num") { next(); return { t: "num", v: decToRat(t.v) }; }
    if (t.k === "name") {
      next();
      const name = t.v;
      // 已登记的函数名后面跟括号 → 函数调用；其它名字后面跟括号 → 隐式乘法 x(x+1)
      if (FUNCS.has(name) && at("(")) {
        next();
        const arg = parseExpr();
        expect(")", "函数 " + name + " 缺少右括号「)」");
        return { t: "fn", name, arg };
      }
      if (CONSTS.has(name)) return name === "pi" ? PI_NODE() : E_NODE();
      if (FUNCS.has(name)) throw new Error("函数「" + name + "」缺少参数括号，请写成 " + name + "(x)");
      // 单字母名字后面跟括号 → 隐式乘法 x(x+1)；多字母名字 → 当作未知函数调用
      if (at("(") && name.length > 1) throw new Error("未知函数「" + name + "」");
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return variable(name);
      throw new Error("无法识别的名称「" + name + "」");
    }
    if (t.k === "(") {
      next();
      const inner = parseExpr();
      if (!at(")")) throw new Error("括号没有闭合：缺少右括号「)」");
      next();
      return inner;
    }
    if (t.k === "eof") throw new Error("表达式不完整：结尾缺少内容");
    if (t.k === ")") throw new Error("表达式里出现了多余的右括号「)」");
    throw new Error("语法错误：这里不该出现" + describe(t));
  }

  const root = parseExpr();
  if (!at("eof")) throw new Error("表达式在" + describe(peek()) + "之后还有多余内容，请检查运算符是否写漏");
  return root;
}

/* ============================== 6. 化简 ============================== */

/** 把和式摊平成项列表。 */
function flattenSum(n, out = []) {
  if (n.t === "add") { flattenSum(n.a, out); flattenSum(n.b, out); return out; }
  out.push(n);
  return out;
}

/** 把积式摊平成因子列表（neg 也算系数 -1）。 */
function flattenProd(n, out = []) {
  if (n.t === "mul") { flattenProd(n.a, out); flattenProd(n.b, out); return out; }
  if (n.t === "neg") { flattenProd(n.a, out); out.unshift(num(ri(-1))); return out; }
  out.push(n);
  return out;
}

/** 取出项的数值系数与其余部分：2*x → {c:2, base:x}；-x → {c:-1, base:x}；5 → {c:5, base:null} */
function coeffOf(n) {
  const factors = flattenProd(n);
  let c = R1;
  const rest = [];
  for (const f of factors) {
    if (isNum(f)) c = c.mul(f.v);
    else rest.push(f);
  }
  if (rest.length === 0) return { c, base: null };
  let base = rest[0];
  for (let i = 1; i < rest.length; i++) base = { t: "mul", a: base, b: rest[i] };
  return { c, base };
}

const factKey = (b) => (b === null ? "#1" : key(b));

/** 单项乘积的规范化：合并数值系数、合并同底数幂、稳定排序。 */
function makeProd(factors) {
  let c = R1;
  const powers = []; // { base, exp: Rat | node | null }
  for (const f of factors) {
    if (isNum(f)) { c = c.mul(f.v); continue; }
    let base = f, exp = null;
    if (f.t === "pow") { base = f.a; exp = f.b; }
    if (base.t === "neg") { c = c.neg(); base = base.a; }
    // 只有「数字底数 + 数字指数」才能折进系数；2^x 这种指数是变量的必须保留
    if (base.t === "num" && exp !== null && isNum(exp)) {
      const folded = powRat(base.v, exp);
      if (folded) { c = c.mul(folded); continue; }
    }
    if (exp && isNum(exp) && exp.v.isZero) continue;
    if (exp && isNum(exp) && exp.v.isOne) exp = null;
    let merged = false;
    if (exp === null) {
      for (const p of powers) {
        if (key(p.base) !== key(base)) continue;
        if (p.exp === null) p.exp = ri(2);
        else if (p.exp instanceof Rat) p.exp = p.exp.add(R1);
        else continue;
        merged = true; break;
      }
    } else if (isNum(exp)) {
      for (const p of powers) {
        if (key(p.base) !== key(base)) continue;
        if (p.exp === null) p.exp = exp.v.add(R1);
        else if (p.exp instanceof Rat) p.exp = p.exp.add(exp.v);
        else continue;
        merged = true; break;
      }
    }
    if (!merged) powers.push({ base, exp: exp === null ? null : (isNum(exp) ? exp.v : exp) });
  }
  if (c.isZero) return n0();
  const list = [];
  for (const p of powers) {
    if (p.exp === null) list.push(p.base);
    else if (p.exp instanceof Rat) {
      if (p.exp.isZero) continue;
      if (p.exp.isOne) list.push(p.base);
      else list.push({ t: "pow", a: p.base, b: num(p.exp) });
    } else list.push({ t: "pow", a: p.base, b: p.exp });
  }
  for (const f of list) if (isNum(f) && f.v.isZero) return n0();
  list.sort(factorCmp);
  if (list.length === 0) return num(c);
  if (c.isOne) return list.length === 1 ? list[0] : buildMulList(list);
  if (c.eq(ri(-1))) {
    const body = list.length === 1 ? list[0] : buildMulList(list);
    return body.t === "num" ? num(c.mul(body.v)) : { t: "neg", a: body };
  }
  return buildMulList([num(c), ...list]);
}

function buildMulList(list) {
  let acc = list[0];
  for (let i = 1; i < list.length; i++) acc = { t: "mul", a: acc, b: list[i] };
  return acc;
}

/** 因子排序：数字 → 变量 → 幂 → 函数，同类按键排序，保证输出稳定。 */
function factorCmp(x, y) {
  const rank = (n) => {
    if (n.t === "num") return 0;
    if (n.t === "var") return 1;
    if (n.t === "pow") return 2;
    if (n.t === "fn") return 3;
    return 4;
  };
  const rx = rank(x), ry = rank(y);
  if (rx !== ry) return rx - ry;
  return CMP(key(x), key(y));
}

/** 项的排序（和式稳定输出）：按次数降序，再按键。 */
function termSortCmp(a, b) {
  const da = sortDeg(a), db = sortDeg(b);
  if (da !== db) return db - da;
  return CMP(key(a), key(b));
}
function sortDeg(n) {
  if (n.t === "pow" && isNum(n.b)) return Number(n.b.v.toNumber());
  if (n.t === "var") return 1;
  if (n.t === "num") return -1e9;
  if (n.t === "neg") return sortDeg(n.a);
  if (n.t === "mul") return Math.max(sortDeg(n.a), sortDeg(n.b));
  return 0;
}

/** 有理数底数的整数次幂（保持精确）。 */
function powRat(base, expNode) {
  if (!isNum(expNode)) return null;
  const e = expNode.v;
  if (e.isInt) {
    const k = e.n;
    if (k >= 0n) {
      if (k > 4096n) return null;
      return new Rat(base.n ** k, base.d ** k);
    }
    const kk = -k;
    if (kk > 4096n) return null;
    if (base.isZero) return null;
    return new Rat(base.d ** kk, base.n ** kk);
  }
  return null;
}

/**
 * 化简（含常数折叠、恒等式、合并同类项）。
 * 输出稳定：同样输入永远得到结构相同的输出。
 */
export function simplify(node) {
  return simp(node, new Map());
}

function simp(n, cache) {
  if (!n || typeof n !== "object") throw new Error("simplify 收到非法节点");
  const k = key(n);
  if (cache.has(k)) return cache.get(k);
  const r = simpInner(n, cache);
  cache.set(k, r);
  return r;
}

function simpInner(n, cache) {
  switch (n.t) {
    case "num": return num(n.v);
    case "var": return variable(n.name);
    case "fn":
      if (n.arg === null) return { t: "fn", name: n.name, arg: null };
      return { t: "fn", name: n.name, arg: simp(n.arg, cache) };
    case "neg": {
      const a = simp(n.a, cache);
      if (isNum(a)) return num(a.v.neg());
      if (a.t === "neg") return a.a;
      return makeProd([num(ri(-1)), a]);
    }
    case "add": return simplifySum(flattenSum(n).map((t) => simp(t, cache)));
    case "mul": return makeProd(flattenProd(n).map((f) => simp(f, cache)));
    case "pow": {
      const a = simp(n.a, cache), b = simp(n.b, cache);
      return simpPow(a, b);
    }
    default: throw new Error("未知的 AST 节点类型：" + n.t);
  }
}

function simpPow(a, b) {
  if (isNum(b)) {
    if (b.v.isZero) return n1();
    if (b.v.isOne) return a;
    if (isNum(a)) {
      const r = powRat(a.v, b);
      if (r) return num(r);
    }
  }
  // e^x 与 exp(x) 统一成 exp(x)，两种写法行为完全一致
  if (isENode(a)) return { t: "fn", name: "exp", arg: b };
  if (isNum(a) && a.v.isZero) return b.t === "num" && b.v.sign > 0 ? n0() : { t: "pow", a, b };
  if (isNum(a) && a.v.isOne) return n1();
  if (b.t === "num" && b.v.eq(ri(-1))) return { t: "pow", a, b };
  if (a.t === "pow" && isNum(a.b) && isNum(b)) {
    const e = a.b.v.mul(b.v);
    if (e.isOne) return a.a;
    if (e.isZero) return n1();
    return { t: "pow", a: a.a, b: num(e) };
  }
  return { t: "pow", a, b };
}

/** 和式化简：合并同类项 + 常数折叠 + 稳定排序。 */
function simplifySum(terms) {
  const groups = new Map();
  for (const t of terms) {
    const { c, base } = coeffOf(t);
    if (c.isZero) continue;
    const bk = factKey(base);
    const g = groups.get(bk);
    if (g) g.c = g.c.add(c);
    else groups.set(bk, { c, base });
  }
  const out = [];
  for (const g of [...groups.values()]) {
    if (g.c.isZero) continue;
    if (g.base === null) { out.push(num(g.c)); continue; }
    out.push(makeProd([num(g.c), g.base]));
  }
  if (out.length === 0) return n0();
  if (out.length === 1) return out[0];
  const nums = out.filter(isNum);
  const rest = out.filter((x) => !isNum(x));
  rest.sort(termSortCmp);
  const all = [...rest, ...nums]; // 常数项放最后，符合书写习惯
  let acc = all[0];
  for (let i = 1; i < all.length; i++) acc = { t: "add", a: acc, b: all[i] };
  return acc;
}

/* ============================== 7. 打印 ============================== */

const PREC_ADD = 1, PREC_MUL = 2, PREC_NEG = 3, PREC_POW = 4, PREC_ATOM = 5;

function prec(n) {
  switch (n.t) {
    case "add": return PREC_ADD;
    case "mul": return PREC_MUL;
    case "neg": return PREC_NEG;
    case "pow": return PREC_POW;
    default: return PREC_ATOM;
  }
}

/** 原子形状（数字/变量/函数调用/幂），打印时不需要额外括号。 */
function isAtomish(n) {
  return n.t === "num" || n.t === "var" || n.t === "fn" || n.t === "pow";
}

/** 负系数拆分：用于 a - b 的打印。返回其相反数（正系数形式），无负号则 null。 */
function negSplit(n) {
  if (n.t === "neg") return n.a;
  if (isNum(n) && n.v.sign < 0) return num(n.v.neg());
  if (n.t === "mul") {
    const { c, base } = coeffOf(n);
    if (base !== null && c.sign < 0) return makeProd([num(c.neg()), base]);
  }
  return null;
}

function fmt(n, parentPrec) {
  const p = prec(n);
  let s;
  switch (n.t) {
    case "num": s = n.v.toString(); break;
    case "var": s = n.name; break;
    case "fn": s = n.arg === null ? n.name : n.name + "(" + fmt(n.arg, 0) + ")"; break;
    case "neg": {
      s = prec(n.a) < PREC_MUL ? "-(" + fmt(n.a, 0) + ")" : "-" + fmt(n.a, PREC_NEG);
      break;
    }
    case "pow": {
      const basePrec = isAtomish(n.a) ? PREC_ATOM : PREC_MUL;
      let base = fmt(n.a, basePrec);
      if (isNum(n.a) && n.a.v.sign < 0) base = "(" + n.a.v.toString() + ")";
      // 负整数指数打印成分式，避免出现 x^2^-1 这种令人困惑的写法
      if (isNum(n.b) && n.b.v.isInt && n.b.v.sign < 0) {
        const m = n.b.v.neg();
        const denom = m.isOne ? base : base + "^" + m.toString();
        s = "1/" + (isAtomish(n.a) ? denom : "(" + denom + ")");
        break;
      }
      s = base + "^" + fmt(n.b, PREC_POW);
      break;
    }
    case "mul": s = fmtProduct(n); break;
    case "add": s = fmtSum(n); break;
    default: throw new Error("未知的 AST 节点类型：" + n.t);
  }
  if (p < parentPrec) s = "(" + s + ")";
  return s;
}

function fmtSum(n) {
  const terms = flattenSum(n);
  let out = "";
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    if (i === 0) {
      out += fmtProduct(t);
    } else {
      const pos = negSplit(t);
      if (pos !== null) out += " - " + fmtProduct(pos);
      else out += " + " + fmtProduct(t);
    }
  }
  return out;
}

function fmtProduct(n) {
  if (n.t === "neg") return "-" + fmtProduct(n.a);
  if (n.t !== "mul") return fmt(n, PREC_MUL);
  const factors = flattenProd(n);
  let c = R1;
  const rest = [];
  for (const f of factors) {
    if (isNum(f)) c = c.mul(f.v);
    else rest.push(f);
  }
  if (rest.length === 0) return c.toString();
  rest.sort(factorCmp);
  const sign = c.sign < 0 ? "-" : "";
  const absC = c.abs();
  let head = "";
  if (absC.isOne) head = "";
  else if (absC.n === 1n && absC.d !== 1n) head = "";
  else head = absC.toString() + "*";
  let body = rest.map((f) => fmt(f, PREC_MUL)).join("*");
  if (head === "" && absC.n === 1n && absC.d !== 1n) body = body + "/" + absC.d.toString();
  return sign + head + body;
}

/**
 * 把 AST 打印成中缀字符串，优先级正确、括号最少。
 * 只使用 ASCII：* / ^ -，函数写成 sin(x) 这样。
 */
export function toString(node) {
  if (!node || typeof node !== "object") throw new Error("toString 收到非法节点");
  return fmt(node, 0);
}

/* ============================== 8. 求值 ============================== */

const FN_EVAL = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sech: (x) => 1 / Math.cosh(x),
  coth: (x) => Math.cosh(x) / Math.sinh(x),
  ln: (x) => (x === 0 ? -Infinity : (x < 0 ? NaN : Math.log(x))),
  log: (x) => (x === 0 ? -Infinity : (x < 0 ? NaN : Math.log(x))),
  exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs,
};

/** 代入数值：返回 number（可能 Infinity / NaN，不抛错）。 */
export function evalAt(node, x, varName = "x") {
  return ev(node, { x, varName });
}

function ev(n, env) {
  switch (n.t) {
    case "num": return n.v.toNumber();
    case "var": return n.name === env.varName ? env.x : NaN;
    case "neg": return -ev(n.a, env);
    case "add": return ev(n.a, env) + ev(n.b, env);
    case "mul": return ev(n.a, env) * ev(n.b, env);
    case "pow": {
      const b = ev(n.a, env), e = ev(n.b, env);
      if (b === 0 && e === 0) return NaN;
      if (b < 0 && !Number.isInteger(e)) return NaN;
      return Math.pow(b, e);
    }
    case "fn": {
      if (n.arg === null) return n.name === "pi" ? Math.PI : Math.E;
      const a = ev(n.arg, env);
      if (n.name === "cot") return Math.cos(a) / Math.sin(a);
      if (n.name === "sec") return 1 / Math.cos(a);
      if (n.name === "csc") return 1 / Math.sin(a);
      const f = FN_EVAL[n.name];
      if (!f) throw new Error("未知函数：" + n.name);
      return f(a);
    }
    default: throw new Error("未知的 AST 节点类型：" + n.t);
  }
}

/** 纯有理数求值：全部用 Rat 计算，除不尽（如 sin、sqrt）返回 null。 */
function evalRat(n, x, varName = "x") {
  switch (n.t) {
    case "num": return n.v;
    case "var": return n.name === varName ? x : null;
    case "neg": { const a = evalRat(n.a, x, varName); return a === null ? null : a.neg(); }
    case "add": {
      const a = evalRat(n.a, x, varName), b = evalRat(n.b, x, varName);
      return (a === null || b === null) ? null : a.add(b);
    }
    case "mul": {
      const a = evalRat(n.a, x, varName), b = evalRat(n.b, x, varName);
      return (a === null || b === null) ? null : a.mul(b);
    }
    case "pow": {
      const a = evalRat(n.a, x, varName), b = evalRat(n.b, x, varName);
      if (a === null || b === null || !b.isInt) return null;
      const k = b.n;
      if (k >= 0n) return new Rat(a.n ** k, a.d ** k);
      if (a.isZero) return null;
      const kk = -k;
      return new Rat(a.d ** kk, a.n ** kk);
    }
    default: return null;
  }
}

/* ============================== 9. 求导 ============================== */

const DERIV_FN = {
  sin: (a) => ({ t: "fn", name: "cos", arg: a }),
  cos: (a) => ({ t: "neg", a: { t: "fn", name: "sin", arg: a } }),
  tan: (a) => ({ t: "pow", a: { t: "fn", name: "sec", arg: a }, b: num(ri(2)) }),
  cot: (a) => ({ t: "neg", a: { t: "pow", a: { t: "fn", name: "csc", arg: a }, b: num(ri(2)) } }),
  sec: (a) => ({ t: "mul", a: { t: "fn", name: "sec", arg: a }, b: { t: "fn", name: "tan", arg: a } }),
  csc: (a) => ({ t: "neg", a: { t: "mul", a: { t: "fn", name: "csc", arg: a }, b: { t: "fn", name: "cot", arg: a } } }),
  asin: (a) => ({ t: "pow", a: { t: "add", a: n1(), b: { t: "neg", a: { t: "pow", a, b: num(R2) } } }, b: num(new Rat(-1n, 2n)) }),
  acos: (a) => ({ t: "neg", a: { t: "pow", a: { t: "add", a: n1(), b: { t: "neg", a: { t: "pow", a, b: num(R2) } } }, b: num(new Rat(-1n, 2n)) } }),
  atan: (a) => ({ t: "pow", a: { t: "add", a: n1(), b: { t: "pow", a, b: num(R2) } }, b: num(ri(-1)) }),
  sinh: (a) => ({ t: "fn", name: "cosh", arg: a }),
  cosh: (a) => ({ t: "fn", name: "sinh", arg: a }),
  tanh: (a) => ({ t: "pow", a: { t: "fn", name: "sech", arg: a }, b: num(R2) }),
  ln: (a) => ({ t: "pow", a, b: num(ri(-1)) }),
  log: (a) => ({ t: "pow", a, b: num(ri(-1)) }),
  exp: (a) => ({ t: "fn", name: "exp", arg: a }),
  sqrt: (a) => ({ t: "mul", a: num(RHALF), b: { t: "pow", a, b: num(new Rat(-1n, 2n)) } }),
  abs: (a) => ({ t: "mul", a: { t: "fn", name: "abs", arg: a }, b: { t: "pow", a, b: num(ri(-1)) } }),
};

/**
 * 求导（结果已 simplify）。
 * 规则齐全：幂、积、商、链式、以及 a^b 的一般式（对数求导）。
 */
export function deriv(node, varName = "x") {
  return d(node, varName);
}

function d(n, v) {
  switch (n.t) {
    case "num": return n0();
    case "var": return n.name === v ? n1() : n0();
    case "neg": return { t: "neg", a: d(n.a, v) };
    case "add": return smooth({ t: "add", a: d(n.a, v), b: d(n.b, v) });
    case "mul": {
      // 积法则：(uv)' = u'v + uv'
      const a = d(n.a, v), b = d(n.b, v);
      return smooth({
        t: "add",
        a: { t: "mul", a, b: clone(n.b) },
        b: { t: "mul", a: clone(n.a), b },
      });
    }
    case "pow": {
      const base = n.a, exp = n.b;
      if (isNum(exp)) {
        // 幂法则（含链式）：n * base^(n-1) * base'
        const k = exp.v;
        const newExp = k.sub(R1);
        const p = newExp.isZero ? clone(base) : { t: "pow", a: clone(base), b: num(newExp) };
        return smooth({ t: "mul", a: num(k), b: { t: "mul", a: p, b: d(base, v) } });
      }
      if (isNum(base) || isENode(base)) {
        // 指数法则：(a^u)' = a^u * ln(a) * u'（a = e 时 ln(a) = 1）
        const lnA = isENode(base) ? n1() : { t: "fn", name: "ln", arg: num(base.v) };
        return smooth({ t: "mul", a: { t: "mul", a: clone(n), b: lnA }, b: d(exp, v) });
      }
      // 一般式（对数求导）：(u^w)' = u^w * (w' * ln u + w * u'/u)
      const u = clone(base), w = clone(exp);
      const term1 = { t: "mul", a: d(exp, v), b: { t: "fn", name: "ln", arg: u } };
      const term2 = { t: "mul", a: w, b: { t: "mul", a: d(base, v), b: { t: "pow", a: clone(base), b: num(ri(-1)) } } };
      return smooth({ t: "mul", a: clone(n), b: { t: "add", a: term1, b: term2 } });
    }
    case "fn": {
      if (n.arg === null) return n0();
      const rule = DERIV_FN[n.name];
      if (!rule) throw new Error("不支持对函数 " + n.name + " 求导");
      const outer = rule(clone(n.arg));
      const inner = d(n.arg, v);
      if (isOneNode(inner)) return smooth(outer);
      return smooth({ t: "mul", a: outer, b: inner });
    }
    default: throw new Error("未知的 AST 节点类型：" + n.t);
  }
}

const smooth = (n) => simplify(n);

/* ============================== 10. 泰勒展开 ============================== */

/**
 * 在点 a 处把表达式展开到 order 阶。
 * 展开点支持纯数字，也支持含 pi / e 的表达式（"pi/2"、"2*pi"、"1/3"）。
 * 返回 { terms: [{ coefText, power }], text }，text 形如 "x - x^3/6 + ..."。
 */
export function taylor(node, a, order, varName = "x") {
  const N = Number(order);
  if (!Number.isFinite(N) || N < 0) throw new Error("泰勒展开的阶数必须是非负整数");
  const pt = constPoint(a, "泰勒展开的展开点");
  const aNum = pt.num;
  const aPoint = ratApprox(aNum, 1000000n, 1e-12); // a = pi/2 这类点不是有理数，这里会是 null
  const terms = [];
  let cur = simplify(clone(node));
  let fact = R1;
  for (let k = 0; k <= N; k++) {
    if (k > 0) {
      cur = deriv(cur, varName);
      fact = fact.mul(ri(k));
    }
    let fk = null;   // 精确有理系数
    let fnum = null; // 拿不到精确有理数时的数值系数
    // 先把展开点符号代入再归约：a = pi/2 这类点也能拿到精确的有理系数
    const red = reduceConst(substConst(cur, varName, pt.node));
    if (red !== null && isNum(red)) fk = red.v;
    if (fk === null) fk = evalRat(cur, aPoint, varName);
    if (fk === null) {
      fnum = ev(cur, { x: aNum, varName });
      // 只收「好看」的有理近似（分母 ≤ 1000），否则老实写小数，
      // 免得 e^(pi/2) 这种无理系数被写成 2328247/483995 这种没法看的东西
      if (Number.isFinite(fnum)) fk = ratApprox(fnum, 1000n, 1e-12);
    }
    if (fk === null && !Number.isFinite(fnum)) break;
    // 系数：优先精确有理数，只有数值时写成小数
    let coef = null, cnum = 0;
    if (fk !== null) { coef = fk.div(fact); cnum = coef.toNumber(); }
    else { cnum = fnum / fact.toNumber(); coef = ratApprox(cnum, 1000000n, 1e-12); }
    if (coef ? coef.isZero : cnum === 0) continue;
    // (x - a)^k
    const base = isZeroNode(pt.node)
      ? variable(varName)
      : simplify({ t: "add", a: variable(varName), b: { t: "neg", a: clone(pt.node) } });
    terms.push({
      coefText: coef ? coef.toString() : decimalText(cnum),
      power: k,
      coef,
      sign: (coef ? coef.sign : (cnum < 0 ? -1 : 1)),
      mag: taylorMagText(k, toString(base), coef, cnum),
    });
  }
  terms.sort((x, y) => x.power - y.power);
  let text;
  if (terms.length === 0) text = "0";
  else {
    const parts = terms.map((t) => ({ sign: t.sign < 0 ? "-" : "+", mag: t.mag }));
    text = (parts[0].sign === "-" ? "-" : "") + parts[0].mag;
    for (let i = 1; i < parts.length; i++) text += " " + (parts[i].sign === "-" ? "-" : "+") + " " + parts[i].mag;
    text += " + ...";
  }
  return {
    terms: terms.map((t) => ({ coefText: t.coefText, power: t.power })),
    text,
  };
}

/** 近似系数的小数写法（10 位有效数字）。 */
function decimalText(x) {
  return String(Number(x.toPrecision(10)));
}

/** 泰勒一项的「系数 × 幂」文字；有理系数写成分数，数值系数写成小数。 */
function taylorMagText(power, baseText, coef, cnum) {
  const plain = /^[A-Za-z0-9_]+$/.test(baseText);
  const close = plain ? baseText : "(" + baseText + ")";
  if (power === 0) {
    if (coef) return coef.abs().isOne ? "1" : coef.abs().toString();
    const a0 = Math.abs(cnum);
    return Math.abs(a0 - 1) < 1e-12 ? "1" : decimalText(a0);
  }
  const p = power === 1 ? close : close + "^" + power;
  if (coef) {
    const cAbs = coef.abs();
    if (cAbs.isOne) return p;
    if (cAbs.n === 1n) return p + "/" + cAbs.d.toString();
    return cAbs.toString() + "*" + p;
  }
  const a = Math.abs(cnum);
  if (Math.abs(a - 1) < 1e-12) return p;
  return decimalText(a) + "*" + p;
}

/* ============================== 11. 极限 ============================== */

const MAX_LHOPITAL = 6;
const PROBE_SCALES = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5];
const BIG_SCALES = [1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e8];

/**
 * 从一侧逼近有限点 a。
 * 返回 { kind:"finite"|"infinite"|"oscillate"|"none", value, samples, note, exactRat }
 * kind 为 "infinite" 时 value 一定是 Infinity 或 -Infinity（保留方向）。
 */
function probeSide(f, a, sign) {
  const samples = [];
  for (const s of PROBE_SCALES) {
    const x = a + sign * s;
    samples.push({ x, y: f(x), s });
  }
  const vals = samples.map((p) => p.y);
  const good = samples.filter((p) => !Number.isNaN(p.y));
  if (good.length === 0) {
    return { kind: "none", value: null, samples, exactRat: null, note: "取值全部为 NaN" };
  }

  // 出现 ±∞ 直接判为无穷（保留符号）
  if (vals.some((v) => !Number.isFinite(v))) {
    const tail = good.slice(-3).map((p) => p.y);
    const allNeg = tail.every((v) => v <= 0);
    const value = allNeg ? -Infinity : Infinity;
    return { kind: "infinite", value, samples, exactRat: null, note: "数值越过可表示范围，趋于 " + formatNumber(value) };
  }

  // 单调爆炸：同号且绝对值逐级放大很多倍 → 趋于 ±∞（1/x、1/(x-1)^2 这类极点）
  const mono = monotoneExplosion(vals);
  if (mono) {
    return { kind: "infinite", value: mono, samples, exactRat: null, note: "绝对值逐级放大，趋于 " + formatNumber(mono) };
  }

  // 振荡：反复变号或来回大幅跳动，且不收敛
  const tail = vals.slice(-4);
  const scaleRef = Math.max(...tail.map((v) => Math.abs(v)), 1);
  const flips = countFlips(vals);
  const jumps = Math.abs(tail[tail.length - 1] - tail[0]);
  if (flips >= 3 || (jumps > 0.05 * scaleRef && !convergingTight(vals))) {
    return { kind: "oscillate", value: null, samples, exactRat: null, note: "数值随逼近反复振荡，没有稳定趋势" };
  }

  // Richardson 外推（步长按 10 倍几何递减）
  const { value, converged, delta } = richardson(good);
  if (value === null) {
    return { kind: "none", value: null, samples, exactRat: null, note: "数值外推失败" };
  }
  if (converged || delta < 1e-6 * Math.max(1, Math.abs(value))) {
    const snap = ratApprox(value, 100000n, 1e-9);
    return { kind: "finite", value: snap ? snap.toNumber() : value, exactRat: snap, samples, note: "数值外推收敛" };
  }
  const lastTwo = good.slice(-2);
  if (lastTwo.length === 2 && Math.abs(lastTwo[1].y - lastTwo[0].y) < 1e-9 * Math.max(1, Math.abs(lastTwo[1].y))) {
    const snap = ratApprox(lastTwo[1].y, 100000n, 1e-9);
    return { kind: "finite", value: lastTwo[1].y, exactRat: snap, samples, note: "相邻取样已稳定" };
  }
  return { kind: "none", value: null, samples, exactRat: null, note: "数值不收敛（疑似振荡或发散）" };
}

/** 同号且每级至少放大 8 倍 → 判定为趋于 ±∞，返回 Infinity / -Infinity；否则 null。 */
function monotoneExplosion(vals) {
  if (vals.length < 4) return null;
  const allPos = vals.every((v) => v > 0);
  const allNeg = vals.every((v) => v < 0);
  if (!allPos && !allNeg) return null;
  for (let i = 1; i < vals.length; i++) {
    if (Math.abs(vals[i]) < 8 * Math.abs(vals[i - 1])) return null;
  }
  return allPos ? Infinity : -Infinity;
}

function countFlips(vals) {
  let flips = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] * vals[i - 1] < 0) flips++;
  return flips;
}

/** 最后几个样本是否已经贴在一起（相对差很小）。 */
function convergingTight(vals) {
  const t = vals.slice(-3);
  if (t.length < 2) return false;
  const ref = Math.max(...t.map((v) => Math.abs(v)), 1e-300);
  return Math.abs(t[t.length - 1] - t[0]) < 1e-6 * ref;
}

/** 一维 Richardson 外推（步长按几何级数递减）。 */
function richardson(samples) {
  const n = samples.length;
  if (n < 2) return { value: samples[0] ? samples[0].y : null, converged: false, delta: Infinity };
  const table = samples.map((p) => [p.y]);
  for (let j = 1; j < n; j++) {
    for (let i = 0; i + j < n; i++) {
      const ratio = Math.pow(10, j); // h_i / h_{i+j} = 10^j
      const prev = table[i][j - 1], cur = table[i + 1][j - 1];
      table[i][j] = (ratio * cur - prev) / (ratio - 1);
    }
  }
  const best = table[0][n - 1];
  const prev = n >= 2 ? table[0][n - 2] : null;
  const delta = (prev === null || !Number.isFinite(prev)) ? Infinity : Math.abs(best - prev);
  if (!Number.isFinite(best)) return { value: null, converged: false, delta: Infinity };
  return { value: best, converged: Number.isFinite(delta) && delta < 1e-12, delta };
}

/** 判定 x → ±∞ 时表达式的行为。 */
function probeInfinity(f) {
  const samples = [];
  for (const s of BIG_SCALES) samples.push({ x: s, y: f(s), s });
  const good = samples.filter((p) => !Number.isNaN(p.y));
  if (good.length === 0) {
    return { kind: "none", value: null, samples, exactRat: null, note: "取值全部为 NaN" };
  }
  const last = good[good.length - 1].y;
  if (!Number.isFinite(last)) {
    const allNeg = good.slice(-3).every((p) => p.y <= 0);
    const value = allNeg ? -Infinity : Infinity;
    return { kind: "infinite", value, samples, exactRat: null, note: "随 x 增大越过可表示范围" };
  }
  const absTail = good.slice(-4).map((p) => Math.abs(p.y));
  if (absTail.length >= 3 && absTail[absTail.length - 1] > 1e10 && absTail[absTail.length - 1] > 100 * absTail[0]) {
    const allNeg = good.slice(-2).every((p) => p.y < 0);
    return {
      kind: "infinite", value: allNeg ? -Infinity : Infinity, samples, exactRat: null,
      note: "随 x 增大绝对值持续放大",
    };
  }
  // 用 1/x 作为步长做 Richardson 外推
  const zs = good.map((p) => ({ x: 1 / p.x, y: p.y, s: 1 / p.x }));
  const { value, delta } = richardson(zs);
  if (value === null) {
    return { kind: "none", value: null, samples, exactRat: null, note: "数值外推失败" };
  }
  const snap = ratApprox(value, 100000n, 1e-8);
  const spreadTail = Math.max(...absTail) - Math.min(...absTail);
  if (delta < 1e-8 * Math.max(1, Math.abs(value)) || spreadTail < 1e-7 * Math.max(1, Math.abs(value))) {
    return {
      kind: "finite", value: snap ? snap.toNumber() : value, samples, exactRat: snap,
      note: "数值外推收敛到 " + formatNumber(snap ? snap.toNumber() : value),
    };
  }
  return { kind: "none", value: null, samples, exactRat: null, note: "在无穷远处没有稳定趋势" };
}

/** 多项式识别：返回按次数升序的有理系数数组；不是多项式、或不含指定变量则返回 null。 */
function polyCoeffs(n, v) {
  const vk = "$" + v;
  let sawVar = false;
  let sawVarInBase = false;
  const terms = flattenSum(n);
  const map = new Map();
  for (const t of terms) {
    const { c, base } = coeffOf(t);
    let deg = 0;
    if (base !== null) {
      const r = termDegree(base, v);
      if (r === null) return null;
      deg = r;
      sawVarInBase = true;
      if (key(base).includes(vk)) sawVar = true;
    }
    if (c.isZero && base === null) continue;
    map.set(deg, (map.get(deg) || R0).add(c));
  }
  // 必须是「关于 v 的多项式」：允许 x、x^2、x^2+1；不允许 sin(x)、e^x、2^x
  if (!sawVar) {
    if (sawVarInBase) return null;
    // 纯常数：只有显式不含变量时才算（调用方按长度 >1 过滤）
  }
  const maxDeg = Math.max(...map.keys());
  const out = [];
  for (let i = 0; i <= maxDeg; i++) out.push(map.get(i) || R0);
  return out;
}
function termDegree(b, v) {
  if (b.t === "var") return b.name === v ? 1 : null;
  if (b.t === "pow" && b.a.t === "var" && b.a.name === v && isNum(b.b) && b.b.v.isInt && b.b.v.sign >= 0) {
    return Number(b.b.v.n);
  }
  if (b.t === "neg") return termDegree(b.a, v);
  return null;
}

/** 有理分式的无穷极限直接判定：(3x^2+2x)/(x^2-5) → 3；x^2/(x+1) → +∞。 */
function rationalInfinityLimit(n, v) {
  const split = splitQuotient(n);
  if (!split) return null;
  const pn = polyCoeffs(simplify(split.num), v), pd = polyCoeffs(simplify(split.den), v);
  if (!pn || !pd) return null;
  const dn = pn.length - 1, dd = pd.length - 1;
  const leadN = pn[dn], leadD = pd[dd];
  if (leadD.isZero) return null;
  if (dn === dd) return { kind: "finite", rat: leadN.div(leadD) };
  if (dn < dd) return { kind: "finite", rat: R0 };
  const sgn = leadN.sign * leadD.sign;
  return { kind: "infinite", value: sgn >= 0 ? Infinity : -Infinity };
}

/**
 * 极限。
 * a: number | "inf" | "-inf"（也接受 "+inf"、"∞"）
 *    也可以是含 pi / e 的表达式字符串："pi/2"、"2*pi"、"1/3"。
 * opts: { side: "both" | "left" | "right", varName }
 * 返回 { exists, value, exact, kind, left, right, steps, method }
 *
 * kind === "infinite" 时，value / left.value / right.value 都带上 ±∞ 符号，
 * 便于界面直接写出「左极限 = -inf，右极限 = +inf」。
 */
export function limit(node, a, opts = {}) {
  const varName = opts.varName || "x";
  const side = opts.side || "both";
  const steps = [];
  const expr = simplify(clone(node));
  const exprText = toString(expr);

  const toInf = (s) => s === "inf" || s === "+inf" || s === "∞" || s === "+∞" ||
    s === "Infinity" || s === "+Infinity";
  const toNegInf = (s) => s === "-inf" || s === "-∞" || s === "−∞" || s === "-Infinity";
  let aKind = "finite", aNum = null, aLabel = null;
  if (typeof a === "number") {
    if (Number.isNaN(a)) throw new Error("极限点不能是 NaN");
    aNum = a;
    if (a === Infinity) aKind = "inf";
    else if (a === -Infinity) aKind = "neginf";
  } else if (typeof a === "string") {
    const s = a.trim();
    if (toInf(s)) aKind = "inf";
    else if (toNegInf(s)) aKind = "neginf";
    else {
      const pt = constPoint(a, "极限点 a"); // 支持 pi/2、2*pi、1/3 这类表达式
      aNum = pt.num;
      aLabel = pt.text;
    }
  } else {
    throw new Error("极限点必须是数值、含 pi / e 的表达式，或 \"inf\" / \"-inf\"");
  }

  const f = (x) => ev(expr, { x, varName });
  const targetText = aKind === "inf" ? "+inf" : (aKind === "neginf" ? "-inf" : (aLabel || formatNumber(aNum)));

  /* ---- 有限点 ---- */
  if (aKind === "finite") {
    const direct = f(aNum);
    steps.push({
      desc: "代入判定：把 " + varName + " = " + targetText + " 直接代入 f(" + varName + ") = " + exprText +
        "，得到 " + formatNumber(direct) + "。",
      expr: exprText,
    });
    if (isFiniteNum(direct)) {
      const one = { value: direct, kind: "finite" };
      if (side === "both") return finish("finite", direct, ratApprox(direct), one, one, steps, "substitute");
      return finish("finite", direct, ratApprox(direct), side === "left" ? one : null, side === "right" ? one : null, steps, "substitute");
    }
    // 代入无效：分别探测两侧
    const lp = probeSide(f, aNum, -1);
    const rp = probeSide(f, aNum, +1);
    steps.push({
      desc: "代入得到 " + formatNumber(direct) + "（不定式或未定义），改用数值逼近判定两侧：左极限 " +
        sideText(lp) + "，右极限 " + sideText(rp) + "。",
    });
    // 0/0 或 inf/inf → 洛必达（含 |x| 这类不可导点时跳过，避免无意义迭代）
    const lh = hasAbs(expr) ? null : tryLhopital(expr, aNum, varName, steps, targetText);
    if (lh !== null) {
      const one = { value: lh.value, kind: "finite" };
      if (side === "both") return finish("finite", lh.value, lh.rat, one, one, steps, "lhopital");
      return finish("finite", lh.value, lh.rat, side === "left" ? one : null, side === "right" ? one : null, steps, "lhopital");
    }
    return decideSides(lp, rp, side, steps, "numeric", exprText);
  }

  /* ---- 无穷远处的极限 ---- */
  steps.push({
    desc: "代入判定：把 " + varName + " → " + targetText + " 代入 f(" + varName + ") = " + exprText +
      "，得不到有限值（" + (aKind === "inf" ? "趋于无穷远" : "沿负方向趋于无穷远") + "）。",
    expr: exprText,
  });
  const rational = rationalInfinityLimit(expr, varName);
  if (rational) {
    steps.push({
      desc: "分式判定：分子分母都是多项式，比较最高次项——" +
        (rational.kind === "finite" ? "次数相同或分子次数更低，极限为最高次系数之比。" : "分子次数更高，极限发散到无穷。"),
    });
    if (rational.kind === "finite") {
      const v = rational.rat.toNumber();
      const one = { value: v, kind: "finite" };
      return finish("finite", v, rational.rat, one, one, steps, "numeric");
    }
    const one = { value: rational.value, kind: "infinite" };
    return finish("infinite", rational.value, null, one, one, steps, "numeric");
  }
  const sign = aKind === "inf" ? 1 : -1;
  const probe = probeInfinity((x) => f(sign * x));
  steps.push({
    desc: "数值判定：在 " + varName + " 取 " + BIG_SCALES.slice(0, 4).map((s) => formatNumber(sign * s)).join("、") +
      " 等越来越大的点上求值，再用 1/x 外推，" + probe.note + "。",
  });
  const one = {
    value: probe.value,
    kind: probe.kind === "finite" ? "finite" : (probe.kind === "infinite" ? "infinite" : "none"),
  };
  if (probe.kind === "finite") return finish("finite", probe.value, probe.exactRat, one, one, steps, "numeric");
  if (probe.kind === "infinite") return finish("infinite", probe.value, null, one, one, steps, "numeric");
  return finish("none", null, null, one, one, steps, "numeric");
}

function isFiniteNum(x) { return typeof x === "number" && Number.isFinite(x); }

/** 表达式里是否含 |x|（在 0 处不可导，洛必达不适用）。 */
function hasAbs(n) {
  let found = false;
  walk(n, (k) => { if (k.t === "fn" && k.name === "abs") found = true; });
  return found;
}

function sideText(p) {
  if (p.kind === "finite") return formatNumber(p.value);
  if (p.kind === "infinite") return formatNumber(p.value);
  if (p.kind === "oscillate") return "振荡（无极限）";
  return "无法判定";
}

/** 组装最终返回结构。kind 为 infinite 时 value / left.value / right.value 都带符号。 */
function finish(kind, value, rat, left, right, steps, method) {
  const exact = (rat && kind === "finite") ? rat.toString() : null;
  return {
    exists: kind === "finite",
    value: (kind === "finite" || kind === "infinite") ? (value === undefined ? null : value) : null,
    exact,
    kind,
    left: left ? { value: left.value === undefined ? null : left.value, kind: left.kind } : { value: null, kind: "none" },
    right: right ? { value: right.value === undefined ? null : right.value, kind: right.kind } : { value: null, kind: "none" },
    steps,
    method,
  };
}

/** 洛必达：0/0 或 inf/inf 时对分子分母分别求导，最多 6 轮。 */
function tryLhopital(expr, a, varName, steps, aLabel) {
  const split = splitQuotient(expr);
  if (!split) return null;
  const aText = aLabel || formatNumber(a);
  let u = split.num, w = split.den;
  for (let i = 1; i <= MAX_LHOPITAL; i++) {
    const uv = ev(u, { x: a, varName });
    const wv = ev(w, { x: a, varName });
    const form = classifyForm(uv, wv);
    if (!form) break;
    steps.push({
      desc: "第 " + i + " 次洛必达：分子分母在 " + varName + " = " + aText + " 处构成 " + form +
        " 型不定式，对分子分母分别求导。",
      expr: "(" + toString(u) + ")' / (" + toString(w) + ")'",
    });
    u = deriv(u, varName);
    w = deriv(w, varName);
    const nv = ev(u, { x: a, varName });
    const wv2 = ev(w, { x: a, varName });
    if (Number.isFinite(nv) && Number.isFinite(wv2) && wv2 !== 0) {
      const v = nv / wv2;
      let rat = null;
      const ra = ratApprox(a, 1000000n, 1e-12);
      if (ra) {
        const ru = evalRat(u, ra, varName), rw = evalRat(w, ra, varName);
        if (ru !== null && rw !== null && !rw.isZero) rat = ru.div(rw);
      }
      if (!rat) rat = ratApprox(v, 100000n, 1e-9);
      steps.push({
        desc: "洛必达后代入得到 " + formatNumber(v) + (rat ? "（精确值 " + rat.toString() + "）" : "") + "，判定收敛。",
        expr: toString(u) + " / " + toString(w),
      });
      return { value: rat ? rat.toNumber() : v, rat };
    }
  }
  if (steps.length > 0 && steps[steps.length - 1].desc.startsWith("第")) {
    steps.push({ desc: "洛必达迭代到上限（" + MAX_LHOPITAL + " 次）仍未得到可代入的有限值，改用数值判定。" });
  }
  return null;
}

function classifyForm(uv, wv) {
  const infLike = (x) => x === Infinity || x === -Infinity || (typeof x === "number" && Math.abs(x) > 1e15);
  if (uv === 0 && wv === 0) return "0/0";
  if (infLike(uv) && infLike(wv)) return "inf/inf";
  return null;
}

/** 把表达式拆成 分子/分母（识别 a^-1 与除以常数）。 */
function splitQuotient(n) {
  const direct = splitOnce(n);
  if (direct) return direct;
  const { c, base } = coeffOf(n);
  if (base !== null && !c.isInt && !c.isZero) {
    return { num: makeProd([num(ri(c.n)), base]), den: num(ri(c.d)) };
  }
  return null;
}
function splitOnce(n) {
  if (n.t === "pow" && isNum(n.b) && n.b.v.isInt && n.b.v.sign < 0) {
    const e = n.b.v.neg();
    return { num: n1(), den: e.isOne ? n.a : { t: "pow", a: n.a, b: num(e) } };
  }
  if (n.t === "mul") {
    const fs = flattenProd(n);
    const dens = [], nums = [];
    for (const f of fs) {
      if (f.t === "pow" && isNum(f.b) && f.b.v.isInt && f.b.v.sign < 0) {
        const e = f.b.v.neg();
        dens.push(e.isOne ? f.a : { t: "pow", a: f.a, b: num(e) });
      } else if (isNum(f) && !f.v.isInt) {
        nums.push(num(ri(f.v.n)));
        dens.push(num(ri(f.v.d)));
      } else nums.push(f);
    }
    if (dens.length > 0) {
      const nn = nums.length ? buildMulList(nums) : n1();
      const dd = dens.length === 1 ? dens[0] : buildMulList(dens);
      return { num: simplify(nn), den: simplify(dd) };
    }
  }
  return null;
}

/** 用左右两侧的判定决定整体极限。无穷侧保留 ±∞ 符号。 */
function decideSides(lp, rp, side, steps, method, exprText) {
  const conv = (p) => ({
    value: p.kind === "finite" ? p.value : (p.kind === "infinite" ? p.value : null),
    kind: p.kind === "finite" ? "finite" : (p.kind === "infinite" ? "infinite" : "none"),
  });
  const L = conv(lp), Rr = conv(rp);

  if (side === "left") {
    if (lp.kind === "finite") return finish("finite", lp.value, lp.exactRat, L, null, steps, method);
    if (lp.kind === "infinite") return finish("infinite", lp.value, null, L, null, steps, method);
    steps.push({ desc: "左极限不存在（" + lp.note + "）。" });
    return finish("none", null, null, L, null, steps, method);
  }
  if (side === "right") {
    if (rp.kind === "finite") return finish("finite", rp.value, rp.exactRat, null, Rr, steps, method);
    if (rp.kind === "infinite") return finish("infinite", rp.value, null, null, Rr, steps, method);
    steps.push({ desc: "右极限不存在（" + rp.note + "）。" });
    return finish("none", null, null, null, Rr, steps, method);
  }

  // 双侧
  if (lp.kind === "finite" && rp.kind === "finite") {
    if (Math.abs(lp.value - rp.value) <= 1e-9 * Math.max(1, Math.abs(lp.value))) {
      return finish("finite", lp.value, lp.exactRat || ratApprox(lp.value), L, Rr, steps, method);
    }
    steps.push({
      desc: "两侧结果不一致：左极限 = " + formatNumber(lp.value) + "，右极限 = " + formatNumber(rp.value) +
        "，左右不相等，因此整体极限不存在。",
    });
    return finish("none", null, null, L, Rr, steps, "none");
  }
  if (lp.kind === "infinite" && rp.kind === "infinite") {
    const sameSign = (lp.value === Infinity && rp.value === Infinity) ||
      (lp.value === -Infinity && rp.value === -Infinity);
    if (sameSign) {
      steps.push({ desc: "两侧都趋于 " + formatNumber(lp.value) + "，判定为无穷极限（极限不存在，但趋势一致）。" });
      return finish("infinite", lp.value, null, L, Rr, steps, method);
    }
    steps.push({
      desc: "两侧符号不一致：左极限 = " + formatNumber(lp.value) + "，右极限 = " + formatNumber(rp.value) +
        "，整体极限不存在。",
    });
    return finish("none", null, null, L, Rr, steps, "none");
  }
  if (lp.kind === "oscillate" || rp.kind === "oscillate") {
    steps.push({
      desc: "振荡判定：在 " + exprText + " 的极限点附近取值随逼近不断上下摆动（" +
        (lp.kind === "oscillate" ? "左侧" + lp.note : "右侧" + rp.note) +
        "），属于振荡型极限，极限不存在。",
    });
    return finish("none", null, null, L, Rr, steps, "none");
  }
  if ((lp.kind === "finite" && rp.kind === "infinite") || (lp.kind === "infinite" && rp.kind === "finite")) {
    steps.push({
      desc: "左极限 = " + formatNumber(lp.value) + "，右极限 = " + formatNumber(rp.value) + "，左右不相等，整体极限不存在。",
    });
    return finish("none", null, null, L, Rr, steps, "none");
  }
  steps.push({ desc: "两侧都无法判定出稳定趋势，整体极限不存在。" });
  return finish("none", null, null, L, Rr, steps, "none");
}

/* ============================== 12. 积分 ============================== */

const MAX_INT_DEPTH = 12;

/**
 * 不定积分。能找到初等原函数就 ok:true。
 * 返回 { ok, F, text, reason }，text 形如 "x^3/3 + C"（带 + C）。
 */
export function integrate(node, varName = "x") {
  const x = simplify(clone(node));
  let F = null;
  try {
    F = intExpr(x, varName, 0);
  } catch (e) {
    F = null;
  }
  if (!F) {
    return {
      ok: false,
      F: null,
      text: null,
      reason: "找不到初等原函数（在支持的初等函数与换元/分部积分范围内无解，" +
        "例如形如 e^(-x^2) 的积分没有初等原函数）。被积函数：" + toString(x),
    };
  }
  const Fs = simplify(F);
  return { ok: true, F: Fs, text: toString(Fs) + " + C", reason: null };
}

/** 表达式级积分：和式拆项、常数因子外提、一般幂与换元。 */
function intExpr(n, v, depth) {
  if (depth > MAX_INT_DEPTH) return null;
  const node = simplify(n);
  if (isNum(node)) {
    if (node.v.isZero) return n0();
    return makeProd([num(node.v), variable(v)]);
  }
  if (node.t === "add") {
    const parts = [];
    for (const t of flattenSum(node)) {
      const r = intTerm(t, v, depth + 1);
      if (!r) return null;
      parts.push(r);
    }
    return simplifySum(parts);
  }
  if (node.t === "mul") {
    const fs = flattenProd(node);
    // 多项式 × e^x / sin / cos → 分部积分
    if (fs.length === 2) {
      const byParts = intByParts(fs[0], fs[1], v, depth);
      if (byParts) return byParts;
    }
    // 常数因子提出来
    let c = R1;
    const rest = [];
    for (const f of fs) { if (isNum(f)) c = c.mul(f.v); else rest.push(f); }
    if (rest.length === 0) return makeProd([num(c), variable(v)]);
    if (!c.isOne) {
      const inner = intExpr(rest.length === 1 ? rest[0] : buildMulList(rest), v, depth + 1);
      if (inner) return makeProd([num(c), inner]);
    }
    if (rest.length === 1) return intTerm(rest[0], v, depth + 1);
    // 多因子乘积：交给 intTerm 的模式匹配（如 x/(1+x^2) → (1/2)ln(1+x^2)）
    return intTerm(node, v, depth + 1);
  }
  return intTerm(node, v, depth + 1);
}

/** 单项积分。 */
function intTerm(node, v, depth) {
  if (depth > MAX_INT_DEPTH) return null;
  let n = simplify(node);
  if (isNum(n)) return makeProd([num(n.v), variable(v)]);
  if (n.t === "add") return intExpr(n, v, depth + 1);
  if (n.t === "neg") {
    const inner = intTerm(n.a, v, depth + 1);
    return inner ? makeProd([num(ri(-1)), inner]) : null;
  }
  // 常数系数外提（含 neg 以外的隐式系数）
  {
    const { c, base } = coeffOf(n);
    if (base !== null && !c.isOne) {
      const inner = intTerm(base, v, depth + 1);
      if (inner) return makeProd([num(c), inner]);
    }
  }

  // 1/(1+x^2) → atan(x)；1/sqrt(1-x^2) → asin(x)
  const at = matchAtan(n, v);
  if (at) return at;
  const as = matchAsin(n, v);
  if (as) return as;

  // 三角配对：sec^2、csc^2、sec·tan、csc·cot
  const tp = matchTrigPair(n, v);
  if (tp) return tp;

  // 除法换元：p(x)/q(x) 且 p 是 q 的常数倍 → k·ln|q|
  const ql = matchQuotientLog(n, v);
  if (ql) return ql;

  // 幂形式 u^k（u 为 x 或线性 ax+b）
  const pw = matchPow(n, v);
  if (pw) {
    const { k, a: linA, u } = pw;
    if (k.eq(ri(-1))) {
      const lnNode = { t: "fn", name: "ln", arg: { t: "fn", name: "abs", arg: u } };
      return linA.isOne ? lnNode : makeProd([num(linA.inv()), lnNode]);
    }
    const newK = k.add(R1);
    const coef = newK.mul(linA);
    return makeProd([num(coef.inv()), { t: "pow", a: u, b: num(newK) }]);
  }

  // 指数形式 a^(cx+d)：a = e 时 ∫ = e^(cx+d)/c；一般常数底数再除以 ln a
  if (n.t === "pow" && (isNum(n.a) || isENode(n.a))) {
    const lin = linearOf(n.b, v);
    if (lin) {
      if (isENode(n.a)) return lin.a.isOne ? n : makeProd([num(lin.a.inv()), n]);
      return { t: "mul", a: { t: "pow", a: { t: "fn", name: "ln", arg: n.a }, b: num(ri(-1)) }, b: n };
    }
  }

  // 函数型：f(ax+b)
  if (n.t === "fn" && n.arg) {
    const lin = linearOf(n.arg, v);
    if (!lin) return null;
    const u = simplify({ t: "add", a: makeProd([num(lin.a), variable(v)]), b: num(lin.b) });
    const r = antiderivFn(n.name, u);
    if (!r) return null;
    return lin.a.isOne ? r : makeProd([num(lin.a.inv()), r]);
  }
  return null;
}

/** 1/(1+x^2) → atan(x)。分子必须是 1，否则 x/(1+x^2) 会被误判成 atan。 */
function matchAtan(n, v) {
  const split = splitQuotient(n);
  if (!split) return null;
  if (!isOneNode(simplify(split.num))) return null;
  const den = simplify(split.den);
  const parts = flattenSum(den);
  if (parts.length !== 2) return null;
  if (!parts.some(isOneNode)) return null;
  const sq = parts.find((e) => e.t === "pow" && isNum(e.b) && e.b.v.eq(R2));
  if (!sq) return null;
  const lin = linearOf(sq.a, v);
  if (!lin) return null;
  const u = simplify({ t: "add", a: makeProd([num(lin.a), variable(v)]), b: num(lin.b) });
  return { t: "mul", a: num(lin.a.inv()), b: { t: "fn", name: "atan", arg: u } };
}

/** 1/sqrt(1-x^2) → asin(x)。分子同样必须是 1。 */
function matchAsin(n, v) {
  const split = splitQuotient(n);
  if (!split) return null;
  if (!isOneNode(simplify(split.num))) return null;
  const den = simplify(split.den);
  if (!(den.t === "fn" && den.name === "sqrt")) return null;
  const inner = flattenSum(den.arg);
  if (inner.length !== 2) return null;
  if (!inner.some(isOneNode)) return null;
  const negSq = inner.find((e) => e.t === "neg" && e.a.t === "pow" && isNum(e.a.b) && e.a.b.v.eq(R2));
  if (!negSq) return null;
  const lin = linearOf(negSq.a.a, v);
  if (!lin || !lin.a.eq(R1) || !lin.b.isZero) return null;
  return { t: "fn", name: "asin", arg: variable(v) };
}

/**
 * 三角配对积分（内层为线性 ax+b）：
 *   ∫sec²(u) = tan(u)、∫csc²(u) = -cot(u)、∫sec(u)tan(u) = sec(u)、∫csc(u)cot(u) = -csc(u)。
 * 内层 u = ax+b 时整体再除以 a（因为 d/du 的链式因子是 a）。
 */
function matchTrigPair(n, v) {
  let kind = null, fnNode = null;
  if (n.t === "pow" && isNum(n.b) && n.b.v.eq(R2) && n.a.t === "fn" &&
      (n.a.name === "sec" || n.a.name === "csc")) {
    kind = n.a.name === "sec" ? "tan" : "ncot"; // ∫sec² = tan，∫csc² = -cot
    fnNode = n.a;
  } else if (n.t === "mul") {
    const fs = flattenProd(n);
    if (fs.length === 2 && fs[0].t === "fn" && fs[1].t === "fn" && fs[0].arg && fs[1].arg &&
        key(fs[0].arg) === key(fs[1].arg)) {
      const names = [fs[0].name, fs[1].name].sort().join("+");
      if (names === "sec+tan") { kind = "sec"; fnNode = fs[0].name === "sec" ? fs[0] : fs[1]; }
      else if (names === "cot+csc") { kind = "ncsc"; fnNode = fs[0].name === "csc" ? fs[0] : fs[1]; }
    }
  }
  if (!kind) return null;
  const lin = linearOf(fnNode.arg, v);
  if (!lin) return null;
  const u = lin.b.isZero
    ? variable(v)
    : simplify({ t: "add", a: makeProd([num(lin.a), variable(v)]), b: num(lin.b) });
  let base;
  if (kind === "tan") base = { t: "fn", name: "tan", arg: u };
  else if (kind === "ncot") base = { t: "neg", a: { t: "fn", name: "cot", arg: u } };
  else if (kind === "sec") base = { t: "fn", name: "sec", arg: u };
  else base = { t: "neg", a: { t: "fn", name: "csc", arg: u } };
  return lin.a.isOne ? base : makeProd([num(lin.a.inv()), base]);
}

/** 匹配 u^k（u 是 x 或线性 ax+b）。sqrt(u) 也按 u^(1/2) 处理。 */
function matchPow(n, v) {
  if (n.t === "fn" && n.name === "sqrt" && n.arg) {
    const lin = linearOf(n.arg, v);
    if (!lin) return null;
    const u = lin.b.isZero
      ? variable(v)
      : simplify({ t: "add", a: makeProd([num(lin.a), variable(v)]), b: num(lin.b) });
    return { k: RHALF, a: lin.a, b: lin.b, u };
  }
  if (n.t === "pow" && isNum(n.b)) {
    const lin = linearOf(n.a, v);
    if (!lin) return null;
    const u = lin.b.isZero
      ? variable(v)
      : simplify({ t: "add", a: makeProd([num(lin.a), variable(v)]), b: num(lin.b) });
    return { k: n.b.v, a: lin.a, b: lin.b, u };
  }
  if (n.t === "var" && n.name === v) return { k: R1, a: R1, b: R0, u: variable(v) };
  return null;
}

/**
 * 除法换元：∫ p(x)/q(x) dx。判据是「q 的导数」与「p 的导数」成正比，
 * 此时原函数为 k·ln|q|。覆盖 x/(1+x^2)、(2x+1)/(x^2+x+1) 这类常见题
 * （分母允许是二次式，只要它的导数是线性的）。
 */
function matchQuotientLog(n, v) {
  if (n.t !== "mul") return null;
  const fs = flattenProd(n);
  let numNode = null, denNode = null;
  for (const f of fs) {
    if (f.t === "pow" && isNum(f.b) && f.b.v.isInt && f.b.v.sign < 0) {
      if (denNode) return null;
      const e = f.b.v.neg();
      // 分母取正指数形式：1/(1+x^2) → 1+x^2
      denNode = e.isOne ? f.a : { t: "pow", a: f.a, b: num(e) };
    } else {
      numNode = numNode === null ? f : { t: "mul", a: numNode, b: f };
    }
  }
  if (numNode === null || denNode === null) return null;
  // 判据：分子 p 必须是分母导数 q' 的常数倍（p = k·q'），此时 ∫p/q = k·ln|q|。
  // 例：x/(1+x^2) 中 p = x、q' = 2x → k = 1/2 → (1/2)ln(1+x^2)。
  const p = linRec(simplify(numNode), v);
  const qp = linRec(simplify(deriv(denNode, v)), v);
  if (!p || !qp || qp.a.isZero) return null;
  if (!p.b.mul(qp.a).sub(qp.b.mul(p.a)).isZero) return null; // p 与 q' 成正比
  const k = p.a.div(qp.a);
  if (k.isZero) return null;
  const u = simplify(denNode);
  const lnNode = { t: "fn", name: "ln", arg: { t: "fn", name: "abs", arg: u } };
  return k.isOne ? lnNode : makeProd([num(k), lnNode]);
}

/** 线性内层识别：ax+b（a≠0）。 */
function linearOf(node, v) {
  const r = linRec(simplify(node), v);
  if (!r || r.a.isZero) return null;
  return r;
}
function linRec(n, v) {
  if (n.t === "num") return { a: R0, b: n.v };
  if (n.t === "var") return n.name === v ? { a: R1, b: R0 } : null;
  if (n.t === "neg") { const r = linRec(n.a, v); return r ? { a: r.a.neg(), b: r.b.neg() } : null; }
  if (n.t === "add") {
    const A = linRec(n.a, v), B = linRec(n.b, v);
    return (A && B) ? { a: A.a.add(B.a), b: A.b.add(B.b) } : null;
  }
  if (n.t === "mul") {
    const A = linRec(n.a, v), B = linRec(n.b, v);
    if (!A || !B) return null;
    if (!A.a.isZero && !B.a.isZero) return null;
    return { a: A.a.mul(B.b).add(B.a.mul(A.b)), b: A.b.mul(B.b) };
  }
  // x^k：k = 0 视为常数；k ≥ 1 不是线性函数，返回零多项式让调用方判为「非线性」
  if (n.t === "pow" && isNum(n.b) && n.b.v.isInt && n.b.v.sign >= 0) {
    return n.b.v.isZero ? { a: R0, b: R1 } : { a: R0, b: R0 };
  }
  return null;
}

/** 常见函数的原函数（内层已是 u）。 */
function antiderivFn(name, u) {
  switch (name) {
    case "sin": return { t: "neg", a: { t: "fn", name: "cos", arg: u } };
    case "cos": return { t: "fn", name: "sin", arg: u };
    case "exp": return { t: "fn", name: "exp", arg: u };
    case "e": return { t: "fn", name: "e", arg: null };
    case "ln":
    case "log":
      return { t: "add", a: { t: "mul", a: u, b: { t: "fn", name: "ln", arg: u } }, b: { t: "neg", a: u } };
    case "tan":
      return { t: "neg", a: { t: "fn", name: "ln", arg: { t: "fn", name: "abs", arg: { t: "fn", name: "cos", arg: u } } } };
    case "cot":
      return { t: "fn", name: "ln", arg: { t: "fn", name: "abs", arg: { t: "fn", name: "sin", arg: u } } };
    case "sec":
      return {
        t: "fn",
        name: "ln",
        arg: {
          t: "fn",
          name: "abs",
          arg: { t: "add", a: { t: "fn", name: "sec", arg: u }, b: { t: "fn", name: "tan", arg: u } },
        },
      };
    case "csc":
      return {
        t: "neg",
        a: {
          t: "fn",
          name: "ln",
          arg: {
            t: "fn",
            name: "abs",
            arg: { t: "add", a: { t: "fn", name: "csc", arg: u }, b: { t: "fn", name: "cot", arg: u } },
          },
        },
      };
    case "sinh": return { t: "fn", name: "cosh", arg: u };
    case "cosh": return { t: "fn", name: "sinh", arg: u };
    case "tanh": return { t: "fn", name: "ln", arg: { t: "fn", name: "cosh", arg: u } };
    case "atan": {
      const lnPart = { t: "fn", name: "ln", arg: { t: "add", a: n1(), b: { t: "pow", a: u, b: num(R2) } } };
      return {
        t: "add",
        a: { t: "mul", a: u, b: { t: "fn", name: "atan", arg: u } },
        b: { t: "mul", a: num(RHALF), b: { t: "neg", a: lnPart } },
      };
    }
    default: return null;
  }
}

/** 分部积分：多项式 × e^x / sin / cos。 */
function intByParts(A, B, v, depth) {
  if (depth > MAX_INT_DEPTH) return null;
  for (const [u0, dv0] of [[A, B], [B, A]]) {
    const u = simplify(clone(u0));
    const dv = simplify(clone(dv0));
    if (classifyForParts(u, v) !== "poly") continue;
    if (classifyForParts(dv, v) !== "elementary") continue;
    const V = intTerm(dv, v, depth + 1);
    if (!V) continue;
    const du = deriv(u, v);
    if (isZeroNode(du)) continue;
    const rest = intExpr({ t: "mul", a: simplify(V), b: du }, v, depth + 1);
    if (!rest) continue;
    return simplify({
      t: "add",
      a: { t: "mul", a: u, b: simplify(V) },
      b: { t: "neg", a: rest },
    });
  }
  return null;
}

function classifyForParts(n, v) {
  const isElem = (e) => {
    if (e.t !== "fn") return false;
    if (e.name === "e") return true;
    if (e.name === "exp" || e.name === "sin" || e.name === "cos") return !!linearOf(e.arg, v);
    return false;
  };
  if (isElem(n)) return "elementary";
  // polyCoeffs 保证返回 null 时不是关于 v 的多项式（纯常数也会返回 null）
  return polyCoeffs(n, v) ? "poly" : "other";
}

/* ============================== 12.5 精确常数归约 ============================== */

// 三角函数在 π 的有理倍数处的精确值：值 = (分子/分母) × atom，atom 取 "" / "sqrt2" / "sqrt3"。
// 表里只列 k ≥ 0 的项：odd 的函数在 k < 0 时取相反数，even 的函数直接用 |k|。
const PI_TRIG_EXACT = {
  sin: { odd: true, map: { "0": [0, 1, ""], "1/6": [1, 2, ""], "1/4": [1, 2, "sqrt2"], "1/3": [1, 2, "sqrt3"], "1/2": [1, 1, ""], "1": [0, 1, ""], "3/2": [-1, 1, ""], "2": [0, 1, ""] } },
  cos: { even: true, map: { "0": [1, 1, ""], "1/6": [1, 2, "sqrt3"], "1/4": [1, 2, "sqrt2"], "1/3": [1, 2, ""], "1/2": [0, 1, ""], "1": [-1, 1, ""], "3/2": [0, 1, ""], "2": [1, 1, ""] } },
  tan: { odd: true, map: { "0": [0, 1, ""], "1/6": [1, 3, "sqrt3"], "1/4": [1, 1, ""], "1/3": [1, 1, "sqrt3"], "1": [0, 1, ""] } },
  cot: { odd: true, map: { "1/6": [1, 1, "sqrt3"], "1/4": [1, 1, ""], "1/3": [1, 3, "sqrt3"], "1/2": [0, 1, ""] } },
  sec: { even: true, map: { "0": [1, 1, ""], "1/3": [2, 1, ""], "2/3": [-2, 1, ""], "1": [-1, 1, ""] } },
  csc: { odd: true, map: { "1/6": [2, 1, ""], "1/2": [1, 1, ""], "5/6": [2, 1, ""], "3/2": [-1, 1, ""] } },
};

// 反三角在特殊点上的精确值：值 = k·π。
const INV_TRIG_EXACT = {
  asin: { "0": [0, 1], "1": [1, 2], "-1": [-1, 2], "1/2": [1, 6], "-1/2": [-1, 6] },
  acos: { "1": [0, 1], "0": [1, 2], "-1": [1, 1], "1/2": [1, 3], "-1/2": [2, 3] },
  atan: { "0": [0, 1], "1": [1, 4], "-1": [-1, 4] },
};

/** 整数平方根；不是完全平方返回 null。 */
function bigSqrt(v) {
  if (v < 0n) return null;
  if (v < 2n) return v;
  let x = v, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + v / x) / 2n; }
  return x * x === v ? x : null;
}

/** 整数的 q 次方根（q = 2..8）；不是完全方幂返回 null。 */
function bigRoot(v, q) {
  if (v < 0n || q < 2) return null;
  if (v < 2n) return v;
  const guess = BigInt(Math.floor(Math.pow(Number(v), 1 / q)));
  for (let d = -2n; d <= 2n; d++) {
    const c = guess + d;
    if (c >= 0n && c ** BigInt(q) === v) return c;
  }
  return null;
}

/** 有理数的精确平方根；不是完全平方返回 null。 */
function perfectSqrt(r) {
  const n = bigSqrt(r.n), d = bigSqrt(r.d);
  return (n !== null && d !== null) ? new Rat(n, d) : null;
}

/** 常数节点是否正好落在 k·π 上（k 为有理数）；返回 k 或 null。 */
function piMultiple(n) {
  if (!n) return null;
  if (isNum(n)) return n.v.isZero ? R0 : null;
  if (n.t === "neg") { const k = piMultiple(n.a); return k === null ? null : k.neg(); }
  if (n.t === "fn" && n.name === "pi" && n.arg === null) return R1;
  if (n.t === "mul") {
    const fs = flattenProd(n);
    if (fs.length !== 2) return null;
    const c = fs.find(isNum);
    const p = fs.find((f) => f.t === "fn" && f.name === "pi" && f.arg === null);
    return (c && p) ? c.v : null;
  }
  return null;
}

/** 由 [分子, 分母, atom] 造精确值节点：atom 为空 → 有理数，sqrt2 / sqrt3 → 带根号的闭式。 */
function exactFromSpec(e, neg) {
  let c = new Rat(BigInt(e[0]), BigInt(e[1]));
  if (neg) c = c.neg();
  if (e[2] === "") return num(c);
  const base = { t: "fn", name: "sqrt", arg: num(e[2] === "sqrt2" ? R2 : ri(3)) };
  if (c.isZero) return n0();
  if (c.isOne) return base;
  if (c.eq(ri(-1))) return { t: "neg", a: base };
  return { t: "mul", a: num(c), b: base };
}

/** 三角函数在 k·π 处的精确值；没有闭式（含无定义）返回 null。 */
function trigAtPi(name, k) {
  const spec = PI_TRIG_EXACT[name];
  if (!spec) return null;
  const neg = k.sign < 0;
  const e = spec.map[(neg ? k.neg() : k).toString()];
  if (!e) return null;
  return exactFromSpec(e, neg && spec.odd);
}

/** 反三角特殊值：值 = k·π。 */
function invTrigExact(name, arg) {
  const e = INV_TRIG_EXACT[name][arg.toString()];
  if (!e) return null;
  const k = new Rat(BigInt(e[0]), BigInt(e[1]));
  if (k.isZero) return n0();
  if (k.isOne) return PI_NODE();
  if (k.eq(ri(-1))) return { t: "neg", a: PI_NODE() };
  return { t: "mul", a: num(k), b: PI_NODE() };
}

/** 有理数底数的整数次幂展开（含 (c·u)^n 分配律），保证 π^2/8 这种结果不会写成 (pi/2)^2/2。 */
function expandPowInt(a, n) {
  if (n === 0) return n1();
  if (n > 64) return null;
  if (isNum(a)) {
    const r = powRat(a.v, num(ri(n)));
    return r ? num(r) : null;
  }
  if (a.t === "neg") {
    const inner = expandPowInt(a.a, n);
    if (inner === null) return null;
    return n % 2 === 1 ? simplify({ t: "neg", a: inner }) : inner;
  }
  if (a.t === "mul") {
    let acc = n1();
    for (const f of flattenProd(a)) {
      const r = expandPowInt(f, n);
      if (r === null) return null;
      acc = simplify({ t: "mul", a: acc, b: r });
    }
    return acc;
  }
  if (a.t === "pow" && isNum(a.b) && a.b.v.isInt) return reducePow(a.a, num(a.b.v.mul(ri(n))));
  if (a.t === "fn" && a.name === "sqrt" && isNum(a.arg) && a.arg.v.sign >= 0) {
    // (√q)^n = q^(n/2)：偶数次是有理数，奇数次 = q^((n-1)/2)·√q
    const coef = powRat(a.arg.v, num(ri(Math.floor(n / 2))));
    if (coef === null) return null;
    if (n % 2 === 0) return num(coef);
    const base = { t: "fn", name: "sqrt", arg: num(a.arg.v) };
    if (coef.isZero) return n0();
    if (coef.isOne) return base;
    return { t: "mul", a: num(coef), b: base };
  }
  return { t: "pow", a, b: num(ri(n)) };
}

/** 幂的精确归约：整数指数走展开，有理数的分数次幂折成闭式或根式。 */
function reducePow(a, b) {
  if (!isNum(b)) return null;
  if (b.v.isInt) {
    const k = b.v.n;
    if (k === 0n) return n1();
    if (k > 0n) return Number(k) > 64 ? null : expandPowInt(a, Number(k));
    const pos = expandPowInt(a, Number(-k));
    if (pos === null) return null;
    if (isNum(pos)) return pos.v.isZero ? null : num(pos.v.inv());
    return { t: "pow", a: pos, b: num(ri(-1)) };
  }
  if (isNum(a) && a.v.sign < 0) return null; // 负数底数的非整数次幂不在实数范围内
  if (isNum(a)) {
    if (a.v.isZero) return b.v.sign > 0 ? n0() : null;
    const q = b.v.d; // 指数 = p/q（q ≥ 2）
    if (q > 8n) return null;
    const rn = bigRoot(a.v.n, Number(q)), rd = bigRoot(a.v.d, Number(q));
    if (rn !== null && rd !== null) {
      // 底数是完全 q 次方幂：a^(p/q) = (a^(1/q))^p，直接折成有理数
      const r = powRat(new Rat(rn, rd), num(b.v.mul(new Rat(q))));
      if (r) return num(r);
    }
    if (q === 2n) {
      // 半整数指数：写成 有理数·√a（a^(p/2) = a^((p-1)/2)·√a）
      const p = b.v.mul(R2);
      const coef = powRat(a.v, num(p.sub(R1).div(R2)));
      if (coef === null) return null;
      const base = { t: "fn", name: "sqrt", arg: num(a.v) };
      if (coef.isZero) return n0();
      if (coef.isOne) return base;
      if (coef.eq(ri(-1))) return { t: "neg", a: base };
      return { t: "mul", a: num(coef), b: base };
    }
    return null; // 2^(1/3) 这类没有好看的闭式写法，交给数值路径
  }
  return { t: "pow", a, b }; // π^(1/2) 这类保留幂形式（仍是闭式）
}

/** 具体函数的精确值归约：只认能写死的恒等式，认不出就返回 null（交给数值路径）。 */
function reduceFn(name, a) {
  if (name === "abs") {
    if (isNum(a)) return num(a.v.abs());
    if (a.t === "neg") return a.a;
    if (a.t === "fn" && (a.name === "pi" || a.name === "e" || a.name === "sqrt")) return a;
    if (a.t === "mul" && isNum(a.a) && a.a.v.sign < 0) {
      return makeProd([num(a.a.v.abs()), a.b]);
    }
    return null;
  }
  if (name === "ln" || name === "log") {
    if (isNum(a)) return a.v.isOne ? n0() : null;
    if (isENode(a)) return n1();
    if (a.t === "fn" && a.name === "exp" && isNum(a.arg)) return num(a.arg.v);
    if (a.t === "pow" && isENode(a.a) && isNum(a.b)) return num(a.b.v);
    return null;
  }
  if (name === "exp") {
    if (isNum(a)) {
      if (a.v.isZero) return n1();
      if (a.v.isOne) return E_NODE();
      return { t: "fn", name: "exp", arg: num(a.v) }; // e^r 本身就是闭式
    }
    if (a.t === "fn" && (a.name === "ln" || a.name === "log")) return a.arg; // e^(ln u) = u
    const fs = a.t === "mul" ? flattenProd(a) : [];
    if (fs.length === 2 && isNum(fs[0]) && fs[1].t === "fn" && fs[1].name === "ln" &&
        isNum(fs[1].arg) && fs[1].arg.v.sign > 0) {
      const r = powRat(fs[1].arg.v, num(fs[0].v)); // 只处理整数倍：e^(k·ln c) = c^k
      if (r) return num(r);
    }
    return null;
  }
  if (name === "sqrt") {
    if (!isNum(a) || a.v.sign < 0) return null;
    const sq = perfectSqrt(a.v);
    return sq ? num(sq) : { t: "fn", name: "sqrt", arg: num(a.v) }; // √2 这类无理数原子
  }
  if (PI_TRIG_EXACT[name]) {
    const k = piMultiple(a);
    return k === null ? null : trigAtPi(name, k);
  }
  if (INV_TRIG_EXACT[name]) return isNum(a) ? invTrigExact(name, a.v) : null;
  if (name === "sinh" || name === "tanh") return (isNum(a) && a.v.isZero) ? n0() : null;
  if (name === "cosh") return (isNum(a) && a.v.isZero) ? n1() : null;
  return null;
}

/**
 * 把「只含数字 / pi / e 的常数表达式」按精确恒等式归约成闭式；归约不出来返回 null。
 * 用于定积分的符号代入 F(b) - F(a)：能归约出闭式才给 exact，否则如实走数值。
 */
function reduceConst(n) {
  if (!n || typeof n !== "object") return null;
  switch (n.t) {
    case "num": return num(n.v);
    case "var": return null;
    case "neg": {
      const a = reduceConst(n.a);
      return a === null ? null : simplify({ t: "neg", a });
    }
    case "add": {
      const a = reduceConst(n.a), b = reduceConst(n.b);
      return (a === null || b === null) ? null : simplify({ t: "add", a, b });
    }
    case "mul": {
      const a = reduceConst(n.a), b = reduceConst(n.b);
      return (a === null || b === null) ? null : simplify({ t: "mul", a, b });
    }
    case "pow": {
      const a = reduceConst(n.a), b = reduceConst(n.b);
      return (a === null || b === null) ? null : reducePow(a, b);
    }
    case "fn": {
      if (n.arg === null) return (n.name === "pi" || n.name === "e") ? { t: "fn", name: n.name, arg: null } : null;
      const a = reduceConst(n.arg);
      return a === null ? null : reduceFn(n.name, a);
    }
    default: return null;
  }
}

/** 闭式白名单：结果只能由有理数、pi、e、√(正有理数)、e^有理数 及其四则/整数幂组成。 */
function isClosedConst(n) {
  switch (n.t) {
    case "num": return true;
    case "neg": return isClosedConst(n.a);
    case "add":
    case "mul": return isClosedConst(n.a) && isClosedConst(n.b);
    case "pow": return isClosedConst(n.a) && isNum(n.b);
    case "fn":
      if (n.arg === null) return n.name === "pi" || n.name === "e";
      if (n.name === "sqrt") return isNum(n.arg) && n.arg.v.sign >= 0;
      if (n.name === "exp") return isNum(n.arg);
      return false;
    default: return false;
  }
}

/** 打印前的整理：exp(有理数) 写成 e^有理数，页面上显示成 e² 更好读。 */
function tidyConst(n) {
  if (n.t === "fn") {
    const arg = n.arg ? tidyConst(n.arg) : null;
    if (n.name === "exp" && arg && isNum(arg)) return { t: "pow", a: E_NODE(), b: arg };
    return { t: "fn", name: n.name, arg };
  }
  if (n.t === "neg") return { t: "neg", a: tidyConst(n.a) };
  if (n.t === "add") return { t: "add", a: tidyConst(n.a), b: tidyConst(n.b) };
  if (n.t === "mul") return { t: "mul", a: tidyConst(n.a), b: tidyConst(n.b) };
  if (n.t === "pow") return { t: "pow", a: tidyConst(n.a), b: tidyConst(n.b) };
  return n;
}

/** 把表达式里的变量 v 整体换成常量节点 sub。 */
function substConst(n, v, sub) {
  switch (n.t) {
    case "num": return n;
    case "var": return n.name === v ? clone(sub) : n;
    case "neg": return { t: "neg", a: substConst(n.a, v, sub) };
    case "add": return { t: "add", a: substConst(n.a, v, sub), b: substConst(n.b, v, sub) };
    case "mul": return { t: "mul", a: substConst(n.a, v, sub), b: substConst(n.b, v, sub) };
    case "pow": return { t: "pow", a: substConst(n.a, v, sub), b: substConst(n.b, v, sub) };
    case "fn": return { t: "fn", name: n.name, arg: n.arg ? substConst(n.arg, v, sub) : null };
    default: throw new Error("未知的 AST 节点类型：" + n.t);
  }
}

/** 浮点数端点 → 精确节点：整数原样，短十进制还原成分数，其余按十进制精确展开。 */
function numberNode(x) {
  if (Number.isInteger(x)) return num(ri(x));
  const r = ratApprox(x, 1000000n, 1e-12);
  return num(r || decToRat(String(x)));
}

/**
 * 点值解析：接受 number，或含 pi / e 的表达式字符串（"pi/2"、"2*pi"、"1/3"）。
 * 返回 { node, num, text }；text 是规范化后的 ASCII 表达式，可写进判定过程。
 * 出错时抛中文错误。
 */
function constPoint(t, what) {
  if (typeof t === "number") {
    if (!Number.isFinite(t)) throw new Error(what + "必须是有限数值");
    return { node: numberNode(t), num: t, text: formatNumber(t) };
  }
  if (typeof t === "string") {
    const s = t.trim();
    if (!s) throw new Error(what + "不能为空");
    let node;
    try { node = simplify(parse(s)); }
    catch (e) {
      throw new Error(what + "看不懂：" + (e && e.message ? e.message : String(e)) +
        "。可以写数字，或含 pi / e 的表达式，例如 pi/2、2*pi、1/3");
    }
    let hasVar = false;
    walk(node, (k) => { if (k.t === "var") hasVar = true; });
    if (hasVar) throw new Error(what + "不能含变量，只能写数字或含 pi / e 的表达式，例如 pi/2、2*pi、1/3");
    const v = ev(node, { x: NaN, varName: "__none__" });
    if (!Number.isFinite(v)) throw new Error(what + "算不出有限数值：" + s);
    return { node, num: v, text: toString(node) };
  }
  throw new Error(what + "必须是数字或表达式");
}

/* ============================== 13. 定积分 ============================== */

function simpson(f, a, b, n) {
  const N = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / N;
  let s = f(a) + f(b);
  for (let i = 1; i < N; i++) {
    const y = f(a + i * h);
    if (Number.isNaN(y)) return NaN;
    s += (i % 2 === 0 ? 2 : 4) * y;
  }
  return (s * h) / 3;
}

/** 自适应 Simpson，带迭代上限，防死循环。 */
function adaptiveSimpson(f, a, b, eps = 1e-10, maxDepth = 20) {
  const stack = [[a, b, simpson(f, a, b, 2), eps, 0]];
  let total = 0;
  let guard = 0;
  while (stack.length > 0) {
    if (++guard > 4000) return NaN;
    const [l, r, whole, tol, depth] = stack.pop();
    const m = (l + r) / 2;
    const left = simpson(f, l, m, 2);
    const right = simpson(f, m, r, 2);
    const delta = left + right - whole;
    if (depth >= maxDepth || Math.abs(delta) <= 15 * tol) {
      total += left + right + delta / 15;
    } else {
      stack.push([l, m, left, tol / 2, depth + 1], [m, r, right, tol / 2, depth + 1]);
    }
  }
  return total;
}

/**
 * 定积分。
 * 端点 a、b 可以是数字，也可以是含 pi / e 的表达式（"pi"、"pi/2"、"2*pi"、"1/3"）。
 * 有初等原函数时先做符号代入 F(b) - F(a) 并归约出精确表达式；归约不出闭式、
 * 或区间内被积函数无界（反常积分）、或与数值积分对不上时，都只给数值结果。
 * 返回 { numeric, exact, approxText, aNum, bNum, bounds, note }。
 */
/* 瑕积分（广义积分）：端点上被积函数趋于 ±∞ 时的处理。
   1) 有原函数时：在端点向区间内缩进取值，若能收敛到有限极限（如 x·ln x − x 在 0 处 → 0）就采用；
   2) 没有原函数时：在缩进区间上做自适应 Simpson，再看缩进序列是否收敛（收敛则外推，发散则判定发散）。 */
function antiderivLimit(F, x0, inward, singular, varName) {
  if (!singular) {
    const v = ev(F, { x: x0, varName });
    return Number.isFinite(v) ? { value: v, limit: false } : null;
  }
  const deltas = [1e-3, 1e-5, 1e-7, 1e-9, 1e-11];
  const vals = [];
  for (const d of deltas) {
    const v = ev(F, { x: x0 + inward * d, varName });
    if (!Number.isFinite(v)) return null;
    vals.push(v);
  }
  const last = vals[vals.length - 1], prev = vals[vals.length - 2];
  if (Math.abs(last - prev) < 1e-5 * Math.max(1, Math.abs(last))) return { value: last, limit: true };
  return null;
}
function improperSimpson(f, A, B, singA, singB) {
  const deltas = [1e-3, 1e-5, 1e-7, 1e-9];
  const vals = [];
  for (const d of deltas) {
    const lo = singA ? A + d : A, hi = singB ? B - d : B;
    if (!(hi > lo)) continue;
    /* 缩进太狠时自适应 Simpson 可能到不了精度（例如 1/√x 在 1e-9 附近），
       这种点直接跳过，用还能算准的几个点外推，而不是整段放弃。 */
    const v = adaptiveSimpson(f, lo, hi, 1e-8, 24);
    if (Number.isFinite(v)) vals.push(v);
  }
  if (vals.length < 2) return null;
  const n = vals.length, last = vals[n - 1], prev = vals[n - 2];
  const near = Math.abs(last - prev);
  if (near < 1e-5 * Math.max(1, Math.abs(last))) return { value: last };
  /* δ 按 100 倍缩小：对 √δ 型（p=1/2）误差项，Richardson 系数 100^0.5−1 = 9。
     变化在变小说明在收敛，就外推；否则判发散。 */
  const before = n >= 3 ? Math.abs(vals[n - 2] - vals[n - 3]) : Infinity;
  if (near < before) {
    const ext = last + (last - prev) / 9;
    if (Number.isFinite(ext) && Math.abs(ext) < 1e12) return { value: ext, extrapolated: true };
  }
  return null; /* 随缩进不收敛 → 判定发散 */
}

export function definiteIntegral(node, a, b, varName = "x") {
  const pa = constPoint(a, "定积分的下限");
  const pb = constPoint(b, "定积分的上限");
  const A = pa.num, B = pb.num;
  const expr = simplify(clone(node));
  const f = (x) => ev(expr, { x, varName });
  const parts = integrate(expr, varName);
  const singA = !Number.isFinite(f(A));
  const singB = !Number.isFinite(f(B));
  const improper = singA || singB;

  let exact = null, numeric = null, note = null, divergent = false;
  if (parts.ok && parts.F) {
    // 符号代入：把变量换成端点表达式（可能是 pi/2 这种），再化简、再归约
    const diff = simplify({
      t: "add",
      a: substConst(parts.F, varName, pb.node),
      b: { t: "neg", a: substConst(parts.F, varName, pa.node) },
    });
    const closed = reduceConst(diff); // 归约不出闭式就返回 null，交给数值路径
    if (closed !== null && isClosedConst(closed)) {
      const v = ev(closed, { x: NaN, varName: "__none__" });
      if (Number.isFinite(v)) { exact = toString(tidyConst(closed)); numeric = v; }
    }
    /* 端点奇异时符号代入会得到 NaN（例如 x·ln x 在 0 处）——改为向内缩进取极限值 */
    if (numeric === null || !Number.isFinite(numeric)) {
      const fa = antiderivLimit(parts.F, A, +1, singA, varName);
      const fb = antiderivLimit(parts.F, B, -1, singB, varName);
      if (fa && fb) {
        numeric = fb.value - fa.value;
        if (improper) note = "端点处被积函数趋于无穷，这是瑕积分；用原函数在该端点的极限值算得收敛结果。";
        if (fa.limit || fb.limit) exact = null;
      }
    }
  }

  // 候选精确值要用自适应 Simpson 交叉验证：对不上就撤掉 exact，只留数值
  if (exact !== null) {
    const check = adaptiveSimpson(f, A, B, 1e-9, 18);
    if (!Number.isFinite(check)) {
      exact = null;
      note = improper
        ? "端点处被积函数趋于无穷（瑕积分），精确式无法直接代入，改给数值结果。"
        : "区间内有被积函数无界的点（反常积分），只给数值结果。";
    } else if (Math.abs(check - numeric) > 1e-6 * Math.max(1, Math.abs(numeric))) {
      exact = null;
      numeric = check;
      note = "符号代入的结果与数值积分对不上，只给数值结果。";
    }
  }
  if (numeric === null || !Number.isFinite(numeric)) {
    if (improper) {
      /* 瑕积分：缩进 + 外推；不收敛就是真发散 */
      const imp = improperSimpson(f, A, B, singA, singB);
      if (imp) {
        numeric = imp.value;
        if (note === null) {
          note = "端点处被积函数趋于无穷，这是瑕积分（广义积分）；它收敛，数值" +
            (imp.extrapolated ? "经缩进外推得到。" : "由缩进区间逼近得到。");
        }
        if (!imp.extrapolated) exact = null;
      } else {
        divergent = true;
        note = "端点处被积函数趋于无穷，而且缩进后数值不收敛 —— 该广义积分发散。";
      }
    } else {
      numeric = adaptiveSimpson(f, A, B, 1e-11, 20);
      if (numeric === null || !Number.isFinite(numeric)) {
        divergent = true;
        note = "数值积分在区间内取不到有限值，该积分可能发散。";
      } else if (note === null && parts.ok && parts.F) {
        note = "原函数在端点上取不到有限值，改用数值积分。";
      }
    }
  }
  return {
    numeric: divergent ? null : numeric,
    exact,
    divergent,
    improper,
    approxText: numericText(divergent ? NaN : numeric),
    aNum: A,
    bNum: B,
    bounds: { a: pa.text, b: pb.text },
    note,
  };
}

/* ============================== 14. 便捷入口 ============================== */

/** 便捷：字符串直接求导（返回已化简的 AST）。 */
export function derivText(src, varName = "x") { return deriv(parse(src), varName); }
/** 便捷：字符串直接求值。 */
export function evalText(src, x, varName = "x") { return evalAt(parse(src), x, varName); }
/** 便捷：字符串直接化简。 */
export function simplifyText(src) { return simplify(parse(src)); }

export { Rat };
export default {
  parse, simplify, toString, evalAt, deriv, taylor, limit, integrate, definiteIntegral, Rat,
};

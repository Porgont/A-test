// 把 src/calc.part*.mjs 按顺序拼成 src/calc-core.mjs。
// 为什么要分段：单个 68 KB / 1800 行的文件一次性重写风险大，
// 而且这台机器上用命令行写文件会把 UTF-8 弄坏（GBK 往返），
// 所以约定：分段文件一律用文件工具（UTF-8）写，绝不走命令行。
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const parts = readdirSync(join(root, "src"))
  .filter((f) => /^calc\.part\d+\.mjs$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

if (!parts.length) {
  console.error("FAIL: src/ 下没有 calc.partN.mjs 分段文件");
  process.exit(2);
}

let out = "";
for (const f of parts) {
  const body = readFileSync(join(root, "src", f), "utf8");
  if (/^\s*(export|import)\s/m.test(body)) {
    console.error("FAIL: " + f + " 里还有 import/export —— 分段文件必须是纯声明，不能有模块语法");
    process.exit(2);
  }
  out += "/* ===== " + f + " ===== */\n" + body.trim() + "\n\n";
}

const shim = `
/* ===== 导出给页面 UI 用的命名空间 ===== */
var Calc = {
  parse: parse, simplify: simplify, str: toString, evalAt: evalAt,
  deriv: deriv, taylor: taylor, limit: limit,
  integrate: integrate, definiteIntegral: definiteIntegral
};
`;

writeFileSync(join(root, "src", "calc-core.mjs"), out + shim);
console.log("拼接 " + parts.length + " 段 → src/calc-core.mjs  "
  + Math.round((out.length + shim.length) / 1024) + " KB  " + (out + shim).split("\n").length + " 行");
console.log("分段: " + parts.join(", "));

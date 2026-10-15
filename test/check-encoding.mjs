// 编码守卫：扫描项目文件，发现 UTF-8 损坏 / GBK 乱码 / 替换字符就报错。
// 起因：2026-10-15 子代理用 pwsh 的 Set-Content 做过一次字符串替换，
// 把 UTF-8 当 GBK 处理，导致 src/calc-core.mjs 168 行受损（连引号和换行都被吃）。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// UTF-8 被当作 GBK 解码后的典型乱码字（正常数学/中文文案里不会出现）
const MOJIBAKE = ["鈥", "锛", "鐨", "涓", "鏄", "鏁", "鎴", "鍜", "浣", "鏂", "鐢", "鍦", "鏃", "鍒", "閫", "绫", "銆", "锝", "鈭", "鑳", "杈", "鍑", "鐐", "缂", "鎬", "鎵", "鍔", "鍏", "娴", "鐜", "璁", "鍥", "鍗", "鍙", "鐩", "琛", "鏂", "鐨"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    // 本守卫自己必然包含乱码样本；test/_* 是临时/生成文件，不纳入
    if (name === "check-encoding.mjs" || name.startsWith("_")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(html|mjs|js|json|md|yml|yaml|txt)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(root).concat([join(root, "..", "线性代数计算器.html"), join(root, "..", "线性变换演示.html")]);
let bad = 0, checked = 0;

for (const f of files) {
  let buf;
  try { buf = readFileSync(f); } catch (e) { continue; }
  checked++;
  const rel = f.replace(root + "\\", "").replace(root + "/", "");
  const problems = [];

  // 1. 必须是合法 UTF-8（fatal 模式下遇到非法字节会抛错）
  let text = "";
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch (e) { problems.push("不是合法 UTF-8"); }

  if (text) {
    // 2. 替换字符
    const fffd = (text.match(/\uFFFD/g) || []).length;
    if (fffd) problems.push("含 " + fffd + " 个替换字符 U+FFFD");
    // 3. GBK 乱码字
    const hit = MOJIBAKE.filter((m) => text.includes(m));
    if (hit.length) problems.push("含 GBK 乱码字: " + hit.slice(0, 6).join(" "));
    // 4. BOM 提醒（不算错，只提示）
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) problems.push("带 UTF-8 BOM");
  }

  if (problems.length) { bad++; console.log("  FAIL " + rel + "  →  " + problems.join("；")); }
}

console.log("");
console.log("检查 " + checked + " 个文件，" + (bad ? bad + " 个有问题" : "全部编码正常"));
process.exit(bad ? 1 : 0);

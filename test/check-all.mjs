// 一次跑完项目所有自测：node test/check-all.mjs
// 每一项显示 通过/失败 数，最后给总账；任何一项失败就退出码 1。
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const SUITES = [
  ["线代引擎", "engine.test.mjs"],
  ["矩阵页", "check-ui.mjs"],
  ["变换页", "check-transform.mjs"],
  ["微积分引擎", "calculus.test.mjs"],
  ["微积分冒烟", "smoke-calculus.mjs"],
  ["极限/微分/积分三页", "check-calculus.mjs"],
  ["函数图像页", "check-graph.mjs"],
  ["概率分布列页", "check-stats.mjs"],
  ["首页", "check-home.mjs"],
  ["编码守卫", "check-encoding.mjs"],
];

let totalPass = 0, totalFail = 0, badSuites = 0, ran = 0, skipped = 0;
const rows = [];

for (const [name, file] of SUITES) {
  const p = join(here, file);
  if (!existsSync(p)) { skipped++; rows.push([name, "跳过", "没有 " + file]); continue; }
  ran++;
  let out = "", ok = true;
  try {
    out = execFileSync(process.execPath, [p], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    ok = false;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  const m = out.match(/(\d+) passed, (\d+) failed/);
  if (m) {
    totalPass += Number(m[1]); totalFail += Number(m[2]);
    rows.push([name, m[1] + " / " + m[2], ok ? "通过" : "有失败"]);
  } else {
    const last = out.trim().split("\n").filter(Boolean).pop() || "(无输出)";
    if (!ok) badSuites++;
    rows.push([name, "—", last.slice(0, 60)]);
  }
  if (!ok && !m) badSuites++;
  else if (m && Number(m[2]) > 0) badSuites++;
}

const w = Math.max(...rows.map((r) => r[0].length)) + 2;
console.log("");
console.log("项".padEnd(w) + "通过/失败".padEnd(14) + "结果");
console.log("-".repeat(w + 26));
for (const [name, nums, verdict] of rows) console.log(name.padEnd(w) + String(nums).padEnd(14) + verdict);
console.log("-".repeat(w + 26));
console.log("合计：" + totalPass + " 项通过，" + totalFail + " 项失败；跑了 " + ran + " 套"
  + (skipped ? "，跳过 " + skipped + " 套（文件不存在）" : "") + "。");
console.log(badSuites ? "❌ 有 " + badSuites + " 套不通过" : "✅ 全部通过");
process.exit(badSuites ? 1 : 0);

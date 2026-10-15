// 首页（选择页）没有引擎要注入，只是把 src/home.html 复制成 index.html，
// 保持「src/ 放源、根目录放产物」的约定。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const html = readFileSync(join(root, "src", "home.html"), "utf8");
for (const need of ['href="algebra.html"', 'href="transform.html"', 'href="limits.html"', 'href="deriv.html"', 'href="integral.html"', "蒲瓜的计算器", "__VERSION__", "__UPDATED__"]) {
  if (html.indexOf(need) < 0) {
    console.error("FAIL: src/home.html 缺少 " + need);
    process.exit(2);
  }
}

const ver = JSON.parse(readFileSync(join(root, "src", "version.json"), "utf8"));
if (!/^\d+\.\d+$/.test(ver.version)) { console.error("FAIL: src/version.json 的 version 应该形如 1.0，实际 " + ver.version); process.exit(2); }
if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(ver.updated)) { console.error("FAIL: updated 应该形如 2026-10-16 02:05，实际 " + ver.updated); process.exit(2); }

const out = html.replace("__VERSION__", ver.version).replace("__UPDATED__", ver.updated);
if (out.indexOf("__VERSION__") >= 0 || out.indexOf("__UPDATED__") >= 0) { console.error("FAIL: 占位符没替换干净"); process.exit(2); }
writeFileSync(join(root, "index.html"), out);
console.log("wrote index.html (首页选择页)  " + Math.round(out.length / 1024) + " KB  版本 V" + ver.version + " · " + ver.updated);

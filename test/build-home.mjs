// 首页（选择页）没有引擎要注入，只是把 src/home.html 复制成 index.html，
// 保持「src/ 放源、根目录放产物」的约定。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const html = readFileSync(join(root, "src", "home.html"), "utf8");
for (const need of ['href="algebra.html"', 'href="transform.html"', 'href="calculus.html"', "蒲瓜的计算器"]) {
  if (html.indexOf(need) < 0) {
    console.error("FAIL: src/home.html 缺少 " + need);
    process.exit(2);
  }
}
writeFileSync(join(root, "index.html"), html);
console.log("wrote index.html (首页选择页)  " + Math.round(html.length / 1024) + " KB");

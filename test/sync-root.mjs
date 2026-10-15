// Syncs the master pages to the workspace root, rewriting cross-page links
// to the root copy filenames. Run: node test/sync-root.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");        // 线代计算器/
const out = join(root, "..");         // 工作区根目录

const PAGES = [
  { master: "index.html", copy: "蒲瓜的计算器.html", links: { "algebra.html": "线性代数计算器.html", "transform.html": "线性变换演示.html", "limits.html": "极限计算器.html", "deriv.html": "微分计算器.html", "integral.html": "积分计算器.html", "calculus.html": "微积分计算器.html" } },
  { master: "algebra.html", copy: "线性代数计算器.html", links: { "index.html": "蒲瓜的计算器.html", "transform.html": "线性变换演示.html", "limits.html": "极限计算器.html", "deriv.html": "微分计算器.html", "integral.html": "积分计算器.html" } },
  { master: "transform.html", copy: "线性变换演示.html", links: { "index.html": "蒲瓜的计算器.html", "algebra.html": "线性代数计算器.html", "limits.html": "极限计算器.html", "deriv.html": "微分计算器.html", "integral.html": "积分计算器.html" } },
  { master: "limits.html", copy: "极限计算器.html", links: { "index.html": "蒲瓜的计算器.html", "algebra.html": "线性代数计算器.html", "transform.html": "线性变换演示.html", "deriv.html": "微分计算器.html", "integral.html": "积分计算器.html" } },
  { master: "deriv.html", copy: "微分计算器.html", links: { "index.html": "蒲瓜的计算器.html", "algebra.html": "线性代数计算器.html", "transform.html": "线性变换演示.html", "limits.html": "极限计算器.html", "integral.html": "积分计算器.html" } },
  { master: "integral.html", copy: "积分计算器.html", links: { "index.html": "蒲瓜的计算器.html", "algebra.html": "线性代数计算器.html", "transform.html": "线性变换演示.html", "limits.html": "极限计算器.html", "deriv.html": "微分计算器.html" } },
  { master: "calculus.html", copy: "微积分计算器.html", links: { "index.html": "蒲瓜的计算器.html", "limits.html": "极限计算器.html", "deriv.html": "微分计算器.html", "integral.html": "积分计算器.html" } },
];

let done = 0, skip = 0;
for (const p of PAGES) {
  let html;
  try {
    html = readFileSync(join(root, p.master), "utf8");
  } catch (e) {
    console.log("skip  " + p.master + "（还没有这个页面）");
    skip++;
    continue;
  }
  let text = html;
  for (const [from, to] of Object.entries(p.links)) {
    text = text.split('href="' + from + '"').join('href="' + to + '"');
  }
  writeFileSync(join(out, p.copy), text);
  console.log("wrote " + p.copy + "  " + Math.round(text.length / 1024) + " KB");
  done++;
}
console.log(done + " 份已同步" + (skip ? "，" + skip + " 份跳过" : "") + " → " + out);

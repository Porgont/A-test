// 生成「概率 · 分布列」页 stats.html。
// 这一页不需要数学引擎（分布公式是页面自己算的），所以构建只是把
// src/stats.template.html 的占位符替换掉，写成根目录的产物，跟「src/ 放源、
// 根目录放产物」的约定一致。
//   node test/build-stats.mjs              只生成 stats.html
//   node test/build-stats.mjs --preview    额外生成 test/_preview-stats.html
//                                          （自动选一个分布、填好参数并点一次「计算」）
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const PAGE = { id: "stats", title: "概率", out: "stats.html" };

const tpl = readFileSync(join(root, "src", "stats.template.html"), "utf8");
for (const need of ["__PAGE_ID__", "__PAGE_TITLE__"]) {
  if (tpl.indexOf(need) < 0) { console.error("FAIL: 模板里缺少占位符 " + need); process.exit(2); }
}
for (const need of ['id="calcBtn"', 'id="plot"', 'id="distChips"', 'id="paramArea"', 'id="out"']) {
  if (tpl.indexOf(need) < 0) { console.error("FAIL: 模板里缺少 " + need); process.exit(2); }
}
if (tpl.indexOf("__CALC_ENGINE__") >= 0) { console.error("FAIL: 本页不需要引擎占位符"); process.exit(2); }

const html = tpl.replace("__PAGE_ID__", PAGE.id).replace("__PAGE_TITLE__", PAGE.title);
if (html.indexOf("__PAGE_ID__") >= 0 || html.indexOf("__PAGE_TITLE__") >= 0) {
  console.error("FAIL: 占位符没替换干净"); process.exit(2);
}

writeFileSync(join(root, PAGE.out), html);
console.log("wrote " + PAGE.out + "  " + Math.round(html.length / 1024) + " KB  （" + PAGE.title + " · 分布列）");

if (process.argv.includes("--preview")) {
  // 预览页：自动选「二项 B(10, 0.5)」，填好参数，再点一次「计算」，这样无头浏览器
  // 截图时结果区和柱状图都已经画好。
  // 注意：--headless=new --screenshot 不会等 setTimeout，所以用 setTimeout(…, 0)
  // 让它在页面脚本跑完、这一轮事件循环里立刻执行。
  const demo = `<script>
(function(){
  setTimeout(function(){
    var chip = document.querySelector('[data-dist="bin"]');
    if (chip) chip.click();
    var n = document.getElementById("p-n"); if (n) n.value = "10";
    var p = document.getElementById("p-p"); if (p) p.value = "0.5";
    var c = document.getElementById("calcBtn");
    if (c) c.click();
  }, 0);
})();
</script>
`;
  const preview = html.replace("</body>", demo + "</body>");
  writeFileSync(join(here, "_preview-" + PAGE.id + ".html"), preview);
  console.log("  + test/_preview-" + PAGE.id + ".html  （自动选 二项 B(10, 0.5) 并点「计算」）");
}

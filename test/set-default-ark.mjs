// 把默认皮肤改成「方舟」（终末地风格），并把偏好键升到 la-skin-v3
// （否则浏览器里存过的旧选择会盖掉新默认，用户看不到变化）。
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html",
  "src/stats.template.html", "src/graph.template.html"];

for (const f of FILES) {
  if (!existsSync(f)) { console.log("  跳过 " + f); continue; }
  let t = readFileSync(f, "utf8");
  const before = t;

  // 1) html 上的初始皮肤属性
  t = t.split('<html lang="zh-CN" data-skin="light">').join('<html lang="zh-CN" data-skin="ark">');

  // 2) 切换器上的选中态：从「极简」挪到「方舟」
  t = t.replace('<button data-skin-set="light" class="on">极简</button>', '<button data-skin-set="light">极简</button>');
  t = t.replace('<button data-skin-set="ark">方舟</button>', '<button data-skin-set="ark" class="on">方舟</button>');

  // 3) 读皮肤时的默认值 + 非法值兜底
  t = t.split('localStorage.getItem("la-skin-v2") || "light"').join('localStorage.getItem("la-skin-v3") || "ark"');
  t = t.split('if (SKINS.indexOf(saved) < 0) saved = "light";').join('if (SKINS.indexOf(saved) < 0) saved = "ark";');

  // 4) 存储键升级
  t = t.split('"la-skin-v2"').join('"la-skin-v3"');

  if (t !== before) { writeFileSync(f, t); console.log("  ✓ " + f + " 默认皮肤 → 方舟"); }
  else console.log("  = " + f + "（无需改动）");
}

// 测试里对默认皮肤与存储键的断言也要同步
const TESTS = ["test/check-home.mjs", "test/check-graph.mjs", "test/check-ui.mjs", "test/check-stats.mjs",
  "test/check-calculus.mjs", "test/check-transform.mjs"];
for (const f of TESTS) {
  if (!existsSync(f)) continue;
  let t = readFileSync(f, "utf8");
  const before = t;
  t = t.split('la-skin-v2').join('la-skin-v3');
  t = t.split("'data-skin=\"light\"'").join("'data-skin=\"ark\"'");
  t = t.split('page.indexOf(\'data-skin="light"\')').join('page.indexOf(\'data-skin="ark"\')');
  t = t.split("ui.indexOf('|| \"light\"')").join("ui.indexOf('|| \"ark\"')");
  t = t.split('ui.indexOf(\'|| "light"\')').join('ui.indexOf(\'|| "ark"\')');
  if (t !== before) { writeFileSync(f, t); console.log("  ✓ " + f + " 断言已同步"); }
}
console.log("完成。");

// 一次性脚本：给所有页面注入三套新皮肤（方舟 / 霓虹 / 终端）
// 用法：node test/inject-skins.mjs
// 说明：这是「生成源文件」的工具，跑一次即可；皮肤定义同时写进每个页面的 CSS 变量块。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const FILES = ["src/home.html", "algebra.html", "src/transform.template.html", "src/calc.template.html", "src/stats.template.html"];

const NEW_CSS = `
/* ==================== 新增皮肤：方舟 / 霓虹 / 终端 ==================== */
/* 方舟：深黑底、直角、1px 细亮边、亮黄点缀、轻微斜纹（军事科技感） */
:root[data-skin="ark"]{
  --bg:#0b0b0c; --bg-image:repeating-linear-gradient(135deg, rgba(255,255,255,.016) 0 10px, transparent 10px 20px);
  --fg:#f2f2f2; --fg-dim:#8d8d92;
  --card:#141416; --card-border:#3b3b40; --card-bw:1px; --radius:3px; --skin-bw:1px;
  --shadow:0 2px 0 rgba(0,0,0,.5); --track:#0f0f11;
  --chip:#1b1b1e; --chip-border:#42424a;
  --chip-on-bg:#f5e400; --chip-on-fg:#0b0b0c;
  --mark:#f5e400; --mark-fg:#0b0b0c; --logo-shadow:none;
}
/* 霓虹：深紫黑底 + 青/品红辉光 */
:root[data-skin="neon"]{
  --bg:#07060f;
  --bg-image:radial-gradient(1100px 560px at 18% -8%, rgba(0,229,255,.12), transparent 62%), radial-gradient(900px 500px at 100% 0%, rgba(255,62,165,.10), transparent 58%);
  --fg:#eaf7ff; --fg-dim:#8ea6c8;
  --card:rgba(18,13,34,.86); --card-border:#312a63; --card-bw:1px; --radius:16px; --skin-bw:1px;
  --shadow:0 0 26px rgba(0,229,255,.10); --track:#0d0a1c;
  --chip:rgba(24,18,44,.85); --chip-border:#3a3170;
  --chip-on-bg:#00e5ff; --chip-on-fg:#04060f;
  --mark:#00e5ff; --mark-fg:#04060f; --logo-shadow:0 0 18px rgba(0,229,255,.45);
}
/* 终端：纯黑 + 绿字 + 等宽 + 扫描线 */
:root[data-skin="mono"]{
  --bg:#000000; --bg-image:repeating-linear-gradient(0deg, rgba(57,255,138,.05) 0 1px, transparent 1px 3px);
  --fg:#39ff8a; --fg-dim:#1f8a4c;
  --card:#050805; --card-border:#1f6b3d; --card-bw:1px; --radius:0px; --skin-bw:1px;
  --shadow:none; --track:#020402;
  --chip:#040a06; --chip-border:#1f6b3d;
  --chip-on-bg:#39ff8a; --chip-on-fg:#000000;
  --mark:#39ff8a; --mark-fg:#000000; --logo-shadow:none;
}
.skins{flex-wrap:wrap;justify-content:flex-end}
/* 方舟的直角卡片：左侧亮条 + 右上角标 */
:root[data-skin="ark"] .card{position:relative;overflow:hidden}
:root[data-skin="ark"] .card::before{content:"";position:absolute;left:0;top:10px;width:3px;height:20px;background:var(--mark)}
:root[data-skin="ark"] .chip.on,:root[data-skin="ark"] .tabs .on{box-shadow:none;font-weight:700;letter-spacing:.02em}
:root[data-skin="ark"] .tabs .tag{color:#0b0b0c;background:var(--mark);border-radius:2px;padding:1px 4px;opacity:1}
/* 霓虹的发光选中态 */
:root[data-skin="neon"] .chip.on,:root[data-skin="neon"] .tabs .on{box-shadow:0 0 16px rgba(0,229,255,.45)}
/* 终端用等宽字体 */
:root[data-skin="mono"] body{font-family:ui-monospace,"Cascadia Mono",Consolas,"Courier New",monospace}
:root[data-skin="mono"] .tabs .on{box-shadow:0 0 12px rgba(57,255,138,.35)}
`;

const NEW_BUTTONS = [
  ["ark", "方舟"],
  ["neon", "霓虹"],
  ["mono", "终端"],
];

const NEW_THEME = `    ark: { color: "#0b0b0c", bar: "black-translucent" },
    neon: { color: "#07060f", bar: "black-translucent" },
    mono: { color: "#000000", bar: "black-translucent" }
`;

let touched = 0;
for (const rel of FILES) {
  const p = join(root, rel);
  let t = readFileSync(p, "utf8");
  const before = t;

  // 0) 幂等：清掉之前重复注入的按钮组与 THEME 条目
  t = t.replace(
    /(<button data-skin-set="ark">方舟<\/button>(?:(?!data-skin-set="ark")[\s\S])*?<button data-skin-set="mono">终端<\/button>)(\s*)(<button data-skin-set="ark">方舟<\/button>(?:(?!data-skin-set="ark")[\s\S])*?<button data-skin-set="mono">终端<\/button>)/,
    "$1");
  t = t.replace(
    /(\n\s*ark: \{ color: "#0b0b0c", bar: "black-translucent" \},\n\s*neon: \{ color: "#07060f", bar: "black-translucent" \},\n\s*mono: \{ color: "#000000", bar: "black-translucent" \})(\n\s*ark: \{ color: "#0b0b0c", bar: "black-translucent" \},\n\s*neon: \{ color: "#07060f", bar: "black-translucent" \},\n\s*mono: \{ color: "#000000", bar: "black-translucent" \})/,
    "$1");

  // 1) 变量块：插在 brutal 块之后（兼容 CRLF；已注入则跳过）
  if (t.indexOf(':root[data-skin="ark"]{') < 0) {
    const bIdx = t.indexOf(':root[data-skin="brutal"]{');
    if (bIdx >= 0) {
      const m = /\r?\n\}/.exec(t.slice(bIdx));
      const close = m ? bIdx + m.index : -1;
      if (close > 0) {
        const nl = t.slice(close, close + 2) === "\r\n" ? 2 : 1;
        t = t.slice(0, close + nl + 1) + NEW_CSS + t.slice(close + nl + 1);
      }
    }
  }

  // 2) 切换按钮（已注入则跳过）
  if (t.indexOf('data-skin-set="ark"') < 0) {
    t = t.replace(/(\s*)<button data-skin-set="brutal">粗野<\/button>/,
      (m, ws) => m + NEW_BUTTONS.map(([id, label]) => "\n" + ws + '<button data-skin-set="' + id + '">' + label + "</button>").join(""));
  }

  // 3) SKINS 数组（注意有的文件是 `var SKINS = [...], saved = "light";`）
  t = t.replace(/var SKINS = \["glass", "light", "brutal"\]/,
    'var SKINS = ["glass", "light", "brutal", "ark", "neon", "mono"]');

  // 4) THEME 表（兼容 CRLF；已注入则跳过）
  //    注意：原来的 brutal 那一行结尾没有逗号，直接往后插会变成语法错误，
  //    所以这里必须把逗号补上（对已经插坏的文件也做一次修复）。
  if (t.indexOf("ark: { color") < 0) {
    t = t.replace(/(\s*)(brutal: \{ color: "#fdf1dd", bar: "default" \})(\r?\n)/,
      (m, ws, line, nl) => ws + line + "," + nl + NEW_THEME);
  } else {
    // 修复：brutal 行后面缺逗号
    t = t.replace(/(brutal: \{ color: "#fdf1dd", bar: "default" \})(\s*\r?\n\s*ark:)/, "$1,$2");
  }

  if (t === before) { console.log("  ⚠ " + rel + " 没有变化（锚点没匹配上）"); continue; }
  const ok = t.indexOf('data-skin="ark"') >= 0 && t.indexOf('data-skin-set="ark"') >= 0 &&
    t.indexOf('"ark", "neon", "mono"') >= 0 && t.indexOf("ark: { color") >= 0;
  if (!ok) { console.log("  ❌ " + rel + " 注入不完整，已跳过"); continue; }
  writeFileSync(p, t);
  touched++;
  console.log("  " + rel + "  ✓ 三套皮肤已注入");
}
console.log("共改动 " + touched + " 个文件。");

// 临时：用无头 Edge dump 预览页运行后的 DOM，看 data-* 诊断标记（跑完请删除）
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const preview = join(here, "_preview-graph.html");
const url = "file:///" + preview.replace(/\\/g, "/") + "?skin=light";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const r = spawnSync(EDGE, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--user-data-dir=" + join(process.env.TEMP || "/tmp", "dsh-g2"),
  "--virtual-time-budget=4000", "--window-size=500,1400", "--dump-dom", url
], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

if (r.error) { console.error("spawn failed: " + r.error.message); process.exit(2); }
const dom = r.stdout || "";
for (const key of ["graph-preview", "dbg-window", "dbg-canvas", "dbg-curves", "dbg-err"]) {
  const m = dom.match(new RegExp('data-' + key + '="([^"]*)"'));
  console.log(key.padEnd(14) + " = " + (m ? m[1] : "(none)"));
}
console.log("dom length = " + dom.length + (r.stderr ? "  stderr=" + r.stderr.slice(0, 200) : ""));

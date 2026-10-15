// Structure + engine-consistency checks for the transform page.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const main = readFileSync(join(root, "algebra.html"), "utf8");
const page = readFileSync(join(root, "transform.html"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  (" + detail + ")" : "")); }
}
function engineOf(html) {
  const p = html.split("/* ==== ENGINE START ==== */");
  return p[1] ? p[1].split("/* ==== ENGINE END ==== */")[0].trim() : "";
}

const em = engineOf(main);
const ep = engineOf(page);
check("两页都有引擎块", em.length > 0 && ep.length > 0, "main=" + em.length + " transform=" + ep.length);
check("引擎逐字节一致（单一来源）", em === ep, "main=" + em.length + " transform=" + ep.length);

check("模板占位符已被替换", page.indexOf("__ENGINE__") < 0);

const blocks = page.split("<script>");
const ui = blocks[2] ? blocks[2].split("</script>")[0] : "";
try { new Function(ui); check("变换页 UI 脚本语法", true); }
catch (e) { check("变换页 UI 脚本语法", false, e.message); }

check("有 A 的输入网格", page.indexOf('id="gridA"') >= 0);
check("有向量 x 的输入网格", page.indexOf('id="gridX"') >= 0);
check("有 3D 画布", page.indexOf('id="geo"') >= 0);
check("有 T(x) 输出区", page.indexOf('id="out"') >= 0);
check("有几何说明区", page.indexOf('id="geoinfo"') >= 0);
check("2×2 / 3×3 切换", page.indexOf('id="dim2"') >= 0 && page.indexOf('id="dim3"') >= 0);
check("三套皮肤齐全", page.indexOf(':root[data-skin="glass"]') >= 0 && page.indexOf(':root[data-skin="light"]') >= 0 && page.indexOf(':root[data-skin="brutal"]') >= 0);
check("默认皮肤是极简", page.indexOf('data-skin="light"') >= 0 && ui.indexOf('|| "light"') >= 0);
check("大标题与署名", page.indexOf("蒲瓜的计算器") >= 0 && page.indexOf("由 Deepseek 制作") >= 0);
check("回车跳格已接入", ui.indexOf('e.key !== "Enter"') >= 0);
check("画了变换后的网格", ui.indexOf("C_NET") >= 0);
check("画了 x 与 T(x) 两个箭头", ui.indexOf("C_X") >= 0 && ui.indexOf("C_TX") >= 0);
check("识别正交/旋转/反射", ui.indexOf("正交变换") >= 0 && ui.indexOf("旋转") >= 0 && ui.indexOf("镜像反射") >= 0);
check("回主计算器的链接", page.indexOf('href="index.html"') >= 0);
check("变换页有微积分页入口（顶+底各一条）", (page.match(/href="calculus\.html"/g) || []).length === 2);
check("主计算器有去变换页的链接", main.indexOf('href="transform.html"') >= 0);
check("变换页有两条切换栏（顶部+底部）", (page.match(/class="tabs"/g) || []).length === 2, "找到 " + (page.match(/class="tabs"/g) || []).length + " 条");
check("主计算器也有两条切换栏", (main.match(/class="tabs"/g) || []).length === 2, "找到 " + (main.match(/class="tabs"/g) || []).length + " 条");
check("主计算器两处都指向变换页", (main.match(/href="transform\.html"/g) || []).length === 2);
check("变换页两处都指回计算器", (page.match(/href="index\.html"/g) || []).length === 2);
check("切换栏带当前页标记", page.indexOf('class="tag">当前') >= 0 && main.indexOf('class="tag">当前') >= 0);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

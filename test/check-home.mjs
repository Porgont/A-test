// 首页（选择页）结构检查
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const page = readFileSync(join(root, "index.html"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  (" + detail + ")" : "")); }
}

const scripts = page.split("<script>");
const ui = scripts[1] ? scripts[1].split("</script>")[0] : "";
try { new Function(ui); check("首页脚本语法", true); }
catch (e) { check("首页脚本语法", false, e.message); }

check("大标题与署名", page.indexOf("蒲瓜的计算器") >= 0 && page.indexOf("由 Deepseek 制作") >= 0);
check("默认皮肤是极简", page.indexOf('data-skin="light"') >= 0 && ui.indexOf('|| "light"') >= 0);
check("三套皮肤齐全",
  page.indexOf(':root[data-skin="glass"]') >= 0 && page.indexOf(':root[data-skin="light"]') >= 0 && page.indexOf(':root[data-skin="brutal"]') >= 0);

check("五张入口卡片", (page.match(/class="pick"/g) || []).length === 5, "找到 " + (page.match(/class="pick"/g) || []).length + " 张");
check("入口指向矩阵计算器", page.indexOf('href="algebra.html"') >= 0);
check("入口指向线性变换", page.indexOf('href="transform.html"') >= 0);
check("入口指向极限页", page.indexOf('href="limits.html"') >= 0);
check("入口指向微分页", page.indexOf('href="deriv.html"') >= 0);
check("入口指向积分页", page.indexOf('href="integral.html"') >= 0);
check("卡片标题齐全",
  page.indexOf(">矩阵计算器<") >= 0 && page.indexOf(">线性变换 T(x) = Ax<") >= 0 &&
  page.indexOf(">极限<") >= 0 && page.indexOf(">微分<") >= 0 && page.indexOf(">积分<") >= 0);
check("首页不设页签（它就是选择页）", page.indexOf('class="tabs"') >= 0 && page.indexOf('<span class="on">首页') >= 0);
check("首页导航六项齐全",
  page.indexOf('href="algebra.html">矩阵') >= 0 && page.indexOf('href="transform.html">变换') >= 0 &&
  page.indexOf('href="limits.html">极限') >= 0 && page.indexOf('href="deriv.html">微分') >= 0 &&
  page.indexOf('href="integral.html">积分') >= 0);
const ver = JSON.parse(readFileSync(join(root, "src", "version.json"), "utf8"));
check("显示版本号与更新时间",
  page.indexOf("V" + ver.version) >= 0 && page.indexOf(ver.updated) >= 0 && page.indexOf("__VERSION__") < 0);
check("版本号格式正确", /^\d+\.\d+$/.test(ver.version) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(ver.updated),
  ver.version + " / " + ver.updated);
check("说明了数据不上传", page.indexOf("不上传任何数据") >= 0);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

// Tiny static server: lets a phone in the same LAN open the calculator.
// Usage: node serve.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

function lanAddresses() {
  const out = [];
  const ifs = networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const a of ifs[name] || []) {
      if (a.family === "IPv4" && !a.internal) out.push({ name, address: a.address });
    }
  }
  return out;
}

createServer(async (req, res) => {
  let urlPath = "/";
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (e) {
    res.writeHead(400).end("bad request");
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";
  const file = normalize(join(root, urlPath));
  if (!file.startsWith(root)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("403");
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404 " + urlPath);
  }
}).listen(port, "0.0.0.0", () => {
  console.log("root: " + root);
  console.log("local: http://127.0.0.1:" + port + "/");
  for (const a of lanAddresses()) {
    console.log("LAN  : http://" + a.address + ":" + port + "/   (" + a.name + ")");
  }
});

/** Minimal static file server for previewing dist/ locally (no Next.js, no framework).  npm run preview */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] || "dist");
const port = Number(process.env.PORT || process.argv[3] || 4173);
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".pdf": "application/pdf",
};

/** Apply the "/*" block of dist/_headers (security headers + CSP), like Cloudflare Pages does. */
function globalHeaders() {
  const f = join(root, "_headers");
  if (!existsSync(f)) return {};
  const out = {};
  let inGlobal = false;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (!line.trim()) { inGlobal = false; continue; }
    if (!line.startsWith(" ")) { inGlobal = line.trim() === "/*"; continue; }
    if (inGlobal) { const i = line.indexOf(":"); out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
  return out;
}
const extra = globalHeaders();

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    const nf = join(root, "404.html");
    res.writeHead(404, { ...extra, "content-type": types[".html"] }).end(existsSync(nf) ? readFileSync(nf) : "Not found");
    return;
  }
  res.writeHead(200, { ...extra, "content-type": types[extname(file)] || "application/octet-stream" }).end(readFileSync(file));
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));

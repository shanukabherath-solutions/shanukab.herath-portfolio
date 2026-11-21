/**
 * Checks every external link in dist/index.html and reports its HTTP status.
 *   npm run build && npm run check:links
 *
 * Notes: GitHub returns 404 for private repositories when you are not signed in, so a 404 on a
 * github.com link usually means "private or renamed". Fiverr and Vimeo often answer 403/429 to scripts
 * even when the page is fine, so those are reported as "blocked to scripts" rather than broken. Open
 * those links in a browser to confirm them.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "dist", "index.html"), "utf8");
const urls = [...new Set([...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))]
  .filter((u) => !u.startsWith("https://shanukab.herath.dev"));

const BOT_BLOCKERS = /(^|\.)(fiverr|vimeo|linkedin)\.com$/;
let problems = 0;
for (const url of urls) {
  const host = new URL(url).hostname;
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (link-check)" }, signal: AbortSignal.timeout(15000) });
    let verdict = res.ok ? "OK" : `HTTP ${res.status}`;
    if (!res.ok && BOT_BLOCKERS.test(host) && [403, 429, 999].includes(res.status)) verdict += "  (blocked to scripts: open it in a browser to confirm)";
    else if (!res.ok && host === "github.com" && res.status === 404) { verdict += "  (private or renamed repository?)"; problems++; }
    else if (!res.ok) problems++;
    console.log(`${verdict.padEnd(10)} ${url}`);
  } catch (e) {
    problems++;
    console.log(`ERROR      ${url}  (${e.cause?.code || e.message})`);
  }
}
console.log(problems ? `\n${problems} link(s) need attention` : "\nAll links responded OK");
process.exit(problems ? 1 : 0);

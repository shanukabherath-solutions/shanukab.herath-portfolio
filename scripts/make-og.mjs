/**
 * Generates src/og-image.png (1200x627) for link previews. The build copies it to the site root as /og-image.png.
 * Uses the real avatar file, unmodified, plus the self-hosted fonts. Needs Playwright + a Chromium
 * (set PW_CHROMIUM to a Chromium/Chrome path, or run `npx playwright install chromium`).
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { siteConfig as s } from "../content/profile.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => pathToFileURL(join(ROOT, p)).href;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:SG;font-weight:700;src:url(${url("src/assets/fonts/space-grotesk-latin-700-normal.woff2")})}
@font-face{font-family:SG;font-weight:500;src:url(${url("src/assets/fonts/space-grotesk-latin-500-normal.woff2")})}
@font-face{font-family:PM;font-weight:500;src:url(${url("src/assets/fonts/ibm-plex-mono-latin-500-normal.woff2")})}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:627px;overflow:hidden;background:#11141D;color:#F5F6F8;font-family:SG,sans-serif;position:relative;display:flex;align-items:center;padding:0 88px;gap:72px}
.g1{position:absolute;width:760px;height:760px;right:-200px;top:-260px;border-radius:50%;background:radial-gradient(circle,rgba(99,183,219,.30),transparent 68%)}
.g2{position:absolute;width:560px;height:560px;left:-220px;bottom:-300px;border-radius:50%;background:radial-gradient(circle,rgba(233,152,123,.16),transparent 70%)}
img{position:relative;width:360px;height:360px;border-radius:50%;box-shadow:0 0 0 4px #63B7DB,0 0 0 20px rgba(99,183,219,.12),0 40px 90px -30px rgba(99,183,219,.6)}
.t{position:relative;min-width:0}
.p{font-family:PM,monospace;font-weight:500;font-size:26px;color:#63B7DB}.p b{color:#E9987B;font-weight:500}
h1{margin-top:18px;font-size:64px;white-space:nowrap;line-height:1.04;font-weight:700;letter-spacing:-.025em}
.r{margin-top:22px;font-size:34px;line-height:1.25;font-weight:500;color:#B4B9C7}
.k{margin-top:36px;font-family:PM,monospace;font-weight:500;font-size:22px;letter-spacing:.01em;color:#63B7DB;white-space:nowrap}.k i{font-style:normal;color:#E9987B;padding:0 .35em}
</style></head><body><div class="g1"></div><div class="g2"></div>
<img src="${url("tools/Avatar.original.png")}" alt="">
<div class="t"><p class="p"><b>$</b> whoami</p><h1>${s.name}</h1><p class="r">Software Developer</p><p class="k">Software Development<i>·</i>AI<i>·</i>Cybersecurity</p></div>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), "og-"));
const file = join(dir, "og.html");
writeFileSync(file, html);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 627 } });
await page.goto(pathToFileURL(file).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(ROOT, "src/og-image.png") });
await browser.close();
console.log("Wrote src/og-image.png");

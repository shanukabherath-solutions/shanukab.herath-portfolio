/**
 * Browser checks for the built site (dist/), run against the static preview server.
 *
 *   npm run build && npm run preview &     # serves dist/ on :4173
 *   npm run test:responsive
 *
 * Needs Playwright + a Chromium: `npx playwright install chromium`, or set PW_CHROMIUM=/path/to/chrome.
 * Env: BASE_URL (default http://localhost:4173), SHOTS_DIR (default ./test-screenshots)
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const SHOTS = process.env.SHOTS_DIR || "test-screenshots";
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1440, 1920];
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const fail = (msg) => { failures++; console.log("    FAIL  " + msg); };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });

/* ---------------------------------------------------------------- in-page checks */
function pageChecks() {
  const vw = document.documentElement.clientWidth;
  const res = { vw, docScrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth, textOutside: [], clipped: [], hero: {}, brokenImages: [] };

  // 1. every visible text node must sit fully inside the viewport horizontally
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (el.closest(".sr-only,.skip-link,script,style,noscript")) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width === 0) continue;
      if (r.right > vw + 0.5 || r.left < -0.5) res.textOutside.push(`${el.tagName.toLowerCase()}.${el.className}: "${n.textContent.trim().slice(0, 40)}" [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
  }

  // 2. no container may hide overflowing content (ignoring intentional image crops / decorative glow)
  const IGNORE = ".hero,.hero__glow,.mock__canvas,.mock__half,.sr-only,.skip-link,html,body";
  document.querySelectorAll("*").forEach((el) => {
    if (el.matches(IGNORE) || el.closest(".sr-only")) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return;
    if (["hidden", "clip", "auto", "scroll"].some((v) => cs.overflowX === v || cs.overflowY === v)) {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) res.clipped.push(`${el.tagName.toLowerCase()}.${el.className} scroll ${el.scrollWidth}x${el.scrollHeight} > client ${el.clientWidth}x${el.clientHeight}`);
    }
  });

  // 3. hero heading + description geometry
  const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), fs: getComputedStyle(e).fontSize }; };
  res.hero = { h1: box(".hero__title"), role: box(".hero__role"), lead: box(".hero__lead"), actions: box(".hero__actions"), avatar: box(".hero__avatar img"), panel: box(".hero__panel") };
  const h1 = document.querySelector(".hero__title");
  res.hero.h1Lines = Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight));
  const roleEl = document.querySelector(".hero__role");
  res.hero.roleFs = parseFloat(getComputedStyle(roleEl).fontSize);
  res.hero.roleLines = Math.round(roleEl.getBoundingClientRect().height / parseFloat(getComputedStyle(roleEl).lineHeight));
  res.hero.roleSepVisible = getComputedStyle(document.querySelector(".hero__sep")).display !== "none";
  res.hero.textColW = document.querySelector(".hero__text").getBoundingClientRect().width;
  res.hero.roleTextW = (() => { const r = document.createRange(); r.selectNodeContents(roleEl); return Math.max(...[...r.getClientRects()].map((x) => x.right)) - roleEl.getBoundingClientRect().left; })();

  document.querySelectorAll("img").forEach((i) => { if (i.loading !== "lazy" && !(i.complete && i.naturalWidth > 0)) res.brokenImages.push(i.src); });
  return res;
}

/* ---------------------------------------------------------------- per-viewport run */
async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(40); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
}

for (const w of WIDTHS) {
  const mobile = w < 768;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 800 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url()));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

  console.log(`\n== ${w}px ==`);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1300); // hero entrance animation
  await page.screenshot({ path: `${SHOTS}/hero-${w}.png` });

  await scrollThrough(page);
  const r = await page.evaluate(pageChecks);

  if (r.docScrollW > r.vw) fail(`horizontal scroll: documentElement.scrollWidth ${r.docScrollW} > viewport ${r.vw}`);
  if (r.bodyScrollW > r.vw) fail(`body.scrollWidth ${r.bodyScrollW} > viewport ${r.vw}`);
  r.textOutside.slice(0, 8).forEach((t) => fail("text outside viewport: " + t));
  r.clipped.slice(0, 8).forEach((t) => fail("clipped container: " + t));
  r.brokenImages.forEach((t) => fail("image not loaded: " + t));
  const { h1, role, lead, actions, avatar } = r.hero;
  for (const [name, b] of Object.entries({ h1, role, lead, actions, avatar })) {
    if (!b) { fail(`hero ${name} missing`); continue; }
    if (b.left < 0 || b.right > r.vw) fail(`hero ${name} outside viewport: ${b.left}..${b.right} (vw ${r.vw})`);
  }
  if (r.hero.h1Lines !== 1) fail(`name wraps onto ${r.hero.h1Lines} lines (must be one line)`);
  const wide = r.hero.textColW >= 29 * 16; // headline is meant to be one line when its column is >= 29rem
  if (wide && r.hero.roleLines !== 1) fail(`headline wraps onto ${r.hero.roleLines} lines although its column is ${Math.round(r.hero.textColW)}px wide`);
  if (wide && !r.hero.roleSepVisible) fail("headline separator hidden on a one-line headline");
  if (wide && r.hero.roleTextW > r.hero.textColW + 0.5) fail(`headline text ${Math.round(r.hero.roleTextW)}px overflows its ${Math.round(r.hero.textColW)}px column`);
  if (wide && r.hero.roleFs < 15.5) fail(`headline font too small: ${r.hero.roleFs}px`);
  console.log(`    headline: ${r.hero.roleLines} line(s) at ${r.hero.roleFs.toFixed(1)}px, separator ${r.hero.roleSepVisible ? "shown" : "stacked"}`);
  console.log(`    hero h1 ${h1.w}px wide, ${r.hero.h1Lines} line(s), ${h1.fs}; lead ${lead.w}px wide; avatar ${avatar.w}px; docScrollW ${r.docScrollW}/${r.vw}`);

  // full-page screenshot (after reveals have fired)
  await page.screenshot({ path: `${SHOTS}/full-${w}.png`, fullPage: true });

  // navigation behaviour
  if (w < 1024) {
    const toggle = page.locator(".menu-toggle");
    if (!(await toggle.isVisible())) fail("menu toggle not visible below 1024px");
    await toggle.click();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") fail("menu did not open");
    const panelBox = await page.locator("#site-nav").boundingBox();
    if (!panelBox || panelBox.x < 0 || panelBox.x + panelBox.width > w) fail("open menu panel outside viewport");
    const cv = await page.locator(".nav__item--cv a").isVisible();
    if (!cv) fail("CV link not visible in open menu");
    await page.screenshot({ path: `${SHOTS}/menu-${w}.png` });
    await page.locator('.nav__link[href="#projects"]').click();
    await page.waitForTimeout(900);
    if ((await toggle.getAttribute("aria-expanded")) !== "false") fail("menu did not close after choosing a link");
    await toggle.click();
    await page.keyboard.press("Escape");
    if ((await toggle.getAttribute("aria-expanded")) !== "false") fail("Escape did not close the menu");
  } else {
    if (await page.locator(".menu-toggle").isVisible()) fail("menu toggle visible on desktop");
    for (const t of ["Home", "About", "Skills", "Projects", "Experience", "Education", "Contact"]) {
      if (!(await page.locator(`.nav__link:text-is("${t}")`).isVisible())) fail(`nav link "${t}" not visible`);
    }
    const navBox = await page.locator(".header__inner").boundingBox();
    const lastBox = await page.locator(".nav__item--cv a").boundingBox();
    if (lastBox.x + lastBox.width > w) fail("View CV button outside viewport");
    void navBox;
  }

  if (errors.length) errors.forEach((e) => fail("console/network: " + e));
  else console.log("    console clean, no failed requests");
  console.log(failures ? "" : "    ok");
  await ctx.close();
}

/* ---------------------------------------------------------------- functional checks (375px) */
console.log("\n== Functional checks (375px) ==");
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });

  // internal anchors all resolve
  const bad = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
  bad.forEach((h) => fail("anchor target missing: " + h));
  console.log(`    internal anchors: ${await page.locator('a[href^="#"]').count()} checked`);

  // external links
  const ext = await page.evaluate(() => [...document.querySelectorAll('a[target="_blank"]')].map((a) => ({ href: a.href, rel: a.rel })));
  ext.forEach((l) => { if (!/noopener/.test(l.rel)) fail("external link missing rel=noopener: " + l.href); });
  const hosts = [...new Set(ext.map((l) => new URL(l.href).hostname || "(local)"))];
  console.log(`    external links: ${ext.length} (${hosts.join(", ")})`);

  // every supplied URL must be present, open in a new tab and carry noopener
  const SUPPLIED = {
    "Fiverr profile": "https://www.fiverr.com/users/shanukabherath",
    "Photosphere GitHub": "https://github.com/shanukabherath-solutions/Photosphere",
    "Photosphere live demo": "https://photosphere-iota.vercel.app/",
    "Photosphere demo video": "https://vimeo.com/1248930571/c1f9e50684?share=copy&fl=sv&fe=ci",
    "AESA GitHub": "https://github.com/shanukabherath-solutions/AESA",
    "AESA documentation": "https://github.com/shanukabherath-solutions/AESA/tree/main/docs",
    "No Exit Online GitHub": "https://github.com/shanukabherath-solutions/No-Exit-Online",
    "Q-Learning Agent GitHub": "https://github.com/shanukabherath-solutions/q-learning-agent",
    "Healthcare Appointment System GitHub": "https://github.com/shanukabherath-solutions/healthcare-appointment-system",
  };
  const anchors = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), target: a.target, rel: a.rel, name: (a.textContent || "").replace(/\s+/g, " ").trim() })));
  for (const [label, url] of Object.entries(SUPPLIED)) {
    const found = anchors.filter((a) => a.href === url);
    if (!found.length) { fail(`supplied link missing: ${label} -> ${url}`); continue; }
    for (const a of found) {
      if (a.target !== "_blank" || !/noopener/.test(a.rel)) fail(`${label}: must open in a new tab with rel=noopener (${a.target}, ${a.rel})`);
      if (!a.name) fail(`${label}: link has no accessible text`);
    }
  }
  console.log(`    supplied links: ${Object.keys(SUPPLIED).length} present, new tab + noopener`);
  for (const must of ["https://github.com/shanukabherath-solutions", "https://www.linkedin.com/in/shanuka-b-herath/", "mailto:shanbhera@gmail.com", "cv/shanuka-herath-cv.pdf"]) {
    if (!anchors.some((a) => a.href === must)) fail("expected link missing: " + must);
  }
  // no empty/placeholder links anywhere
  const badLinks = anchors.filter((a) => !a.href || a.href === "#" || /YOUR_|example\.com/i.test(a.href));
  badLinks.forEach((a) => fail("placeholder/empty link: " + JSON.stringify(a)));
  const text = await page.evaluate(() => document.body.innerText + " " + document.documentElement.innerHTML);
  for (const bad of ["coming soon", "is-disabled", "aria-disabled", "YOUR_", "will appear here as it"]) if (new RegExp(bad, "i").test(text)) fail(`placeholder text found: "${bad}"`);
  console.log("    no placeholder links or 'coming soon' text");

  // content checks for this update
  const content = await page.evaluate(() => ({
    projects: [...document.querySelectorAll("#projects article")].map((a) => a.querySelector("h3,h4")?.textContent.trim()),
    index: [...document.querySelectorAll(".project-index a")].map((a) => a.getAttribute("href")).filter((h) => !document.querySelector(h)),
    ids: (() => { const seen = {}; const dup = []; document.querySelectorAll("[id]").forEach((e) => { if (seen[e.id]) dup.push(e.id); seen[e.id] = 1; }); return dup; })(),
    roles: [...document.querySelectorAll("#experience .role__title")].map((e) => e.textContent.trim()),
    certs: [...document.querySelectorAll("#certifications h3")].map((e) => e.textContent.trim()),
    msItems: document.querySelectorAll("#certifications .cert-group")[0]?.querySelectorAll("li").length,
    selfItems: [...(document.querySelectorAll("#certifications .cert-group")[1]?.querySelectorAll("li") || [])].map((e) => e.textContent.trim()),
  }));
  for (const t of ["Photosphere", "AESA", "No Exit Online", "Q-Learning Agent", "Healthcare Appointment System"]) if (!content.projects.includes(t)) fail("project card missing: " + t);
  if (content.index.length) fail("project index points to missing ids: " + content.index);
  if (content.ids.length) fail("duplicate ids: " + content.ids);
  if (!content.roles.includes("Freelance Software Developer")) fail("freelance experience entry missing");
  for (const t of ["Burp Suite (Web Security)", "Certified Artificial Intelligence Security & Risk (CAISR)", "Future in Quality Assurance", "Microsoft", "Other self-learning"]) if (!content.certs.includes(t)) fail("certification missing: " + t);
  if (content.msItems !== 9) fail("Microsoft group should list 9 items, got " + content.msItems);
  if (content.selfItems.length !== 2) fail("self-learning should list 2 items");
  console.log(`    projects: ${content.projects.join(" / ")}`);
  console.log(`    experience: ${content.roles.join(" / ")}; certifications: ${content.certs.length} cards (Microsoft group: ${content.msItems} items)`);

  // CV + metadata files reachable
  for (const p of ["/cv/shanuka-herath-cv.pdf", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/assets/img/og-image.png", "/_headers"]) {
    const r = await page.request.get(BASE + p);
    if (!r.ok()) fail(`${p} -> ${r.status()}`);
  }
  const nf = await page.request.get(BASE + "/does-not-exist");
  if (nf.status() !== 404) fail("unknown path should return 404, got " + nf.status());

  // fonts actually loaded
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`); });
  console.log(`    fonts loaded: ${fonts.length} (${[...new Set(fonts.map((f) => f.split(" ")[0] + (f.includes("Plex") ? "" : "")))].join(", ")})`);
  if (!fonts.some((f) => f.includes("Space Grotesk"))) fail("Space Grotesk did not load");

  // heading hierarchy + alt text
  const h = await page.evaluate(() => ({ h1: document.querySelectorAll("h1").length, levels: [...document.querySelectorAll("h1,h2,h3,h4")].map((e) => +e.tagName[1]), noAlt: [...document.querySelectorAll("img:not([alt])")].length }));
  if (h.h1 !== 1) fail("expected exactly one h1, got " + h.h1);
  for (let i = 1; i < h.levels.length; i++) if (h.levels[i] - h.levels[i - 1] > 1) fail(`heading level jump ${h.levels[i - 1]} -> ${h.levels[i]}`);
  if (h.noAlt) fail(`${h.noAlt} images without alt attribute`);
  console.log(`    headings: one h1, no skipped levels; every <img> has alt`);

  // keyboard: skip link is first focusable and works
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement.className);
  if (!/skip-link/.test(first)) fail("first Tab stop is not the skip link: " + first);
  await ctx.close();
}

/* ---------------------------------------------------------------- reduced motion + no-JS */
console.log("\n== Reduced motion / no JavaScript (375px) ==");
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const hidden = await page.evaluate(() => [...document.querySelectorAll(".reveal")].filter((e) => getComputedStyle(e).opacity !== "1").length);
  if (hidden) fail(`${hidden} .reveal elements still hidden with prefers-reduced-motion`);
  else console.log("    reduced motion: all content visible immediately");
  await ctx.close();

  const ctx2 = await browser.newContext({ viewport: { width: 375, height: 800 }, javaScriptEnabled: false });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + "/", { waitUntil: "networkidle" });
  const hidden2 = await p2.evaluate(() => [...document.querySelectorAll(".reveal")].filter((e) => getComputedStyle(e).opacity !== "1").length);
  const sw = await p2.evaluate(() => document.documentElement.scrollWidth);
  if (hidden2) fail(`${hidden2} .reveal elements hidden without JS`);
  if (sw > 375) fail("no-JS horizontal overflow " + sw);
  await p2.screenshot({ path: `${SHOTS}/nojs-375.png` });
  console.log(`    no JS: content visible, scrollWidth ${sw}`);
  await ctx2.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);

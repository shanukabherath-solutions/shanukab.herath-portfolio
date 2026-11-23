/**
 * Browser checks for the built site (dist/), run against the static preview server.
 *
 *   npm run build && npm run preview &     # serves dist/ on :4173
 *   npm run test:responsive
 *
 * Needs Playwright + a Chromium: `npx playwright install chromium`, or set PW_CHROMIUM=/path/to/chrome.
 * Env: BASE_URL (default http://localhost:4173), SHOTS_DIR (default ./test-screenshots)
 */
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const SHOTS = process.env.SHOTS_DIR || "test-screenshots";
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1440, 1920];
mkdirSync(SHOTS, { recursive: true });

const MANIFEST = JSON.parse(readFileSync(new URL("../src/assets/img/scene/manifest.json", import.meta.url), "utf8"));
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

/* Header name geometry */
function headerChecks() {
  const q = (s) => document.querySelector(s);
  const name = q(".brand__name"), nav = q("#site-nav");
  const desktop = document.documentElement.clientWidth >= 1024;
  const br = name.getBoundingClientRect();
  return {
    brandText: name.textContent.trim(),
    brandClipped: name.scrollWidth > name.clientWidth + 1,
    brandInViewport: br.left >= 0 && br.right <= document.documentElement.clientWidth,
    brandNavGap: Math.round((desktop ? nav.getBoundingClientRect().left : q(".menu-toggle").getBoundingClientRect().left) - br.right),
  };
}

/* The physics scene: layout, placement, and that the objects sit where they do in Friends.png. */
function sceneChecks(M) {
  const q = (s) => document.querySelector(s);
  const scenes = [...document.querySelectorAll("[data-scene]")];
  const shown = scenes.filter((s) => s.getBoundingClientRect().width > 0);
  const out = { problems: [], shown: shown.length };
  if (shown.length !== 1) { out.problems.push(`expected exactly one visible scene, found ${shown.length}`); return out; }
  const sc = shown[0], st = sc.querySelector(".scene__stage"), sr = st.getBoundingClientRect(), s = sr.width / M.window.w;
  const S = { l: sr.left, r: sr.right, t: sr.top, b: sr.bottom };
  out.slot = sc.closest(".hero__scene-inline") ? "inline" : "beside-avatar";
  out.w = Math.round(sr.width); out.h = Math.round(sr.height); out.scale = s;
  const vw = document.documentElement.clientWidth;
  if (Math.abs(sr.width / sr.height - M.window.w / M.window.h) > 0.01) out.problems.push("scene aspect ratio distorted");
  scenes.filter((x) => x !== sc).forEach((h) => { const slot = h.closest(".hero__scene-inline, .hero__cover"); if (getComputedStyle(slot).display !== "none") out.problems.push("hidden scene copy is not display:none"); });

  // sprite geometry == original composition scaled
  let worst = 0;
  for (const o of M.objects) {
    const el = st.querySelector(`[data-name="${o.name}"]`);
    if (!el) { out.problems.push("missing sprite " + o.name); continue; }
    const r = el.getBoundingClientRect();
    worst = Math.max(worst, Math.abs(r.left - (sr.left + o.x * s)), Math.abs(r.top - (sr.top + o.y * s)), Math.abs(r.width - o.w * s), Math.abs(r.height - o.h * s));
    if (!el.complete || el.naturalWidth !== o.w || el.naturalHeight !== o.h) out.problems.push(`${o.name}: not loaded at native ${o.w}x${o.h} (got ${el.naturalWidth}x${el.naturalHeight})`);
    if (Math.abs(r.width / r.height - o.w / o.h) > 0.01) out.problems.push(`${o.name}: aspect ratio distorted`);
    const z = +getComputedStyle(el).zIndex;
    if (z !== o.z + 1) out.problems.push(`${o.name}: z-index ${z}, expected ${o.z + 1}`);
    const ta = getComputedStyle(el).touchAction;
    if (o.fixed && ta !== "pan-y") out.problems.push("avatar must not capture touch scrolling, touch-action: " + ta);
    if (!o.fixed && ta !== "none") out.problems.push(`${o.name}: touch-action should be none, got ${ta}`);
    if (!el.getAttribute("alt")) out.problems.push(o.name + ": missing alt text");
  }
  out.worstPx = Math.round(worst * 100) / 100;
  if (worst > 0.6) out.problems.push(`object positions differ from Friends.png composition by up to ${worst.toFixed(2)}px`);

  // placement: inside hero + viewport, never overlapping other content
  const R = (sel) => { const e = q(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
  const hit = (a, b, tol = 1) => a.l < b.r - tol && a.r > b.l + tol && a.t < b.b - tol && a.b > b.t + tol;
  const hero = R(".hero");
  if (S.l < hero.l - 0.5 || S.r > hero.r + 0.5 || S.t < hero.t - 0.5 || S.b > hero.b + 0.5) out.problems.push("scene extends outside the hero");
  if (S.l < -0.5 || S.r > vw + 0.5) out.problems.push("scene extends outside the viewport");
  const others = { name: ".hero__title", role: ".hero__role", lead: ".hero__lead", links: ".hero__links", avatar: ".hero__avatar img", panel: ".hero__panel .window", projectsBtn: ".hero__actions .btn--primary", contactBtn: ".hero__actions .btn--secondary", header: ".site-header" };
  for (const [n, sel] of Object.entries(others)) { const o = R(sel); if (o && hit(S, o)) out.problems.push(`scene overlaps ${n}`); }
  const contact = R(".hero__actions .btn--secondary"), av = R(".hero__avatar img");
  if (out.slot === "inline") {
    out.gapAfterContact = Math.round(S.l - contact.r);
    out.bottomDelta = Math.round(S.b - contact.b);
    if (vw < 1024) out.problems.push("desktop slot visible below 1024px");
    if (out.gapAfterContact < 4 || out.gapAfterContact > 40) out.problems.push(`scene is ${out.gapAfterContact}px from Contact Me (should follow it directly)`);
    if (Math.abs(S.t - contact.t) > 400 || Math.abs(S.b - contact.b) > 2) out.problems.push(`scene bottom not aligned with the buttons (delta ${out.bottomDelta}px)`);
  } else {
    out.gapToAvatar = Math.round(S.l - av.r);
    if (vw >= 1024) out.problems.push("mobile slot visible on desktop");
    if (out.gapToAvatar < 8) out.problems.push(`scene is only ${out.gapToAvatar}px from the avatar`);
    if (S.b < av.t || S.t > av.b) out.problems.push("scene is not on the avatar's row");
  }
  return out;
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
  // measure with every expandable section open: that is where narrow screens are most likely to break
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  await page.waitForTimeout(150);
  const r = await page.evaluate(pageChecks);

  if (r.docScrollW > r.vw) fail(`horizontal scroll: documentElement.scrollWidth ${r.docScrollW} > viewport ${r.vw}`);
  if (r.bodyScrollW > r.vw) fail(`body.scrollWidth ${r.bodyScrollW} > viewport ${r.vw}`);
  r.textOutside.slice(0, 8).forEach((t) => fail("text outside viewport: " + t));
  r.clipped.slice(0, 8).forEach((t) => fail("clipped container: " + t));
  r.brokenImages.forEach((t) => fail("image not loaded: " + t));
  const hd = await page.evaluate(headerChecks);
  if (hd.brandText !== "Shanuka B. Herath") fail("header name is: " + hd.brandText);
  if (hd.brandClipped || !hd.brandInViewport) fail("header name is clipped or outside the viewport");
  if (hd.brandNavGap < 12) fail(`header name is only ${hd.brandNavGap}px from the ${w >= 1024 ? "nav" : "menu button"}`);
  const sc = await page.evaluate(sceneChecks, MANIFEST);
  sc.problems.forEach((t) => fail(t));
  console.log(`    scene (${sc.slot}) ${sc.w}x${sc.h}px, scale ${sc.scale?.toFixed(3)}, objects within ${sc.worstPx}px of Friends.png layout, ${sc.slot === "inline" ? sc.gapAfterContact + "px after Contact Me" : sc.gapToAvatar + "px right of avatar"}; header "${hd.brandText}" ${hd.brandNavGap}px from ${w >= 1024 ? "nav" : "menu button"}`);
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
    "No Exit Online live demo": "https://no-exit-online.vercel.app/",
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
  for (const t of ["Photosphere", "AESA", "No Exit Online", "Q-Learning Agent", "Healthcare Appointment System"]) if (!content.projects.some((x) => x && x.startsWith(t))) fail("project card missing: " + t);
  if (content.index.length) fail("project index points to missing ids: " + content.index);
  if (content.ids.length) fail("duplicate ids: " + content.ids);
  if (!content.roles.includes("Freelance Software Developer")) fail("freelance experience entry missing");
  for (const t of ["Burp Suite (Web Security)", "Certified Artificial Intelligence Security & Risk (CAISR)", "Future in Quality Assurance", "Microsoft", "Other self-learning"]) if (!content.certs.includes(t)) fail("certification missing: " + t);
  if (content.msItems !== 9) fail("Microsoft group should list 9 items, got " + content.msItems);
  if (content.selfItems.length !== 2) fail("self-learning should list 2 items");
  const ne = await page.evaluate(() => {
    const c = document.querySelector("#project-no-exit-online");
    if (!c) return null;
    const txt = (e) => e?.textContent.replace(/\s+/g, " ").trim();
    const links = [...c.querySelectorAll("a[href]")].map((a) => ({ name: txt(a), href: a.getAttribute("href"), target: a.target, visible: a.getBoundingClientRect().width > 0 }));
    const det = c.querySelector("details");
    return {
      title: txt(c.querySelector(".spot__title")),
      tagLabels: [...c.querySelectorAll(":scope > .tags .tag")].map(txt),
      pillars: [...c.querySelectorAll(".pillar__label")].map(txt),
      paragraphs: c.querySelectorAll(".detail__text p").length,
      tech: [...c.querySelectorAll(".detail__blocks > div:first-child .tag")].map(txt),
      focus: [...c.querySelectorAll(".detail__blocks > div:last-child .tag")].map(txt),
      links, hasDetails: !!det, summaryVisible: det ? det.querySelector("summary").getBoundingClientRect().height > 0 : false,
      inMoreGroup: !!document.querySelector("#projects .group-label + #project-no-exit-online"),
    };
  });
  if (!ne) fail("No Exit Online card missing");
  else {
    if (ne.title !== "No Exit Online - Browser-Based Game & Security Engineering") fail("No Exit Online title wrong: " + ne.title);
    if (!ne.inMoreGroup) fail("No Exit Online is not at the top of the More projects group");
    if (ne.tagLabels.join("|") !== "Game Development|Security Engineering") fail("category tags: " + ne.tagLabels);
    if (ne.pillars.length !== 2) fail("expected two pillars (game development, security engineering)");
    if (ne.paragraphs !== 4) fail("expected 4 detailed-description paragraphs, got " + ne.paragraphs);
    if (ne.tech.length !== 10) fail("expected 10 technologies, got " + ne.tech.length);
    if (ne.focus.length !== 6) fail("expected 6 focus areas, got " + ne.focus.length);
    if (!ne.hasDetails || !ne.summaryVisible) fail("expandable details missing or hidden");
    for (const l of ne.links) { if (l.target !== "_blank" || !l.visible) fail("No Exit link not visible/new-tab: " + l.href); }
    if (!ne.links.some((l) => l.name.startsWith("Live Demo")) || !ne.links.some((l) => l.name.startsWith("View on GitHub"))) fail("No Exit needs visible Live Demo and View on GitHub links");
    console.log(`    No Exit Online: "${ne.title}"; pillars ${ne.pillars.join(" + ")}; ${ne.tech.length} tools, ${ne.focus.length} focus areas; links ${ne.links.map((l) => l.name.split(" (")[0]).join(", ")}`);
  }
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


/* ---------------------------------------------------------------- physics scene interaction */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => { if (!cond) fail(msg); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const sceneState = (page) => page.evaluate(() => {
  const sc = [...document.querySelectorAll("[data-scene]")].find((s) => s.getBoundingClientRect().width > 0);
  const st = sc.querySelector(".scene__stage"), r = st.getBoundingClientRect(), W = +sc.dataset.w, H = +sc.dataset.h, s = r.width / W;
  const bodies = {};
  sc.querySelectorAll(".sprite").forEach((el) => {
    const m = /translate3d\(([-\d.e]+)px,\s*([-\d.e]+)px/.exec(el.style.transform || "");
    const tx = m ? +m[1] : 0, ty = m ? +m[2] : 0, rc = el.getBoundingClientRect();
    bodies[el.dataset.name] = { x: +el.dataset.x + tx / s, y: +el.dataset.y + ty / s, w: +el.dataset.w, h: +el.dataset.h, hx: +el.dataset.x, hy: +el.dataset.y, tx, ty,
      z: +el.style.zIndex, rect: { l: rc.left, t: rc.top, r: rc.right, b: rc.bottom }, dragging: el.classList.contains("is-dragging"), transform: el.style.transform || "" };
  });
  const rb = sc.querySelector(".scene__reset");
  return { stage: { l: r.left, t: r.top, r: r.right, b: r.bottom }, s, W, H, sim: sc.hasAttribute("data-sim"), resetHidden: rb.hidden, over: st.classList.contains("is-over"), bodies };
});

// a point (in scene units and css px) where `name` is solid and nothing in front of it is
const grabPoint = (page, name) => page.evaluate((name) => {
  const sc = [...document.querySelectorAll("[data-scene]")].find((s) => s.getBoundingClientRect().width > 0);
  const st = sc.querySelector(".scene__stage"), r = st.getBoundingClientRect(), s = r.width / +sc.dataset.w;
  const info = [...sc.querySelectorAll(".sprite")].map((el) => {
    const w = +el.dataset.w, h = +el.dataset.h, c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(el, 0, 0, w, h);
    const m = /translate3d\(([-\d.e]+)px,\s*([-\d.e]+)px/.exec(el.style.transform || "");   // current position, not home
    return { name: el.dataset.name, x: +el.dataset.x + (m ? +m[1] : 0) / s, y: +el.dataset.y + (m ? +m[2] : 0) / s, w, h, z: +el.style.zIndex, a: g.getImageData(0, 0, w, h).data };
  });
  const alpha = (o, X, Y) => { const lx = Math.floor(X - o.x), ly = Math.floor(Y - o.y); return lx < 0 || ly < 0 || lx >= o.w || ly >= o.h ? 0 : o.a[(ly * o.w + lx) * 4 + 3]; };
  const t = info.find((o) => o.name === name);
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < t.h; y += 2) for (let x = 0; x < t.w; x += 2) if (t.a[(y * t.w + x) * 4 + 3] > 200) { sx += x; sy += y; n++; }
  const cx = t.x + sx / n, cy = t.y + sy / n;
  const free = (X, Y) => alpha(t, X, Y) > 200 && info.every((o) => o === t || o.z < t.z || alpha(o, X, Y) <= 24);
  for (let rad = 0; rad < 150; rad += 2) for (let k = 0; k < 24; k++) {
    const ang = (k / 24) * Math.PI * 2, X = cx + Math.cos(ang) * rad, Y = cy + Math.sin(ang) * rad;
    if (free(X, Y)) return { x: X, y: Y, px: r.left + X * s, py: r.top + Y * s };
  }
  return null;
}, name);

async function mouseDrag(page, p, steps, { dt = 16, release = true } = {}) {
  await page.mouse.move(p.px, p.py);
  await page.mouse.down();
  let x = p.px, y = p.py;
  for (const [dx, dy] of steps) { x += dx; y += dy; await page.mouse.move(x, y); await sleep(dt); }
  if (release) await page.mouse.up();
  return { x, y };
}
async function trace(page, name, ms, every = 25) {
  const out = [], t0 = Date.now();
  while (Date.now() - t0 < ms) { const s = await sceneState(page); const b = s.bodies[name]; out.push({ t: Date.now() - t0, x: b.x, y: b.y, sim: s.sim }); await sleep(every); }
  return out;
}
async function waitSettled(page, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (!(await sceneState(page)).sim) return true; await sleep(50); }
  return false;
}
const repeat = (n, v) => Array.from({ length: n }, () => v);
const inBounds = (b, W, H, eps = 0.05) => b.x >= -eps && b.y >= -eps && b.x <= W - b.w + eps && b.y <= H - b.h + eps;

/* ---- mouse (desktop) ---- */
console.log("\n== Physics scene: mouse (1440px) ==");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(1700);
  const s0 = await sceneState(page), W = s0.W, H = s0.H, sc = s0.s;
  const home = JSON.parse(JSON.stringify(s0.bodies));
  const avatarRect0 = s0.bodies.avatar.rect;

  // A. drag follows the pointer exactly, is held while the pointer pauses, then drops under gravity and bounces
  let p = await grabPoint(page, "dog");
  await mouseDrag(page, p, repeat(10, [4, -4]), { release: false });
  await sleep(200);
  let s = await sceneState(page);
  check(near(s.bodies.dog.tx, 40, 1.5) && near(s.bodies.dog.ty, -40, 1.5), `drag does not follow the mouse: moved ${s.bodies.dog.tx.toFixed(1)},${s.bodies.dog.ty.toFixed(1)} instead of 40,-40`);
  check(s.bodies.dog.dragging, "dragged object has no is-dragging state");
  check(s.bodies.dog.z > s.bodies.avatar.z, "dragged object is not brought to the front");
  check(near(s.bodies.cat.tx, 0, 0.01) && near(s.bodies.whale.tx, 0, 0.01), "other objects moved while one was dragged");
  await page.mouse.up();
  const dropTrace = await trace(page, "dog", 2000);
  const dropX = home.dog.x + 40 / sc;
  check(near(dropTrace.at(-1).x, dropX, 1.5), `a paused drag must not throw sideways: x ${dropTrace.at(-1).x.toFixed(1)} vs ${dropX.toFixed(1)}`);
  const floorY = H - home.dog.h;
  check(near(dropTrace.at(-1).y, floorY, 0.6), "dropped object did not come to rest on the floor");
  const hitI = dropTrace.findIndex((q) => q.y >= floorY - 6);                 // first frame at the floor
  const lowest = Math.max(...dropTrace.slice(0, hitI + 3).map((q) => q.y));    // deepest point of the first impact
  const risen = lowest - Math.min(...dropTrace.slice(hitI + 1, hitI + 14).map((q) => q.y));
  check(hitI > 0 && risen > 8, `no bounce when hitting the floor (rose only ${risen.toFixed(1)} units)`);
  check(dropTrace.every((q) => q.y >= -0.05 && q.y <= floorY + 0.05), "object left the scene vertically");
  console.log(`  A drag: follows the pointer (40,-40px), held on pause, falls and bounces on the floor (rests at y=${floorY})`);

  // B. throw the cat to the right wall: momentum, wall bounce, slowing, rest
  p = await grabPoint(page, "cat");
  await mouseDrag(page, p, repeat(8, [14, 0]), { dt: 16 });
  const t1 = await trace(page, "cat", 3500);
  const catW = home.cat.w, maxX = W - catW;
  const xs = t1.map((q) => q.x), peak = Math.max(...xs);
  check(xs.every((x) => x <= maxX + 0.05 && x >= -0.05), "thrown object left the scene");
  check(peak >= maxX - 0.6, `thrown object never reached the wall (peak ${peak.toFixed(1)} of ${maxX.toFixed(1)})`);
  const iw = xs.findIndex((x) => x >= maxX - 0.6);
  check(Math.min(...xs.slice(iw)) < peak - 5, "object did not bounce back off the wall");
  const speedAt = (i, win = 6) => Math.abs(xs[Math.min(i + win, xs.length - 1)] - xs[i]) / (win * 25 / 1000);
  const earlyV = speedAt(iw + 2), lateV = speedAt(Math.min(xs.length - 8, iw + 40));
  check(lateV < earlyV * 0.5 || lateV < 15, `object does not slow down gradually (${earlyV.toFixed(0)} -> ${lateV.toFixed(0)} units/s)`);
  check(await waitSettled(page, 8000), "simulation keeps running after the object has stopped");
  const r1 = (await sceneState(page)).bodies.cat.x; await sleep(500);
  check(near((await sceneState(page)).bodies.cat.x, r1, 0.01), "object still drifting after the simulation stopped");
  console.log(`  B throw right: reached wall (${peak.toFixed(0)}/${maxX.toFixed(0)}), bounced back, slowed ${earlyV.toFixed(0)} -> ${lateV.toFixed(0)} units/s, came to rest, loop stopped`);

  // C. throw the dog to the left wall
  p = await grabPoint(page, "dog");
  const sb = await sceneState(page); const dogBefore = sb.bodies.dog.x;
  await mouseDrag(page, p, repeat(8, [-16, 0]), { dt: 16 });
  const t2 = await trace(page, "dog", 2500), dx = t2.map((q) => q.x);
  check(dx.every((x) => x >= -0.05 && x <= W - home.dog.w + 0.05), "thrown object left the scene (left wall)");
  check(Math.min(...dx) <= 0.6, `thrown object never reached the left wall (min ${Math.min(...dx).toFixed(1)})`);
  const il = dx.findIndex((x) => x <= 0.6);
  check(Math.max(...dx.slice(il)) > 4, "no bounce off the left wall");
  check(await waitSettled(page, 8000), "simulation did not stop (left throw)");
  console.log(`  C throw left: from x=${dogBefore.toFixed(0)} to the wall (min ${Math.min(...dx).toFixed(1)}) and bounced`);

  // D. dragging far outside the scene keeps the object inside
  p = await grabPoint(page, "godot");
  await mouseDrag(page, p, repeat(6, [-110, -90]), { release: false });
  s = await sceneState(page); const g = s.bodies.godot.rect;
  check(g.l >= s.stage.l - 1 && g.t >= s.stage.t - 1 && g.r <= s.stage.r + 1 && g.b <= s.stage.b + 1, "dragged object left the scene");
  await sleep(200); await page.mouse.up(); await waitSettled(page, 8000);
  console.log("  D boundary: pointer dragged 660px outside the scene, object stayed inside");

  // E. hover feedback only over solid pixels
  const hp = await grabPoint(page, "cat");
  await page.mouse.move(hp.px, hp.py); await sleep(80);
  check((await sceneState(page)).over, "no grab cursor state over an object");
  const stg = (await sceneState(page)).stage;
  await page.mouse.move(stg.l + 3, stg.t + (stg.b - stg.t) * 0.3); await sleep(80);
  check(!(await sceneState(page)).over, "grab cursor shown over empty space");

  // F. reset button + keyboard
  s = await sceneState(page);
  check(!s.resetHidden, "reset button should be visible once objects were moved");
  await page.locator(".scene__reset:visible").focus();
  check(await page.evaluate(() => document.activeElement.classList.contains("scene__reset")), "reset button is not keyboard focusable");
  await page.keyboard.press("Enter");
  await sleep(150); await waitSettled(page, 4000);
  s = await sceneState(page);
  const off = Object.entries(home).filter(([n, h]) => n !== "avatar" && (!near(s.bodies[n].x, h.x, 0.5) || !near(s.bodies[n].y, h.y, 0.5)));
  check(off.length === 0, "reset did not return objects home: " + off.map((o) => o[0]));
  check(s.resetHidden, "reset button should hide again after resetting");
  check(Object.entries(home).every(([n, h]) => s.bodies[n].z === h.z), "stacking order not restored after reset");
  console.log("  E/F hover cursor only on solid pixels; reset (keyboard) returns every object and the original stacking order");

  // G. the avatar is fixed
  s = await sceneState(page);
  const snap = JSON.parse(JSON.stringify(s.bodies));
  p = await grabPoint(page, "avatar");
  await mouseDrag(page, p, repeat(8, [8, 4]), { dt: 16 });
  await sleep(300);
  s = await sceneState(page);
  check(Object.entries(snap).every(([n, b]) => near(s.bodies[n].x, b.x, 0.01) && near(s.bodies[n].y, b.y, 0.01)), "pressing/dragging the avatar moved something");
  check(!s.bodies.avatar.dragging && s.sim === false, "avatar entered a dragging/simulation state");
  p = await grabPoint(page, "cat");
  await mouseDrag(page, p, repeat(8, [-20, 0]), { dt: 16 });     // throw the cat across / behind the avatar
  p = await grabPoint(page, "dog").catch(() => null);
  await waitSettled(page, 9000);
  s = await sceneState(page);
  const a = s.bodies.avatar;
  check(near(a.rect.l, avatarRect0.l, 0.01) && near(a.rect.t, avatarRect0.t, 0.01) && near(a.rect.r, avatarRect0.r, 0.01) && near(a.rect.b, avatarRect0.b, 0.01), "avatar moved or resized");
  check(near(a.tx, 0, 0.001) && near(a.ty, 0, 0.001), "avatar has a translate applied: " + a.transform);
  console.log("  G avatar fixed: unmoved by dragging it and by a cat thrown through it (rect and transform identical)");

  check(errs.length === 0, "console errors: " + errs.join(" | "));
  await ctx.close();
}

/* ---- touch (phone) ---- */
console.log("\n== Physics scene: touch (375px phone) ==");
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(1700);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((q) => ({ x: q.x, y: q.y, id: q.id })) });
  const s0 = await sceneState(page), W = s0.W, H = s0.H, sc = s0.s;
  const home = JSON.parse(JSON.stringify(s0.bodies));

  // A. one finger drags and throws; the page does not scroll while dragging an object
  let p = await grabPoint(page, "dog");
  await touch("touchStart", [{ x: p.px, y: p.py, id: 1 }]);
  let x = p.px, y = p.py;
  for (let i = 0; i < 8; i++) { x -= 3; y -= 5; await touch("touchMove", [{ x, y, id: 1 }]); await sleep(16); }
  let s = await sceneState(page);
  check(near(s.bodies.dog.tx, -24, 3) && near(s.bodies.dog.ty, -40, 3), `finger drag does not follow the finger (${s.bodies.dog.tx.toFixed(1)},${s.bodies.dog.ty.toFixed(1)} vs -24,-40)`);
  check(await page.evaluate(() => scrollY) === 0, "page scrolled while an object was being dragged");
  await touch("touchEnd", []);
  const tt = await trace(page, "dog", 2200);
  check(tt.every((q) => q.x >= -0.05 && q.x <= W - home.dog.w + 0.05 && q.y >= -0.05 && q.y <= H - home.dog.h + 0.05), "touch-thrown object left the scene");
  check(Math.min(...tt.map((q) => q.x)) < home.dog.x - 24 / sc - 8, "finger throw has no momentum (object stopped where released)");
  check(await waitSettled(page, 8000), "simulation did not stop after a touch throw");
  check(await page.evaluate(() => scrollY) === 0, "page scrolled during touch throw");
  console.log("  A one finger: follows the finger, no page scroll, throw glides, stays in bounds, settles");

  // B. two fingers move two objects independently
  await page.locator(".scene__reset:visible").click(); await sleep(150); await waitSettled(page, 4000);
  const pb = await grabPoint(page, "bee"), pd = await grabPoint(page, "dog");
  await touch("touchStart", [{ x: pb.px, y: pb.py, id: 1 }, { x: pd.px, y: pd.py, id: 2 }]);
  let bx = pb.px, by = pb.py, dx = pd.px, dy = pd.py;
  for (let i = 0; i < 10; i++) { bx += 2; by += 3; dx -= 3; dy -= 2; await touch("touchMove", [{ x: bx, y: by, id: 1 }, { x: dx, y: dy, id: 2 }]); await sleep(16); }
  await sleep(200);
  s = await sceneState(page);
  check(near(s.bodies.bee.tx, 20, 3) && near(s.bodies.bee.ty, 30, 3), `bee did not follow finger 1 (${s.bodies.bee.tx.toFixed(1)},${s.bodies.bee.ty.toFixed(1)})`);
  check(near(s.bodies.dog.tx, -30, 3) && near(s.bodies.dog.ty, -20, 3), `dog did not follow finger 2 (${s.bodies.dog.tx.toFixed(1)},${s.bodies.dog.ty.toFixed(1)})`);
  check(s.bodies.bee.dragging && s.bodies.dog.dragging, "both objects should be in the dragging state");
  check(["cat", "whale", "godot", "github", "avatar"].every((n) => near(s.bodies[n].tx, 0, 0.01) && near(s.bodies[n].ty, 0, 0.01)), "other objects moved during the two-finger drag");
  await touch("touchEnd", []);
  await waitSettled(page, 9000);
  console.log("  B two fingers: bee and dog moved independently, nothing else moved");

  // C. the page still scrolls from the avatar / elsewhere; objects capture the gesture
  await page.locator(".scene__reset:visible").click(); await sleep(150); await waitSettled(page, 4000);
  await page.evaluate(() => scrollTo(0, 0));
  const lead = await page.locator(".hero__lead").boundingBox();
  const swipe = async (from, dyTotal) => {
    await touch("touchStart", [{ x: from.x, y: from.y, id: 1 }]);
    for (let i = 1; i <= 10; i++) { await touch("touchMove", [{ x: from.x, y: from.y + (dyTotal * i) / 10, id: 1 }]); await sleep(16); }
    await touch("touchEnd", []); await sleep(250);
  };
  await swipe({ x: lead.x + 40, y: lead.y + lead.height / 2 }, -160);
  const control = await page.evaluate(() => scrollY);
  const av = await grabPoint(page, "avatar");
  if (control > 20) {
    await page.evaluate(() => scrollTo(0, 0)); await sleep(100);
    const av2 = await grabPoint(page, "avatar");
    await swipe({ x: av2.px, y: av2.py }, -120);
    const sy = await page.evaluate(() => scrollY);
    check(sy > 20, `swiping from the avatar should still scroll the page (scrollY ${sy})`);
    s = await sceneState(page);
    check(Object.entries(home).every(([n, h]) => near(s.bodies[n].x, h.x, 0.01) && near(s.bodies[n].y, h.y, 0.01)), "swiping on the avatar moved objects");
    console.log(`  C scroll: page scrolls from text (${control}px) and from the avatar (${sy}px); avatar swipe moved nothing`);
  } else {
    console.log("  C scroll: synthetic touch scrolling unavailable in this browser build; verified by computed touch-action (avatar pan-y, objects none)");
  }
  check(errs.length === 0, "console errors: " + errs.join(" | "));
  await ctx.close();
}

/* ---- tablet: mouse and touch on the same page ---- */
console.log("\n== Physics scene: tablet (768px) with mouse and touch ==");
{
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1000 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(1700);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((q) => ({ x: q.x, y: q.y, id: q.id })) });
  let p = await grabPoint(page, "dog");
  await mouseDrag(page, p, repeat(8, [5, -4]), { release: false });
  await sleep(150);
  let s = await sceneState(page);
  check(near(s.bodies.dog.tx, 40, 2) && near(s.bodies.dog.ty, -32, 2), "mouse drag failed on tablet");
  await page.mouse.up(); await waitSettled(page, 8000);
  p = await grabPoint(page, "cat");
  await touch("touchStart", [{ x: p.px, y: p.py, id: 1 }]);
  let x = p.px;
  for (let i = 0; i < 8; i++) { x -= 9; await touch("touchMove", [{ x, y: p.py, id: 1 }]); await sleep(16); }
  await sleep(150);
  s = await sceneState(page);
  check(near(s.bodies.cat.tx, -72, 3), "touch drag failed on tablet");
  await touch("touchEnd", []); await waitSettled(page, 8000);
  console.log("  tablet: mouse drag and finger drag both work on the same page");
  await ctx.close();
}

/* ---- reduced motion ---- */
console.log("\n== Physics scene: reduced motion (1440px) ==");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(1200);
  let p = await grabPoint(page, "cat");
  await mouseDrag(page, p, repeat(8, [14, 0]), { dt: 16 });
  const r = await trace(page, "cat", 700);
  const span = Math.max(...r.map((q) => q.x)) - Math.min(...r.map((q) => q.x));
  check(span < 0.01 && r.every((q) => !q.sim), `reduced motion: object glided after release (moved ${span.toFixed(2)} units)`);
  p = await grabPoint(page, "dog");
  await mouseDrag(page, p, repeat(8, [0, -4]), { dt: 16 });
  await sleep(100);
  const up = (await sceneState(page)).bodies.dog;
  await sleep(600);
  const after = (await sceneState(page)).bodies.dog;
  check(near(up.y, after.y, 0.01) && after.y < up.hy - 10, "reduced motion: object fell after release (no gravity expected)");
  await page.locator(".scene__reset:visible").click(); await sleep(120);
  const s = await sceneState(page);
  check(["cat", "dog"].every((n) => near(s.bodies[n].x, s.bodies[n].hx, 0.01) && near(s.bodies[n].y, s.bodies[n].hy, 0.01)), "reduced motion: reset should snap home");
  console.log("  objects follow the pointer but do not glide, fall or bounce; reset snaps home");
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

/**
 * Static build: content/profile.mjs + src/  ->  dist/
 *
 * Output is plain HTML/CSS/JS. Nothing here is needed at runtime.
 * Usage:  npm run build
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

import { lucide } from "./icons.mjs";
import {
  siteConfig as site, about, skillGroups, featuredProject as photo, aesaProject as aesa,
  smallProjects, experience, experienceNote, graphicDesignNote, education, certifications,
  services, servicesNote,
} from "../content/profile.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const now = new Date();
const YEAR = now.getFullYear();
const ISO_DATE = now.toISOString().slice(0, 10);

/* ------------------------------------------------------------------ helpers */
const esc = (s) => String(s).replace(/'/g, "\u2019").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hash = (buf) => createHash("md5").update(buf).digest("hex").slice(0, 8);

const icon = (name, cls = "") =>
  `<svg class="icon${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${lucide[name]}</svg>`;

const BRAND = {
  github: `<svg class="icon icon--fill" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>`,
  linkedin: `<svg class="icon icon--fill" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/></svg>`,
};

/** class attribute with the reveal-on-scroll hook. `step` staggers the delay (CSS maps data-d to a delay). */
const rc = (base = "", step = 0) =>
  `class="${(base + " reveal").trim()}"${step ? ` data-d="${Math.min(step, 8)}"` : ""}`;

/** A button/link that renders as a disabled placeholder when href is empty. */
function action({ href, label, variant = "secondary", ic = "", external = true, extra = "" }) {
  const cls = `btn btn--${variant}${extra ? " " + extra : ""}`;
  const inner = `${esc(label)}${ic}`;
  if (!href) {
    return `<span class="${cls} is-disabled" role="link" aria-disabled="true" title="Link coming soon">${inner}<span class="sr-only"> (link coming soon)</span></span>`;
  }
  const rel = external ? ` target="_blank" rel="noopener noreferrer"` : "";
  return `<a class="${cls}" href="${esc(href)}"${rel}>${inner}</a>`;
}

const tags = (items, tone = "") =>
  `<ul class="tags">${items.map((t) => `<li class="tag${tone ? " tag--" + tone : ""}">${esc(t)}</li>`).join("")}</ul>`;

function sectionHead(id, path, title, desc) {
  return `<div ${rc("section__head")}>
          <p class="section__path">${esc(path)}</p>
          <h2 class="section__title" id="${id}-title">${esc(title)}</h2>${desc ? `\n          <p class="section__desc">${esc(desc)}</p>` : ""}
        </div>`;
}
const section = (id, path, title, desc, body) => `
    <section class="section" id="${id}" aria-labelledby="${id}-title">
      <div class="container">
        ${sectionHead(id, path, title, desc)}
        <div class="section__body">${body}
        </div>
      </div>
    </section>`;

/* ------------------------------------------------------------------ sections */
const NAV = [
  ["Home", "#home"], ["About", "#about"], ["Skills", "#skills"], ["Projects", "#projects"],
  ["Experience", "#experience"], ["Education", "#education"], ["Contact", "#contact"],
];

function header(base) {
  return `
  <header class="site-header">
    <div class="container header__inner">
      <a class="brand" href="${base}#home">
        <img class="brand__avatar" src="${base}assets/img/avatar-128.webp" width="40" height="40" alt="" decoding="async">
        <span class="brand__name">${esc(site.shortName)}</span>
      </a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
        ${icon("menu", "icon--open")}${icon("x", "icon--close")}
      </button>
      <nav class="nav" id="site-nav" aria-label="Primary">
        <ul class="nav__list">
          ${NAV.map(([l, h]) => `<li><a class="nav__link" href="${base}${h}">${l}</a></li>`).join("\n          ")}
          <li class="nav__item--cv"><a class="nav__link" href="${base}${site.cvPath}" target="_blank" rel="noopener noreferrer">${icon("fileText")}View CV</a></li>
        </ul>
      </nav>
    </div>
  </header>`;
}

function hero() {
  const line = (i, html) => `<span class="l${i ? " i" + i : ""}">${html}</span>`;
  const k = (s) => `<span class="k">"${s}"</span><span class="p">: </span>`;
  const str = (s) => `<span class="s">"${esc(s)}"</span>`;
  const code = [
    line(0, `<span class="p">{</span>`),
    line(1, `${k("name")}${str(site.name)}<span class="p">,</span>`),
    line(1, `${k("role")}${str("Software & AI Developer")}<span class="p">,</span>`),
    line(1, `${k("focus")}<span class="p">[</span>${str("Web")}<span class="p">, </span>${str("AI")}<span class="p">, </span>${str("Security")}<span class="p">],</span>`),
    line(1, `${k("specialisation")}${str("AI Engineering & DevSecOps")}<span class="p">,</span>`),
    line(1, `${k("status")}<span class="v">"open_to_work"</span>`),
    line(0, `<span class="p">}</span><span class="caret" aria-hidden="true"></span>`),
  ].join("");

  return `
    <section class="hero" id="home" aria-labelledby="hero-title">
      <div class="hero__glow" aria-hidden="true"></div>
      <div class="container hero__grid">
        <figure class="hero__avatar">
          <img src="assets/img/avatar-320.webp"
               srcset="assets/img/avatar-128.webp 128w, assets/img/avatar-320.webp 320w, assets/img/avatar-560.webp 560w"
               sizes="(min-width: 64em) 272px, (min-width: 40em) 160px, 144px"
               width="320" height="320" fetchpriority="high" decoding="async"
               alt="Illustrated portrait of Shanuka B. Herath: curly black hair and a beard, dark charcoal top, on a sky-blue circle">
        </figure>

        <div class="hero__text">
          <p class="prompt"><span>$</span> whoami</p>
          <h1 class="hero__title" id="hero-title">${esc(site.heroHeadline)}</h1>
          <p class="hero__role">${site.role.split(" | ").map((part, i) => (i ? `<span class="hero__sep" aria-hidden="true">|</span><span class="sr-only">, </span>` : "") + `<span>${esc(part)}</span>`).join("")}</p>
          <p class="hero__lead">${esc(site.heroSubhead)}</p>
          <div class="hero__actions">
            <a class="btn btn--primary" href="#projects">View My Projects ${icon("arrowUpRight")}</a>
            <a class="btn btn--secondary" href="#contact">Contact Me</a>
          </div>
          <ul class="hero__links" aria-label="Profiles and CV">
            <li><a href="${esc(site.social.github)}" target="_blank" rel="noopener noreferrer">${BRAND.github}GitHub</a></li>
            <li><a href="${esc(site.social.linkedin)}" target="_blank" rel="noopener noreferrer">${BRAND.linkedin}LinkedIn</a></li>
            <li><a href="${site.cvPath}" target="_blank" rel="noopener noreferrer">${icon("fileText")}CV / Resume</a></li>
          </ul>
        </div>

        <div class="hero__panel">
          <div class="window" role="group" aria-label="Profile summary">
            <div class="window__bar" aria-hidden="true"><span class="window__dot"></span><span class="window__dot"></span><span class="window__dot"></span><span class="window__title">profile.json</span></div>
            <code class="code">${code}</code>
          </div>
        </div>
      </div>
    </section>`;
}

function aboutSection() {
  return section("about", "~/about", "About", "", `
          <div class="about">
            <div class="about__text reveal">
              ${about.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n              ")}
            </div>
            <div class="card card--pad reveal" data-d="2">
              <p class="about__label">interests</p>
              ${tags(about.interests)}
            </div>
          </div>`);
}

function skillsSection() {
  const cards = skillGroups.map((g, i) => `
            <article ${rc("card card--pad skill", i % 3)}>
              <div class="skill__head">
                <span class="icon-box">${icon(g.icon)}</span>
                <h3 class="skill__title">${esc(g.category)}</h3>
              </div>
              <p class="skill__blurb">${esc(g.blurb)}</p>
              ${tags(g.items)}
            </article>`).join("");
  return section("skills", "~/skills", "Skills", "Grouped by the kind of problem they help me solve, not ranked by percentage.",
    `\n          <div class="grid-auto">${cards}\n          </div>`);
}

function photosphere() {
  const tools = [["scissors", "Background removal"], ["palette", "Colour enhancement"], ["sparkles", "Sharpening"], ["waves", "Noise reduction"], ["maximize", "Upscaling"]];
  const p = photo;
  return `
        <article ${rc("project project--featured")} aria-labelledby="photosphere-title">
          <ul class="tags"><li class="tag tag--accent">Featured project</li></ul>
          <div class="project__grid">
            <div class="window" role="group" aria-label="Photosphere editor preview with a before and after photo edit">
              <div class="window__bar" aria-hidden="true"><span class="window__dot"></span><span class="window__dot"></span><span class="window__dot"></span><span class="window__title">photosphere — editor</span></div>
              <div class="mock__canvas">
                <div class="mock__half mock__half--before"><img src="${p.media.before}" width="824" height="549" loading="lazy" decoding="async" alt="Photo before editing in Photosphere"></div>
                <div class="mock__half mock__half--after"><img src="${p.media.after}" width="824" height="549" loading="lazy" decoding="async" alt="Same photo after editing in Photosphere"></div>
                <span class="mock__tag mock__tag--before" aria-hidden="true">before</span>
                <span class="mock__tag mock__tag--after" aria-hidden="true">after</span>
                <div class="mock__divider" aria-hidden="true"><span class="mock__handle"><svg class="icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M4 2 1 6l3 4M8 2l3 4-3 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
              </div>
              <div class="mock__prompt">${icon("mic")}
                <p><span class="mock__si" lang="si">${esc(p.promptExample.sinhala)}</span><span class="mock__en">&ldquo;${esc(p.promptExample.translation)}&rdquo;</span></p>
              </div>
              <div class="mock__toolbar">
                <div class="mock__tools">${tools.map(([ic, label]) => `<span class="mock__tool" title="${label}">${icon(ic)}<span class="sr-only">${label}</span></span>`).join("")}</div>
                <div class="mock__history" aria-hidden="true">${icon("undo")}${icon("redo")}</div>
              </div>
            </div>

            <div>
              <h3 class="project__title" id="photosphere-title">${esc(p.title)}</h3>
              <p class="project__tagline">${esc(p.tagline)}</p>
              <p class="project__desc">${esc(p.description)}</p>
              <ul class="feature-list">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
              ${tags(p.technologies, "muted")}
              <div class="project__actions">
                ${action({ ...p.links.github, variant: "secondary", ic: BRAND.github })}
                ${action({ ...p.links.liveDemo, variant: "primary", ic: icon("externalLink") })}
                ${action({ ...p.links.demoVideo, variant: "secondary", ic: icon("playCircle") })}
              </div>
            </div>
          </div>

          <details class="case">
            <summary>
              <span><span class="case__title">Read the full case study</span><span class="case__sub">Problem, architecture, AI integration, testing, and what&rsquo;s next.</span></span>
              ${icon("chevronDown")}
            </summary>
            <div class="case__body">
              <ol class="case__list">${p.caseStudy.map((s, i) => `
                <li class="case__item">
                  <div class="case__meta"><span class="case__num">${String(i + 1).padStart(2, "0")}</span><h4 class="case__heading">${esc(s.heading)}</h4></div>
                  <div class="case__text">${s.body.map((b) => `<p>${esc(b)}</p>`).join("")}</div>
                </li>`).join("")}
              </ol>
            </div>
          </details>
        </article>`;
}

function aesaCard() {
  const a = aesa;
  const stages = a.pipeline.map((s) => `
                  <li>
                    <span class="icon-box">${icon(s.icon)}</span>
                    <div class="pipeline__body">
                      <p class="pipeline__label">${esc(s.label)}</p>
                      <p class="pipeline__detail">${esc(s.detail)}</p>
                      ${s.tools ? tags(s.tools) : ""}
                    </div>
                  </li>`).join("");
  return `
        <article ${rc("project project--aesa")} aria-labelledby="aesa-title">
          ${tags(a.categories, "accent")}
          <div class="project__grid">
            <div>
              <div class="project__id">
                <span class="icon-box">${icon("shield")}</span>
                <div>
                  <h3 class="project__title" id="aesa-title">${esc(a.title)}</h3>
                  <p class="project__tagline project__tagline--tight">${esc(a.fullName)}</p>
                </div>
              </div>
              <p class="project__summary">${esc(a.summary)}</p>
              <p class="project__desc project__desc--small">${esc(a.description)}</p>
              <div class="feature-groups">${a.featureGroups.map((g) => `
                <div><h4>${esc(g.group)}</h4><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}
              </div>
              ${tags(a.technologies, "muted")}
              <div class="project__actions">
                ${action({ ...a.links.github, variant: "primary", ic: BRAND.github })}
                ${action({ ...a.links.documentation, variant: "secondary", ic: icon("bookOpen") })}
                ${a.links.screenshots.href ? action({ ...a.links.screenshots, variant: "secondary", ic: icon("images") }) : ""}
              </div>
            </div>

            <div class="window" role="img" aria-label="Simplified AESA workflow: ${esc(a.pipeline.map((s) => s.label).join(", then "))}">
              <div class="window__bar" aria-hidden="true"><span class="window__dot"></span><span class="window__dot"></span><span class="window__dot"></span><span class="window__title">aesa — workflow</span></div>
              <ol class="pipeline" aria-hidden="true">${stages}
              </ol>
              <p class="pipeline__gate" aria-hidden="true"><span>$</span> security gate: block on failed checks</p>
            </div>
          </div>
        </article>`;
}

function smallProjectCards() {
  return `
        <div class="grid-auto">${smallProjects.map((p, i) => `
          <article ${rc("card card--pad mini", i)}>
            <div class="mini__top"><span class="tag tag--muted">${esc(p.category)}</span>${p.status === "In Progress" ? `<span class="tag tag--accent">In Progress</span>` : ""}</div>
            <h3 class="mini__title">${esc(p.title)}</h3>
            <p class="mini__desc">${esc(p.description)}</p>
            ${tags(p.technologies)}
            <div class="mini__link">${action({ href: p.github, label: "View on GitHub", variant: "link", ic: BRAND.github, extra: "" })}</div>
          </article>`).join("")}
        </div>`;
}

function projectsSection() {
  return section("projects", "~/projects", "Projects",
    "Two larger builds, an AI photo editor and an AI-assisted security agent, plus a few smaller cybersecurity exercises.",
    `${photosphere()}${aesaCard()}${smallProjectCards()}`);
}

function experienceSection() {
  return section("experience", "~/experience", "Experience", "", `
          <ol class="timeline">${experience.map((r, i) => `
            <li ${rc("card card--pad role", i)}>
              <div class="role__top"><h3 class="role__title">${esc(r.role)}</h3><span class="role__period">${esc(r.period)}</span></div>
              <p class="role__org">${esc(r.organisation)}</p>
              <p class="role__sum">${esc(r.summary)}</p>
              ${tags(r.highlights)}
            </li>`).join("")}
            <li class="note-dashed reveal" data-d="1">${esc(experienceNote)}</li>
          </ol>
          <p class="design-note reveal" data-d="2">${esc(graphicDesignNote)}</p>`);
}

function educationSection() {
  return section("education", "~/education", "Education", "", `
          <div class="grid-auto" style="--min:20rem">${education.map((e, i) => `
            <article ${rc("card card--pad edu", i)}>
              <span class="icon-box">${icon("gradCap")}</span>
              <div>
                <h3 class="edu__title">${esc(e.qualification)}</h3>
                <p class="edu__inst">${esc(e.institution)}</p>
                <p class="edu__status">${esc(e.status)}${e.detail ? ` &middot; <strong>${esc(e.detail)}</strong>` : ""}</p>
              </div>
            </article>`).join("")}
          </div>`);
}

function certificationsSection() {
  return section("certifications", "~/certifications", "Certifications", "", `
          <div class="grid-auto" style="--min:19rem">${certifications.map((c, i) => `
            <article ${rc("card card--pad cert", i % 3)}>
              <span class="icon-box">${icon("award")}</span>
              <div>
                <h3 class="cert__name">${esc(c.name)}</h3>
                <p class="cert__issuer">${esc(c.issuer)}</p>
                <span class="tag ${c.status === "Completed" ? "tag--accent" : "tag--warm"}">${esc(c.status)}</span>
              </div>
            </article>`).join("")}
          </div>`);
}

function servicesSection() {
  return section("services", "~/services", "What I can build", servicesNote, `
          <ul class="grid-auto" style="--min:17rem">${services.map((s, i) => `
            <li ${rc("service-item", i % 3)}><div class="card card--pad service">
              <h3 class="service__title">${esc(s.title)}</h3>
              <p class="service__desc">${esc(s.description)}</p>
            </div></li>`).join("")}
          </ul>`);
}

function contactSection() {
  const rows = [
    { label: "Email", value: site.email, href: `mailto:${site.email}`, ic: icon("mail"), ext: false },
    { label: "LinkedIn", value: "LinkedIn profile", href: site.social.linkedin, ic: BRAND.linkedin, ext: true },
    { label: "GitHub", value: "GitHub profile", href: site.social.github, ic: BRAND.github, ext: true },
  ];
  return section("contact", "~/contact", "Let's Build Something",
    "Looking for an internship, an entry-level role, or a small project built? Send a message and I'll get back to you.", `
          <ul class="grid-auto contact__list">${rows.map((r, i) => `
            <li ${rc("contact-row", i)}><a class="card contact__item" href="${esc(r.href)}"${r.ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>
              <span class="icon-box">${r.ic}</span>
              <span class="contact__text"><span class="contact__label">${r.label}</span><span class="contact__value">${esc(r.value)}</span></span>
            </a></li>`).join("")}
          </ul>`);
}

function footer(base) {
  return `
  <footer class="site-footer">
    <div class="container footer__inner">
      <div>
        <a class="footer__brand" href="${base}#home"><img src="${base}assets/img/avatar-128.webp" width="36" height="36" alt="" loading="lazy" decoding="async"><span class="footer__name">${esc(site.shortName)}</span></a>
        <p class="footer__copy">&copy; ${YEAR} ${esc(site.name)}. Built with HTML, CSS &amp; vanilla JavaScript.</p>
      </div>
      <div class="footer__links">
        <a href="${esc(site.social.github)}" target="_blank" rel="noopener noreferrer" aria-label="GitHub">${BRAND.github}</a>
        <a href="${esc(site.social.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">${BRAND.linkedin}</a>
        <a href="mailto:${esc(site.email)}" aria-label="Email">${icon("mail")}</a>
      </div>
    </div>
  </footer>`;
}

/* ------------------------------------------------------------------ page shell */
const THEME_SCRIPT = `document.documentElement.className=document.documentElement.className.replace("no-js","js");`;
const THEME_HASH = "sha256-" + createHash("sha256").update(THEME_SCRIPT).digest("base64");

function head({ base, css, title, description, canonical, robots = "index,follow", withSocial = true }) {
  const og = `${site.siteUrl}/assets/img/og-image.png`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Person", "@id": `${site.siteUrl}/#person`, name: site.name, jobTitle: site.role, description: site.metaDescription,
        url: `${site.siteUrl}/`, image: `${site.siteUrl}/assets/img/avatar-560.webp`, email: `mailto:${site.email}`,
        address: { "@type": "PostalAddress", addressCountry: "LK" },
        alumniOf: { "@type": "CollegeOrUniversity", name: "University of Bedfordshire" },
        sameAs: [site.social.github, site.social.linkedin] },
      { "@type": "WebSite", "@id": `${site.siteUrl}/#website`, url: `${site.siteUrl}/`, name: `${site.shortName} — Portfolio`, inLanguage: "en", publisher: { "@id": `${site.siteUrl}/#person` } },
    ],
  };
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
  <meta name="author" content="${esc(site.name)}">
  <meta name="theme-color" content="#11141D">
  <meta name="color-scheme" content="dark">
  ${canonical ? `<link rel="canonical" href="${canonical}">` : ""}
  ${withSocial ? `<meta name="keywords" content="${esc(site.keywords.join(", "))}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(site.shortName)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="en_US">
  <meta property="og:image" content="${og}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Shanuka B. Herath: Software &amp; AI Developer. Illustrated avatar on a deep navy background.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${og}">` : ""}
  <link rel="icon" href="${base}favicon.ico" sizes="48x48">
  <link rel="icon" type="image/png" sizes="32x32" href="${base}assets/img/icon-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="${base}assets/img/icon-192.png">
  <link rel="apple-touch-icon" href="${base}assets/img/apple-touch-icon.png">
  <link rel="manifest" href="${base}manifest.webmanifest">
  <link rel="preload" href="${base}assets/fonts/space-grotesk-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${base}assets/fonts/ibm-plex-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${base}assets/css/${css}">
  <script>${THEME_SCRIPT}</script>${withSocial ? `
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
</head>`;
}

function indexHtml(css, js) {
  return `<!doctype html>
<html lang="en" class="no-js">
${head({ base: "", css, title: site.seoTitle, description: site.metaDescription, canonical: `${site.siteUrl}/` })}
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>${header("")}
  <main id="main-content">${hero()}${aboutSection()}${skillsSection()}${projectsSection()}${experienceSection()}${educationSection()}${certificationsSection()}${servicesSection()}${contactSection()}
  </main>${footer("")}
  <script src="assets/js/${js}" defer></script>
</body>
</html>
`;
}

function notFoundHtml(css) {
  return `<!doctype html>
<html lang="en" class="no-js">
${head({ base: "/", css, title: `Page not found | ${site.shortName}`, description: "This page doesn't exist.", canonical: "", robots: "noindex", withSocial: false })}
<body>
  <main class="not-found">
    <div>
      <img src="/assets/img/avatar-128.webp" width="96" height="96" alt="Illustrated portrait of Shanuka B. Herath">
      <p class="not-found__code">404</p>
      <h1>This page doesn&rsquo;t exist</h1>
      <p>The link may be broken or the page may have moved. The portfolio home page has everything.</p>
      <a class="btn btn--primary" href="/">Back to the portfolio</a>
    </div>
  </main>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ build */
async function main() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(join(DIST, "assets", "css"), { recursive: true });
  mkdirSync(join(DIST, "assets", "js"), { recursive: true });

  // CSS + JS: minified, content-hashed filenames (safe to cache for a year)
  const cssSrc = readFileSync(join(SRC, "css", "styles.css"), "utf8");
  const jsSrc = readFileSync(join(SRC, "js", "main.js"), "utf8");
  const css = (await transform(cssSrc, { loader: "css", minify: true })).code;
  const js = (await transform(jsSrc, { loader: "js", minify: true, target: "es2017" })).code;
  const cssName = `styles.${hash(css)}.css`;
  const jsName = `main.${hash(js)}.js`;
  writeFileSync(join(DIST, "assets", "css", cssName), css);
  writeFileSync(join(DIST, "assets", "js", jsName), js);

  // Static assets
  cpSync(join(SRC, "assets", "fonts"), join(DIST, "assets", "fonts"), { recursive: true });
  cpSync(join(SRC, "assets", "img"), join(DIST, "assets", "img"), { recursive: true });
  cpSync(join(SRC, "assets", "cv"), join(DIST, "cv"), { recursive: true });
  cpSync(join(SRC, "favicon.ico"), join(DIST, "favicon.ico"));

  // Pages
  writeFileSync(join(DIST, "index.html"), indexHtml(cssName, jsName));
  writeFileSync(join(DIST, "404.html"), notFoundHtml(cssName));

  // SEO + PWA metadata
  writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}/sitemap.xml\n`);
  writeFileSync(join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${site.siteUrl}/</loc>\n    <lastmod>${ISO_DATE}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`);
  writeFileSync(join(DIST, "manifest.webmanifest"), JSON.stringify({
    name: `${site.name} — Portfolio`, short_name: site.shortName, start_url: "/", display: "browser",
    background_color: "#11141D", theme_color: "#11141D",
    icons: [
      { src: "assets/img/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "assets/img/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }, null, 2) + "\n");

  // Cloudflare Pages headers (security + caching)
  const csp = [
    "default-src 'self'",
    `script-src 'self' '${THEME_HASH}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  writeFileSync(join(DIST, "_headers"), `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Content-Security-Policy: ${csp}

/
  Cache-Control: public, max-age=0, must-revalidate

/assets/css/*
  Cache-Control: public, max-age=31536000, immutable

/assets/js/*
  Cache-Control: public, max-age=31536000, immutable

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/img/*
  Cache-Control: public, max-age=604800

/cv/*
  Cache-Control: public, max-age=86400
`);

  const count = (d) => readdirSync(d, { recursive: true }).length;
  console.log(`Built dist/ — ${count(DIST)} entries`);
  console.log(`  CSS ${(css.length / 1024).toFixed(1)} KB, JS ${(js.length / 1024).toFixed(1)} KB, index.html ${(readFileSync(join(DIST, "index.html")).length / 1024).toFixed(1)} KB`);
  if (!existsSync(join(SRC, "assets", "img", "og-image.png"))) console.warn("  ! src/assets/img/og-image.png is missing (run: npm run og)");
}

main().catch((e) => { console.error(e); process.exit(1); });

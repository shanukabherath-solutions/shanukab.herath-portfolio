# Shanuka B. Herath — Portfolio (static)

A lightweight, fully static rebuild of the Next.js portfolio. Plain **HTML + CSS + vanilla JavaScript**, no framework and no runtime server. Built for **Cloudflare Pages** and the domain **https://shanukab.herath.dev**.

```
content/profile.mjs      <- all your text, links and lists (edit this)
src/                     <- CSS, JS, fonts, images, CV, favicon
scripts/build.mjs        <- turns content + src into dist/
dist/                    <- PRODUCTION OUTPUT: upload / deploy this folder
tools/test-responsive.mjs<- browser checks (9 viewports, overflow, links, console)
```

`dist/` is committed so you can deploy it as-is, without installing anything.

---

## 1. Edit content

Everything lives in **`content/profile.mjs`** (the equivalent of `src/data/profile.ts` in the old project).

**Project links.** All project links are real URLs now. A link whose `href` is left empty (`""`) is simply not rendered; the site never shows "coming soon" placeholders.

| Where in `profile.mjs` | What it holds |
|---|---|
| `softwareReleases.items[]` | Software Releases section (Stofree): version, description, features, logo, download and GitHub links |
| `featuredProject.links` | Photosphere: GitHub, Live Demo, Demo Video |
| `aesaProject.links` | AESA: GitHub, Documentation |
| `moreProjects[]` | No Exit Online (`variant: "spotlight"`: wide card with pillars, links and an expandable details section), Q-Learning Agent, Healthcare Appointment System |
| `practiceProjects[]` | The three earlier cybersecurity exercises (no public repos, so no links) |
| `experience[]` | Freelance Software Developer (Fiverr profile link) and Graphic Designer |
| `certifications[]`, `certificationGroups[]` | Single credentials, the Microsoft group and the self-learning list |

**Check the links** with `npm run build && npm run check:links` (see below).

## 2. Build and preview

Requires Node 18+ (only for building; the output needs no Node).

```bash
npm install
npm run build        # writes dist/
npm run preview      # serves dist/ at http://localhost:4173 (with the same headers Cloudflare will send)
```

Optional checks (needs Playwright's Chromium: `npx playwright install chromium`):

```bash
npm run preview &                # in one terminal
npm run test:responsive          # checks 320 / 360 / 375 / 390 / 430 / 768 / 1024 / 1440 / 1920 px
```

It fails if any horizontal scroll appears, any text sits outside the viewport, any container clips content, a console error or failed request occurs, an image/anchor is broken, or reduced-motion / no-JS visitors can't see content. Screenshots go to `test-screenshots/`.

Link check: `npm run check:links` requests every external link in `dist/` and prints its status. GitHub answers **404 for private repositories** when you are not signed in, so a 404 there means "private or renamed". Fiverr, Vimeo and LinkedIn often return 403/429 to scripts even when the page is fine; open those in a browser.

Regenerating the social preview image after changing your name or role: `npm run og` (uses your original avatar from `tools/Avatar.original.png`).

## 3. Deploy to Cloudflare Pages

### Option A: Git integration (recommended; auto-deploys on every push)

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → choose the repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable (optional):** `NODE_VERSION` = `22`
4. **Save and Deploy.** You get a `https://<project>.pages.dev` preview URL.

### Option B: Direct upload (no Git, no build)

1. Dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Name the project, then drag in the **contents of the `dist/` folder** (so `index.html` is at the top level).
3. **Deploy site.** To update later, choose **Create new deployment** and upload `dist/` again.

Or from the command line: `npx wrangler pages deploy dist --project-name shanuka-portfolio`.

## 4. Connect `shanukab.herath.dev`

1. Open your Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `shanukab.herath.dev` and continue.
3. **If `herath.dev` is managed in Cloudflare DNS:** confirm the DNS record Cloudflare proposes (a proxied `CNAME` named `shanukab` pointing to `<project>.pages.dev`). The SSL certificate is issued automatically, usually within a few minutes.
4. **If DNS is hosted elsewhere:** add a `CNAME` record `shanukab` → `<project>.pages.dev` at your DNS provider, then use **Check DNS** in Cloudflare.

**Already used by the old Next.js site?** If `shanukab.herath.dev` currently points to the old Worker/Pages project, a hostname can only belong to one project. First remove it there (old project → **Custom domains** / **Domains & Routes** → remove), delete the old DNS record for that name if one remains, then add it to the new Pages project as above.

Check afterwards: `https://shanukab.herath.dev/` loads, refreshing works, `/robots.txt` and `/sitemap.xml` open, and an unknown path such as `/nope` shows the 404 page.

## 5. What gets deployed

| File | Purpose |
|---|---|
| `index.html` | The whole site (content is real HTML, no JS needed to read it) |
| `404.html` | Branded not-found page (Cloudflare serves it for unknown paths) |
| `assets/css/styles.<hash>.css`, `assets/js/main.<hash>.js` | Minified; hashed names, cached for a year |
| `assets/fonts/` | Space Grotesk, IBM Plex Sans/Mono (self-hosted, no Google Fonts request) |
| `assets/img/` | Optimised avatar sizes, favicons, Open Graph image, Photosphere before/after |
| `cv/shanuka-herath-cv.pdf` | Your CV (same file as the old site) |
| `robots.txt`, `sitemap.xml`, `manifest.webmanifest` | SEO / metadata |
| `_headers` | Cloudflare security and caching headers |

**Note on `_headers`:** it includes a strict Content-Security-Policy (no third-party scripts, fonts or images allowed). If you later turn on Cloudflare Web Analytics or add an external script/embed, add its host to the relevant directive in `scripts/build.mjs` (the `csp` array) and rebuild.

## 6. Summary of changes from the Next.js version

**Mobile clipping bug: cause and fix**

- *Cause:* on phones the hero grid had no explicit column template, so its single column sized itself to the widest content inside it, the non-wrapping `profile.json` code block (about 424px). That stretched the text column to 434px on every phone, and the hero section's `overflow-hidden` hid everything past the screen edge: the end of the role line and the right side of the description were cut off.
  (Reproduced in the original at 320–430px: heading/description right edge at x=454 on screens 320–430px wide.)
- *Fix:* the hero grid uses `minmax(0, 1fr)` tracks with `min-width: 0` on every grid item, so content can never widen the layout; the code block's lines now wrap with `overflow-wrap: anywhere` instead of scrolling; text uses `clamp()` sizing with `text-wrap: balance/pretty`; no text container has a fixed height; nothing is "fixed" by hiding overflow.
- *Elsewhere:* grids use `repeat(auto-fit, minmax(min(100%, X), 1fr))`, tags/links can wrap, the nav collapses to a menu below 1024px (7 links plus the CV button don't fit at tablet widths), buttons keep 44px touch targets.

**Brand and design**

- Your real avatar is used everywhere (header, large in the hero, footer, favicon, apple-touch icon, JSON-LD, Open Graph image), only resized and compressed (2000px/1.3 MB → 25 KB at hero size), never redrawn.
- Palette: sky `#63B7DB` (links, buttons, active nav, section paths), navy `#11141D` (background), charcoal `#363A46` (cards, at partial opacity), peach `#E9987B` (code strings, dates, "In Progress"), off-white `#F5F6F8` (text). The old blue/purple/cyan gradients were replaced.
- Layout, sections, wording and the terminal/`profile.json` identity are preserved. Animations (hero entrance, scroll reveals, blinking caret) are kept, CSS/IntersectionObserver only, and switch off for `prefers-reduced-motion`.

**Content accuracy**

- The About text no longer says "final-year"; it now says you completed your BSc (Hons) at the University of Bedfordshire with a Second Class Upper Division. The Education card shows "Completed · Second Class Upper Division". Nothing claims a certificate has been issued.
- Fixed a typo in the old data (`"LFS162)"` → `LFS162`). Everything else is carried over unchanged.

**Removed (static hosting):** Next.js, React, Framer Motion, Tailwind, `lucide-react` (icons are now inline SVG), and the unused `/api/contact` route.

**Added:** self-hosted fonts, `404.html`, sitemap, robots, manifest, Open Graph/Twitter tags, JSON-LD, skip link, scroll-spy nav, keyboard-accessible menu (Esc closes), no-JS fallback, `_headers`.

## 7. Content update (project links, experience, certifications)

- **Name and headline:** the name always stays on one line (its font size is derived from its column width with CSS container units, capped at 4.25rem). The headline *Computer Science Graduate | Software & AI Developer* is shown on one line, with a spaced sky-blue `|`, whenever its column is at least 29rem (about 464px) wide, which is tablets and up. On phones, one line would need text smaller than 13px, so the two halves stack and the separator is hidden.
- **Projects:** Photosphere and AESA stay featured with their real links (new tab, accessible labels). New cards: No Exit Online, Q-Learning Agent, Healthcare Appointment System, plus a jump index above the cards. The three earlier cybersecurity exercises are kept in their own group (they have no public repos, so they show no link button). Descriptions come from each repository's README; AESA's card was brought in line with its README.
- **No Exit Online:** now a wide card at the top of *More projects* titled "No Exit Online - Browser-Based Game & Security Engineering". It carries the short description, two equal pillars (Game development in sky blue, Security engineering in peach), prominent Live Demo and View on GitHub buttons (new tab), and a "Read the project details" expander with the full description, technologies and project focus. All text is taken from the supplied project description; nothing was added.
- **Experience:** the placeholder sentence is removed; *Freelance Software Developer* via Fiverr is added, with the Fiverr link.
- **Certifications:** Burp Suite is now Completed; *Future in Quality Assurance* (SLIIT City UNI) added; CAISR renamed to *Certified Artificial Intelligence Security & Risk (CAISR)* with issuer *Red Team Leaders*; nine Microsoft credentials grouped under one issuer card; *Other self-learning* lists two items with no issuer or status claimed.

## 8. Interactive physics scene (drag and throw)

The illustration next to your avatar is assembled from the seven separate PNGs you supplied (`tools/scene-source/`), each as its own `<img>`, in exactly their positions from `Friends.png`.

- **Placement:** on desktop (64em and up) it sits in the button row directly after *Contact Me*, on the same baseline, and takes whatever width is left, so it shrinks by itself when space is tight. On phones and tablets it sits on the avatar's row, immediately to its right.
- **Assets:** `tools/make-scene-assets.py` trims only the fully transparent padding of each layer (no visible pixel changes), writes `src/assets/img/scene/*.png` plus `manifest.json` (positions and stacking order), and checks that re-compositing them reproduces `Friends.png` (max difference 1/255). Re-run it with `python3 tools/make-scene-assets.py` if you change the source layers. Original, untrimmed files stay in `tools/scene-source/`.
- **Responsive:** objects are placed in percentages of a fixed scene window, so the composition scales as one piece; the physics runs in the original canvas coordinates, so it behaves the same at any size.
- **Interaction** (`src/js/main.js`, vanilla JS, no dependencies): Pointer Events with pointer capture for mouse, pen and touch; several objects can be held at once (two fingers). Grabbing follows the visible shape (per-pixel alpha), so you pick up the object you actually touched. Release speed is measured over the last ~100 ms; if you pause before letting go, the object is just dropped. Motion uses `requestAnimationFrame` with gravity, air drag, floor friction and bouncing off the scene edges; objects always stay inside the scene, and the loop stops when everything is at rest.
- **Avatar:** fixed. It has no transform, never captures touch scrolling (`touch-action: pan-y`) and pressing on it does nothing. Other objects pass behind or in front of it by stacking order and never move it.
- **Touch:** movable objects use `touch-action: none` so dragging them never scrolls the page; everywhere else (including the avatar) the page scrolls normally.
- **Reset:** a small reset button appears once something has been moved (keyboard accessible).
- **Reduced motion:** objects still follow the pointer, but do not glide, fall or bounce after release, and the reset snaps instead of easing.
- **Tuning:** the physics constants are at the top of the scene section in `src/js/main.js` (`GRAVITY`, `AIR`, `FLOOR_FRICTION`, `WALL_BOUNCE`, `FLOOR_BOUNCE`, `MAX_SPEED`).

This replaces the earlier 3D-tilt cover image.

## 9. Software Releases section

`#software-releases` sits directly after Projects and has its own nav link ("Releases"). It renders one product card per entry in `softwareReleases.items` (`content/profile.mjs`), so adding another release is one more object in that array: no build-script or CSS change.

- **Stofree** is the first entry. Its logo is the supplied artwork, only resized (`src/assets/img/stofree-logo-256/512/1024.webp`; the untouched original is `tools/Stofree.original.png`). It is shown on a white tile because the wordmark is dark and would vanish on the navy page.
- **Download for Windows** points at the real installer asset of the GitHub release `v1.0.0` (`Stofree-Windows-10-11-x64-Setup.exe`, 35.1 MB). The link is pinned to that tag so it always matches the version shown on the card. **View on GitHub** links to the repository. Both open in a new tab with `rel="noopener noreferrer"`.
- **Shipping a new version:** change `version`, `released`, the `size` text and the release URLs in the entry together, then `npm run build`. Release assets used here: the installer and `SHA256SUMS.txt` (shown as the "SHA-256 checksums" link).
- The release is also described to search engines as a `SoftwareApplication` in the page's JSON-LD (generated from the same entry).
- **Layout:** phones show logo, name and version, description, features, buttons, then the spec rows; tablets put the logo beside the spec rows; desktop uses a fixed aside column. Styles are the `.release*` rules in `src/css/styles.css`.
- The nav gets slightly tighter spacing between 64em and 75em so eight links plus the CV button still fit on one line.

## Licences

Fonts: Space Grotesk and IBM Plex (SIL OFL, licence files in `src/assets/fonts/`). Icons: Lucide (ISC), GitHub/LinkedIn marks from Simple Icons.

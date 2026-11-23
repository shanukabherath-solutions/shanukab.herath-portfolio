(function () {
  "use strict";

  var root = document.documentElement;
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (!header) return;

  /* ---- Header gets a solid background once the page scrolls ---- */
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- Mobile / tablet menu ---- */
  function setMenu(open) {
    if (!toggle) return;
    header.classList.toggle("is-open", open);
    root.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (toggle.getAttribute("aria-expanded") === "true" && !header.contains(e.target)) setMenu(false);
    });
    var desktop = window.matchMedia("(min-width: 64em)");
    var onChange = function () { if (desktop.matches) setMenu(false); };
    if (desktop.addEventListener) desktop.addEventListener("change", onChange);
    else if (desktop.addListener) desktop.addListener(onChange);
  }

  /* ---- Highlight the nav link of the section in view ---- */
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link[href^='#']"));
  var targets = links
    .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
    .filter(Boolean);

  function setActive(id) {
    links.forEach(function (a) {
      var on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  if ("IntersectionObserver" in window && targets.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* ---- Reveal on scroll (CSS only hides .reveal when JS is on and motion is allowed) ---- */
  var items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }
  var io = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  items.forEach(function (el) { io.observe(el); });
})();

/* ---- Interactive physics scene (Pointer Events + requestAnimationFrame) -------------------------
   Objects are separate <img> elements positioned in the coordinate space of the original Friends.png
   composition (scene units), so the same physics runs at any display size; rendering is a CSS translate.
   - drag with mouse or finger (pointer capture), release to throw: velocity comes from the last ~100 ms
   - air drag, floor friction, gravity, bouncing off the scene edges; objects always stay inside the scene
   - the avatar (data-fixed) is never moved; pressing on it does nothing
   - "reduce motion": objects follow the pointer but do not glide, fall or bounce after release */
(function () {
  "use strict";
  var scenes = document.querySelectorAll("[data-scene]");
  if (!scenes.length || !window.PointerEvent) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  var GRAVITY = 1500;        // scene units / s^2 (the scene is 396 units tall)
  var AIR = 1.15;            // air drag, 1/s
  var FLOOR_FRICTION = 3.2;  // extra drag while sliding along the floor, 1/s
  var WALL_BOUNCE = 0.62;    // energy kept when hitting a side wall or the ceiling
  var FLOOR_BOUNCE = 0.5;    // energy kept when hitting the floor
  var MIN_SPEED = 14;        // slower than this on the floor = at rest
  var MAX_SPEED = 4200;      // throw speed limit, units / s
  var SAMPLE_MS = 100;       // window used for the release velocity
  var STALE_MS = 80;         // pointer paused this long before release = just drop it
  var GRAB_PAD = 12;         // css px of forgiveness when grabbing small objects
  var HOME_RATE = 14;        // reset easing speed, 1/s

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  Array.prototype.forEach.call(scenes, setup);

  function setup(root) {
    var stage = root.querySelector(".scene__stage");
    var resetBtn = root.querySelector(".scene__reset");
    var W = +root.getAttribute("data-w"), H = +root.getAttribute("data-h");
    var bodies = [], active = false, scale = 1, raf = 0, last = 0, zTop = 100;
    var drags = {};                                   // pointerId -> { b, ox, oy, s: samples }

    function measure() { scale = stage.clientWidth / W; }

    function activate() {
      if (active || !stage.clientWidth) return;
      active = true;
      Array.prototype.forEach.call(stage.querySelectorAll(".sprite"), function (el) {
        var b = {
          el: el, name: el.getAttribute("data-name"), fixed: el.hasAttribute("data-fixed"),
          w: +el.getAttribute("data-w"), h: +el.getAttribute("data-h"),
          hx: +el.getAttribute("data-x"), hy: +el.getAttribute("data-y"), z0: +el.getAttribute("data-z"),
          g: +el.getAttribute("data-gravity"), mask: null,
          x: 0, y: 0, vx: 0, vy: 0, awake: false, homing: false, drag: null, lift: false
        };
        b.x = b.hx; b.y = b.hy; b.z = b.z0;
        readMask(b);
        bodies.push(b);
      });
      measure();
    }

    // Per-pixel alpha of each sprite, so grabbing follows the visible shape, not the image rectangle.
    function readMask(b) {
      function go() {
        try {
          var c = document.createElement("canvas"); c.width = b.w; c.height = b.h;
          var g = c.getContext("2d", { willReadFrequently: true });
          g.drawImage(b.el, 0, 0, b.w, b.h);
          var d = g.getImageData(0, 0, b.w, b.h).data, m = new Uint8Array(b.w * b.h);
          for (var i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
          b.mask = m;
        } catch (err) { b.mask = null; }              // falls back to rectangle hit-testing
      }
      if (b.el.complete && b.el.naturalWidth) go(); else b.el.addEventListener("load", go, { once: true });
    }

    function alphaAt(b, x, y) {
      var lx = Math.floor(x - b.x), ly = Math.floor(y - b.y);
      if (lx < 0 || ly < 0 || lx >= b.w || ly >= b.h) return 0;
      return b.mask ? b.mask[ly * b.w + lx] : 255;
    }

    // Topmost object whose visible pixel is under (x, y). The avatar counts as an obstacle: it returns null.
    function pick(x, y) {
      var order = bodies.slice().sort(function (a, c) { return c.z - a.z; }), i, j, k;
      for (i = 0; i < order.length; i++) if (alphaAt(order[i], x, y) > 24) return order[i].fixed ? null : order[i];
      var pad = GRAB_PAD / scale, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
      for (i = 0; i < order.length; i++) {
        if (order[i].fixed) continue;
        for (j = 1; j <= 2; j++) for (k = 0; k < dirs.length; k++) {
          if (alphaAt(order[i], x + dirs[k][0] * pad * j / 2, y + dirs[k][1] * pad * j / 2) > 24) return order[i];
        }
      }
      return null;
    }

    function toScene(e) {
      var r = stage.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
    }

    function render(b) {
      b.el.style.transform = "translate3d(" + ((b.x - b.hx) * scale).toFixed(2) + "px," + ((b.y - b.hy) * scale).toFixed(2) + "px,0)" + (b.lift ? " scale(1.04)" : "");
    }

    function updateReset() {
      var moved = false;
      for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        if (!b.fixed && (Math.abs(b.x - b.hx) > 1 || Math.abs(b.y - b.hy) > 1)) { moved = true; break; }
      }
      if (resetBtn && resetBtn.hidden === moved) resetBtn.hidden = !moved;
    }

    // ---- simulation -----------------------------------------------------------------------------
    function kick() {
      if (raf) return;
      last = performance.now();
      root.setAttribute("data-sim", "1");
      raf = requestAnimationFrame(frame);
    }

    function step(b, dt) {
      var n = Math.max(1, Math.ceil(dt * 120)), h = dt / n, mx = W - b.w, my = H - b.h;
      for (var i = 0; i < n; i++) {
        b.vy += GRAVITY * b.g * h;
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * WALL_BOUNCE; }
        else if (b.x > mx) { b.x = mx; b.vx = -Math.abs(b.vx) * WALL_BOUNCE; }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * WALL_BOUNCE; }
        else if (b.y >= my) {
          b.y = my;
          if (b.vy > 0) { b.vy = -b.vy * FLOOR_BOUNCE; if (-b.vy < 40) b.vy = 0; }
        }
        var k = Math.exp(-AIR * h); b.vx *= k; b.vy *= k;
        if (b.y >= my - 0.01) b.vx *= Math.exp(-FLOOR_FRICTION * h);
      }
      if (Math.hypot(b.vx, b.vy) < MIN_SPEED && b.y >= my - 0.01) { b.vx = 0; b.vy = 0; b.awake = false; }
    }

    function frame(now) {
      var dt = Math.min((now - last) / 1000, 1 / 30), busy = false;
      last = now;
      for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        if (b.fixed || b.drag !== null) continue;
        if (b.homing) {
          var k = 1 - Math.exp(-HOME_RATE * dt);
          b.x += (b.hx - b.x) * k; b.y += (b.hy - b.y) * k;
          if (Math.abs(b.hx - b.x) < 0.3 && Math.abs(b.hy - b.y) < 0.3) { b.x = b.hx; b.y = b.hy; b.homing = false; settleZ(b); }
          render(b); busy = busy || b.homing;
        } else if (b.awake) {
          step(b, dt); render(b); busy = busy || b.awake;
        }
      }
      updateReset();
      if (busy) raf = requestAnimationFrame(frame);
      else { raf = 0; root.removeAttribute("data-sim"); }
    }

    function settleZ(b) { b.z = b.z0; b.el.style.zIndex = String(b.z0 + 1); }

    function resetAll() {
      Object.keys(drags).forEach(function (id) { var d = drags[id]; d.b.drag = null; d.b.lift = false; d.b.el.classList.remove("is-dragging"); delete drags[id]; });
      stage.classList.remove("is-grabbing");
      bodies.forEach(function (b) {
        if (b.fixed) return;
        b.vx = 0; b.vy = 0; b.awake = false; b.lift = false;
        if (reduce.matches) { b.x = b.hx; b.y = b.hy; b.homing = false; settleZ(b); render(b); }
        else b.homing = true;
      });
      zTop = 100; updateReset(); kick();
    }

    // ---- pointer input --------------------------------------------------------------------------
    stage.addEventListener("pointerdown", function (e) {
      if (!active || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (e.target.closest && e.target.closest(".scene__reset")) return;
      var p = toScene(e), b = pick(p.x, p.y);
      if (!b) return;                                  // empty space or the avatar: do nothing
      e.preventDefault();
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      b.drag = e.pointerId; b.vx = 0; b.vy = 0; b.awake = false; b.homing = false; b.lift = true;
      b.z = ++zTop; b.el.style.zIndex = String(b.z); b.el.classList.add("is-dragging");
      drags[e.pointerId] = { b: b, ox: p.x - b.x, oy: p.y - b.y, s: [{ t: e.timeStamp, x: b.x, y: b.y }] };
      stage.classList.add("is-grabbing"); root.classList.add("has-interacted");
      render(b);
    });

    stage.addEventListener("pointermove", function (e) {
      var d = drags[e.pointerId];
      if (!d) {                                        // hover feedback for mouse users
        if (e.pointerType === "mouse" && active) { var q = toScene(e); stage.classList.toggle("is-over", !!pick(q.x, q.y)); }
        return;
      }
      var p = toScene(e), b = d.b, wx = p.x - d.ox, wy = p.y - d.oy;
      b.x = clamp(wx, 0, W - b.w);
      b.y = clamp(wy, 0, H - b.h);
      // velocity is measured from where the pointer wants the object (unclamped), so a hard flick
      // into a wall still bounces instead of reading as "stopped at the wall"
      d.s.push({ t: e.timeStamp, x: wx, y: wy });
      while (d.s.length > 2 && e.timeStamp - d.s[0].t > SAMPLE_MS) d.s.shift();
      render(b); updateReset();
    });

    function release(e, cancelled) {
      var d = drags[e.pointerId];
      if (!d) return;
      delete drags[e.pointerId];
      var b = d.b, s = d.s, vx = 0, vy = 0;
      b.drag = null; b.lift = false; b.el.classList.remove("is-dragging");
      if (!Object.keys(drags).length) stage.classList.remove("is-grabbing");
      if (!cancelled && !reduce.matches && s.length > 1) {
        var a = s[0], z = s[s.length - 1], dtm = z.t - a.t;
        if (e.timeStamp - z.t <= STALE_MS && dtm >= 10) {
          vx = (z.x - a.x) / (dtm / 1000); vy = (z.y - a.y) / (dtm / 1000);
          var sp = Math.hypot(vx, vy);
          if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp; }
        }
      }
      b.vx = vx; b.vy = vy; b.awake = !reduce.matches;
      render(b); updateReset(); kick();
    }
    stage.addEventListener("pointerup", function (e) { release(e, false); });
    stage.addEventListener("pointercancel", function (e) { release(e, true); });
    stage.addEventListener("lostpointercapture", function (e) { release(e, true); });
    stage.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") stage.classList.remove("is-over"); });

    if (resetBtn) resetBtn.addEventListener("click", resetAll);

    // keep everything proportional when the layout changes size; start once the scene is visible
    function onResize() { activate(); if (active) { measure(); bodies.forEach(render); } }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);
    else window.addEventListener("resize", onResize);
    onResize();

    function onMotionChange() {
      if (!reduce.matches) return;
      bodies.forEach(function (b) { b.vx = 0; b.vy = 0; b.awake = false; });
    }
    if (reduce.addEventListener) reduce.addEventListener("change", onMotionChange);
    else if (reduce.addListener) reduce.addListener(onMotionChange);
  }
})();

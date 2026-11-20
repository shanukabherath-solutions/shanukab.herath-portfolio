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

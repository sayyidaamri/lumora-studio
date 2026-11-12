// LUMØRA — site behaviour (vanilla JS, no framework, no modules — works from file:// too).
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const map = (v, a, b) => clamp((v - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const vw = () => innerWidth, vh = () => innerHeight;

/* ---------------- smooth scroll (wheel → eased window scroll) ---------------- */
const scroller = { y: scrollY, target: scrollY, active: false, locked: false };
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
if (fine && !reduced) {
  addEventListener("wheel", (e) => {
    if (scroller.locked || e.ctrlKey || e.target.closest("[data-native-wheel]")) return;
    e.preventDefault();
    if (!scroller.active) scroller.y = scroller.target = scrollY;
    scroller.target = clamp(scroller.target + e.deltaY * (e.deltaMode === 1 ? 40 : 1), 0, maxScroll());
    scroller.active = true;
  }, { passive: false });
}
addEventListener("scroll", () => { if (!scroller.active) scroller.y = scroller.target = scrollY; }, { passive: true });
window.lenis = { scrollTo(y, o = {}) { scroller.target = scroller.y = clamp(y, 0, maxScroll()); scroller.active = false; window.scrollTo(0, scroller.target); } };

/* ---------------- frame loop ---------------- */
const tickers = new Set();
const onFrame = (fn) => tickers.add(fn);
let last = performance.now();
function loop(now) {
  const dt = Math.min(64, now - last); last = now;
  if (scroller.active) {
    scroller.y = lerp(scroller.y, scroller.target, 1 - Math.pow(1 - 0.1, dt / 16.7));
    if (Math.abs(scroller.target - scroller.y) < 0.4) { scroller.y = scroller.target; scroller.active = false; }
    window.scrollTo(0, scroller.y);
  }
  for (const fn of tickers) fn(now, dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/** progress of an element scrolling through: 0 when its top hits the viewport top, 1 when its bottom hits the viewport bottom. */
const stickyProgress = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - vh())); };

/* ---------------- text helpers ---------------- */
function splitChars(root, cls = "c") {
  const out = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const ch of n.textContent) { const s = document.createElement("span"); s.className = cls; s.textContent = ch; frag.appendChild(s); out.push(s); }
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    }
  };
  walk(root);
  return out;
}
function splitWords(root) {
  const out = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(" ")); return; }
          const s = document.createElement("span"); s.className = "w"; s.textContent = w; frag.appendChild(s); out.push(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains("indent") && n.tagName !== "BR") walk(n);
    }
  };
  walk(root);
  return out;
}

/* reveal on view */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.dispatchEvent(new CustomEvent("inview")); e.target.classList.add("is-in"); io.unobserve(e.target); }
}, { threshold: 0.15, rootMargin: "0px 0px -5% 0px" });
const watch = (el, fn) => { if (fn) el.addEventListener("inview", fn, { once: true }); io.observe(el); };

/* scramble headings */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+/<>";
function scramble(el) {
  const chars = splitChars(el);
  const final = chars.map((c) => c.textContent);
  chars.forEach((c) => { if (c.textContent.trim()) c.style.opacity = 0; });
  watch(el, () => {
    if (reduced) { chars.forEach((c) => (c.style.opacity = 1)); return; }
    const start = performance.now(), dur = 700 + Math.min(chars.length, 60) * 16;
    const step = (now) => {
      const t = (now - start) / dur;
      chars.forEach((c, i) => {
        if (!final[i].trim()) return;
        const local = (t - (i / chars.length) * 0.72) / 0.28;
        if (local <= 0) { c.style.opacity = 0; return; }
        c.style.opacity = 1;
        if (local >= 1) { c.textContent = final[i]; c.classList.remove("hot"); }
        else { c.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0]; c.classList.add("hot"); }
      });
      if (t < 1.05) requestAnimationFrame(step); else chars.forEach((c, i) => { c.textContent = final[i]; c.classList.remove("hot"); c.style.opacity = 1; });
    };
    requestAnimationFrame(step);
  });
}
$$("[data-scramble]").forEach((el) => { el.classList.add("scramble"); scramble(el); });

/* typed mono paragraphs */
$$("[data-typed]").forEach((el) => {
  const chars = splitChars($(".ink", el), "t");
  watch(el, () => {
    if (reduced) { chars.forEach((c) => c.classList.add("on")); return; }
    let i = 0; const delay = el.closest(".hero-wrap, .phero") ? 1100 : 0;
    setTimeout(() => { const id = setInterval(() => { for (let k = 0; k < 3 && i < chars.length; k++) chars[i++].classList.add("on"); if (i >= chars.length) clearInterval(id); }, 16); }, delay);
  });
});

/* scroll-driven word colouring */
$$("[data-words]").forEach((el) => {
  const words = splitWords(el);
  el.classList.add("reveal-words");
  onFrame(() => {
    const r = el.getBoundingClientRect();
    if (r.bottom < -50 || r.top > vh() + 50) return;
    const p = map(vh() * 0.88 - r.top, 0, r.height + vh() * 0.35);
    const n = p * (words.length + 2);
    words.forEach((w, i) => { w.classList.toggle("on", i < n - 1); w.classList.toggle("hot", i >= n - 2 && i < n - 1 && p < 1); });
  });
});

$$(".fade-up, .line, .proj, .hero-h1, .phero .hero-h1, .art-head h1").forEach((el) => watch(el));

/* ---------------- page transitions ---------------- */
const pt = $("[data-pt]");
function revealPage() {
  if (!pt) return;
  pt.classList.remove("cover", "from-bottom");
  pt.classList.add("out");
}
const ready = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1800))]);
ready.then(() => setTimeout(() => { revealPage(); startIntro(); }, document.body.classList.contains("home") ? 150 : 350));
addEventListener("pageshow", (e) => { if (e.persisted) revealPage(); });
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.hash && url.pathname === location.pathname) return;
  if (a.hasAttribute("download") || /^mailto:|^tel:/.test(a.getAttribute("href"))) return;
  e.preventDefault();
  if (url.pathname === location.pathname) { closeMenu(); window.lenis.scrollTo(0); return; }
  pt.classList.remove("out"); pt.classList.add("from-bottom");
  void pt.offsetWidth;
  pt.classList.remove("from-bottom"); pt.classList.add("cover");
  setTimeout(() => (location.href = url.href), reduced ? 0 : 820);
});
$$("[data-top]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); scroller.target = 0; scroller.y = scrollY; scroller.active = true; if (!fine) scrollTo({ top: 0, behavior: "smooth" }); }));

/* ---------------- intro (home) ---------------- */
if (document.body.classList.contains("home")) document.body.classList.add("is-loading");
function startIntro() {
  const mark = $(".intro-mark");
  if (mark) {
    $$(".ch > span", mark).forEach((s, i) => (s.style.transitionDelay = `${i * 110}ms`));
    requestAnimationFrame(() => document.body.classList.remove("is-loading"));
  }
}

/* ---------------- header ---------------- */
const hdr = $("[data-hdr]");
if (hdr?.dataset.hdr === "home") {
  const target = $(".projects");
  const intro = $(".intro");
  onFrame(() => { hdr.classList.toggle("compact", target.getBoundingClientRect().top < vh() * 0.6); hdr.classList.toggle("pre", scrollY < intro.offsetHeight * 0.45 && !menu.classList.contains("is-open")); });
}

/* ---------------- menu ---------------- */
const menu = $("[data-menu]"), menuBtn = $("[data-menu-btn]");
function setMenuLabel(t) { const r = $(".mlabel", menuBtn); r.innerHTML = `<span class="roll"><span>${t}</span><span aria-hidden="true">${t}</span></span>`; }
function openMenu() {
  menu.classList.remove("is-closing"); menu.classList.add("is-open"); menu.setAttribute("aria-hidden", "false");
  menuBtn.setAttribute("aria-expanded", "true"); setMenuLabel("CLOSE X"); document.body.classList.add("is-locked"); scroller.locked = true;
}
function closeMenu() {
  if (!menu.classList.contains("is-open")) return;
  menu.classList.remove("is-open"); menu.classList.add("is-closing"); menu.setAttribute("aria-hidden", "true");
  menuBtn.setAttribute("aria-expanded", "false"); setMenuLabel("MENU"); document.body.classList.remove("is-locked"); scroller.locked = false;
  setTimeout(() => menu.classList.remove("is-closing"), 900);
}
menuBtn?.addEventListener("click", () => (menu.classList.contains("is-open") ? closeMenu() : openMenu()));
addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

/* ---------------- newsletter (demo only, nothing is sent) ---------------- */
$$("[data-news]").forEach((f) => f.addEventListener("submit", (e) => {
  e.preventDefault();
  const inp = $("input", f), ok = f.parentElement.querySelector(".ok");
  ok.textContent = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inp.value) ? "Thanks — you're on the list (demo)." : "Please enter a valid email.";
  ok.style.color = ok.textContent.startsWith("Thanks") ? "" : "var(--pink)";
}));

/* ---------------- cookie card ---------------- */
const ck = $("[data-cookie]");
let ckSeen = false; try { ckSeen = !!localStorage.getItem("lumora-cookie"); } catch {}
if (ck && !ckSeen) {
  setTimeout(() => { ck.hidden = false; requestAnimationFrame(() => ck.classList.add("is-in")); }, 2600);
  const done = (v) => { try { localStorage.setItem("lumora-cookie", v); } catch {} ck.classList.remove("is-in"); setTimeout(() => (ck.hidden = true), 800); };
  $("[data-cookie-yes]", ck).addEventListener("click", () => done("yes"));
  $("[data-cookie-no]", ck).addEventListener("click", () => done("no"));
}

/* ---------------- cursor label ---------------- */
const cur = $("[data-cursor]");
if (cur && fine) {
  const m = { x: -100, y: -100, cx: -100, cy: -100 };
  addEventListener("pointermove", (e) => { m.x = e.clientX; m.y = e.clientY; cur.classList.toggle("is-on", !!e.target.closest?.(".proj, .work-item.is-active, .more-proj .grid a")); });
  onFrame(() => { m.cx = lerp(m.cx, m.x, 0.25); m.cy = lerp(m.cy, m.y, 0.25); cur.style.transform = `translate(${m.cx + 14}px, ${m.cy + 14}px)`; });
}

/* ---------------- parallax images ---------------- */
$$("[data-parallax] img").forEach((img) => onFrame(() => {
  const r = img.parentElement.getBoundingClientRect();
  if (r.bottom < 0 || r.top > vh()) return;
  const p = (r.top + r.height / 2 - vh() / 2) / vh();
  img.style.transform = `translate3d(0, ${(-10 + p * 10).toFixed(2)}%, 0)`;
}));

/* ================= HOME: reel ================= */
const reelCanvas = $("[data-reel]");
if (reelCanvas) {
  const cfg = JSON.parse(reelCanvas.dataset.reel);
  const ctx = reelCanvas.getContext("2d");
  const wrap = $("[data-hero]"), heroText = $(".hero-text"), hint = $(".scroll-hint"), playBtn = $("[data-reel-play]");
  const imgs = cfg.images.map((src) => { const i = new Image(); i.src = src; return i; });
  const COLS = 7, ROWS = 4;
  const rnd = (s) => { const x = Math.sin(s * 99.13) * 43758.5453; return x - Math.floor(x); };
  const tiles = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    tiles.push({ c, r, sx: 0.06 + rnd(i + 1) * 0.86, sy: 0.38 + rnd(i + 7) * 0.58, s0: 0.28 + rnd(i + 3) * 0.32, delay: rnd(i + 11), blur: rnd(i + 5) > 0.55 ? 7 : 0, z: rnd(i + 13) });
  }
  tiles.sort((a, b) => a.z - b.z);
  let W = 0, H = 0, dpr = 1, frame = 0, playing = true, lastSwap = 0;
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = reelCanvas.clientWidth; H = reelCanvas.clientHeight; reelCanvas.width = W * dpr; reelCanvas.height = H * dpr; };
  resize(); addEventListener("resize", resize);
  playBtn.addEventListener("click", () => { playing = !playing; playBtn.setAttribute("aria-label", playing ? "Pause reel" : "Play reel"); });
  // offscreen "video frame": image cover-fitted + overlay
  const off = document.createElement("canvas"), octx = off.getContext("2d");
  function paintFrame(rw, rh) {
    off.width = Math.max(2, Math.round(rw * dpr)); off.height = Math.max(2, Math.round(rh * dpr));
    const img = imgs[frame % imgs.length];
    octx.fillStyle = "#1a1a1a"; octx.fillRect(0, 0, off.width, off.height);
    if (img.complete && img.naturalWidth) {
      const s = Math.max(off.width / img.naturalWidth, off.height / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      octx.drawImage(img, (off.width - w) / 2, (off.height - h) / 2, w, h);
    }
    if (frame % imgs.length === 0) {
      const u = off.width / 1000;
      octx.fillStyle = "#fff"; octx.textBaseline = "middle"; octx.textAlign = "center";
      octx.font = `300 ${78 * u}px Sora, sans-serif`;
      if (octx.letterSpacing !== undefined) octx.letterSpacing = `${4 * u}px`;
      octx.fillText(cfg.mark, off.width / 2, off.height * 0.5);
      if (octx.letterSpacing !== undefined) octx.letterSpacing = "0px";
      octx.textAlign = "left"; octx.font = `300 ${15 * u}px Sora, sans-serif`;
      cfg.lines.forEach((l, i) => octx.fillText(l, off.width * 0.1, off.height * 0.33 + i * 18 * u));
      octx.font = `300 ${11 * u}px Sora, sans-serif`;
      cfg.side.forEach((l, i) => octx.fillText(l, off.width * 0.75, off.height * 0.64 + i * 13 * u));
    }
  }
  onFrame((now) => {
    const r = wrap.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh()) return;
    const p = clamp(-r.top / (r.height - vh()));
    const mobile = W < 1025;
    // hero text out
    const tOut = map(p, 0.06, 0.17);
    heroText.style.opacity = 1 - tOut; heroText.style.transform = `translateY(${-tOut * 60}px)`;
    hint.style.opacity = p > 0.01 ? 0 : 1;
    // assembled rect
    const aw = mobile ? W * 0.92 : W * 0.696, ah = aw * 0.56, ax = (W - aw) / 2, ay = mobile ? H * 0.5 - ah / 2 + H * 0.08 : H * 0.54 - ah / 2;
    let rx = ax, ry = ay, rw = aw, rh = ah, alpha = 1;
    const grow = easeInOut(map(p, 0.72, 0.84)), shrink = easeInOut(map(p, 0.88, 0.97));
    if (grow > 0) { rx = lerp(ax, 0, grow); rw = lerp(aw, W, grow); const th = mobile ? H * 0.3 : H * 0.29; rh = lerp(ah, th, grow); ry = lerp(ay, H * 0.66 - th / 2, grow); }
    if (shrink > 0) { const c = ry + rh / 2; rh = lerp(rh, 2, shrink); ry = c - rh / 2; alpha = 1 - map(p, 0.95, 0.99); }
    // reel frames
    if (playing && p > 0.58 && p < 0.97 && now - lastSwap > 1500) { frame++; lastSwap = now; }
    if (p <= 0.58) frame = 0;
    paintFrame(rw, rh);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = alpha;
    const assembleEnd = 0.58;
    if (p >= assembleEnd) {
      ctx.drawImage(off, rx, ry, rw, rh);
    } else {
      const tw = aw / COLS, th = ah / ROWS;
      for (const t of tiles) {
        const lt = easeInOut(map(p, 0.2 + t.delay * 0.12, 0.42 + t.delay * 0.15));
        const visible = map(p, 0.02 + t.delay * 0.3, 0.05 + t.delay * 0.3);
        if (visible <= 0) continue;
        const s = lerp(t.s0, 1, lt);
        const tx = ax + t.c * tw, ty = ay + t.r * th;
        const x = lerp(t.sx * W - tw * s / 2, tx, lt), y = lerp(t.sy * H - th * s / 2, ty, lt);
        ctx.globalAlpha = alpha * visible;
        const b = t.blur * (1 - lt);
        ctx.filter = b > 0.3 ? `blur(${b.toFixed(1)}px)` : "none";
        ctx.drawImage(off, (t.c * tw) * dpr, (t.r * th) * dpr, tw * dpr, th * dpr, x, y, tw * s + 0.5, th * s + 0.5);
      }
      ctx.filter = "none";
    }
    ctx.globalAlpha = 1;
    const showPlay = p > 0.6 && p < 0.72;
    playBtn.classList.toggle("is-in", showPlay);
    playBtn.style.left = `${rx + rw - playBtn.offsetWidth - 16}px`; playBtn.style.top = `${ry + rh - playBtn.offsetHeight - 16}px`;
  });
}

/* ================= HOME: projects hover ================= */
const pg = $("[data-proj-grid]");
if (pg && fine) $$(".proj", pg).forEach((p) => { p.addEventListener("mouseenter", () => pg.classList.add("has-hover")); p.addEventListener("mouseleave", () => pg.classList.remove("has-hover")); });

/* ================= contribution peek ================= */
$$("[data-contrib]").forEach((sec) => {
  const peek = $(".contrib-peek", sec), img = $("img", peek), lab = $("span", peek);
  if (!fine) return;
  const m = { x: 0, y: 0, cx: 0, cy: 0 };
  $$("li", sec).forEach((li) => {
    li.addEventListener("mouseenter", (e) => { img.src = li.dataset.img; lab.textContent = li.dataset.logo; peek.classList.add("is-on"); m.cx = m.x = e.clientX; m.cy = m.y = e.clientY; });
    li.addEventListener("mouseleave", () => peek.classList.remove("is-on"));
  });
  sec.addEventListener("pointermove", (e) => { m.x = e.clientX; m.y = e.clientY; });
  onFrame(() => { m.cx = lerp(m.cx, m.x, 0.15); m.cy = lerp(m.cy, m.y, 0.15); peek.style.left = `${m.cx - peek.offsetWidth * 0.5}px`; peek.style.top = `${m.cy - peek.offsetHeight * 0.55}px`; });
});

/* ================= uniform background + services + testimonials ================= */
const uni = $("[data-uniform]");
if (uni) {
  const svc = $("[data-services]"), testi = $("[data-testi]"), jt = $("[data-jteaser]");
  const words = $$("[data-svc-words] .w"), callouts = $$(".callout", svc), h2 = $("[data-svc-words]");
  const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
  const DARK = [14, 14, 14], MOSS = [48, 57, 48], OLIVE = [110, 101, 84];
  let rockApi = null;
  const rockCanvas = $("[data-rock]");
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const loadRock = () => (window.THREE ? Promise.resolve() : loadScript("assets/js/three.min.js"))
    .then(() => (window.createRock ? null : loadScript("assets/js/rock.js")))
    .then(() => (rockApi = window.createRock(rockCanvas)))
    .catch((e) => console.warn("rock", e));
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { loadRock(); o.disconnect(); } }, { rootMargin: "100% 0px" }).observe(svc);
  const track = $(".testi-track", testi), bar = $(".testi-bar i", testi), barWrap = $(".testi-bar", testi);
  onFrame(() => {
    const ps = stickyProgress(svc);
    let col = mix(DARK, MOSS, easeInOut(map(ps, 0.3, 0.62)));
    const jr = jt.getBoundingClientRect();
    col = mix(col, OLIVE, easeInOut(map(vh() * 0.7 - jr.top, 0, vh() * 0.3)));
    uni.style.backgroundColor = `rgb(${col})`;
    const svr = svc.getBoundingClientRect();
    if (svr.bottom > 0 && svr.top < vh()) {
      const n = map(ps, 0.1, 0.38) * words.length;
      words.forEach((w, i) => w.classList.toggle("on", i < n));
      h2.style.opacity = 1 - map(ps, 0.55, 0.63);
      callouts.forEach((c, i) => c.classList.toggle("is-in", ps > 0.64 + i * 0.05));
      rockApi?.update(ps);
    }
    rockApi?.setActive(svr.bottom > 0 && svr.top < vh());
    const tr = testi.getBoundingClientRect();
    if (tr.bottom > 0 && tr.top < vh()) {
      const pt = stickyProgress(testi);
      const maxX = track.scrollWidth - vw() + vw() * 0.055;
      track.style.transform = `translate3d(${-pt * Math.max(0, maxX)}px,0,0)`;
      bar.style.left = `${pt * (barWrap.clientWidth - bar.offsetWidth)}px`;
    }
  });
}

/* ================= journal panels ================= */
$$("[data-panels]").forEach((wrap) => {
  const ps = $$(".panel", wrap);
  const open = (p) => ps.forEach((x) => x.classList.toggle("is-open", x === p));
  ps.forEach((p) => { p.addEventListener("mouseenter", () => fine && open(p)); p.addEventListener("focusin", () => open(p)); });
});

/* ================= footer wordmark: pixel trail reveal ================= */
$$("[data-ftr-mark]").forEach((box) => {
  const cv = $("canvas", box), ctx = cv.getContext("2d"), mark = $(".foot-mark", box);
  const tex = new Image(); tex.src = "assets/img/reel-1.jpg";
  let W, H, dpr, cell, cols, rows, life, active = false, raf = 0;
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = box.clientWidth; H = box.clientHeight; cv.width = W * dpr; cv.height = H * dpr; cell = Math.max(8, W / 90); cols = Math.ceil(W / cell); rows = Math.ceil(H / cell); life = new Float32Array(cols * rows); };
  size(); addEventListener("resize", size);
  const mask = document.createElement("canvas"), mctx = mask.getContext("2d");
  const drawText = (c) => {
    const fs = getComputedStyle(mark).fontSize, ff = getComputedStyle(mark).fontFamily, fw = getComputedStyle(mark).fontWeight;
    c.font = `${fw} ${fs} ${ff}`; c.textBaseline = "alphabetic"; c.fillStyle = "#fff";
    const br = box.getBoundingClientRect();
    $$(".ch > span", mark).forEach((s) => {
      const r = s.getBoundingClientRect();
      c.fillText(s.textContent, r.left - br.left, r.top - br.top + parseFloat(fs) * 0.89);
    });
  };
  let px = -1, py = -1;
  box.addEventListener("pointermove", (e) => {
    const br = box.getBoundingClientRect(); const x = e.clientX - br.left, y = e.clientY - br.top;
    const steps = px < 0 ? 1 : Math.ceil(Math.hypot(x - px, y - py) / (cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const ix = px < 0 ? x : lerp(px, x, s / steps), iy = px < 0 ? y : lerp(py, y, s / steps);
      for (let k = 0; k < 6; k++) {
        const cx = Math.floor((ix + (Math.random() - 0.5) * cell * 5) / cell), cy = Math.floor((iy + (Math.random() - 0.5) * cell * 5) / cell);
        if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) life[cy * cols + cx] = 1;
      }
    }
    px = x; py = y;
    if (!active) { active = true; raf = requestAnimationFrame(draw); }
  });
  box.addEventListener("pointerleave", () => { px = py = -1; });
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let any = false;
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < life.length; i++) {
      if (life[i] <= 0) continue; any = true;
      ctx.fillStyle = `rgba(255,255,255,${life[i].toFixed(2)})`;
      ctx.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell + 0.5, cell + 0.5);
      life[i] -= 0.012 + Math.random() * 0.01;
    }
    ctx.globalCompositeOperation = "source-in";
    if (tex.complete && tex.naturalWidth) { const s = Math.max(W / tex.naturalWidth, H / tex.naturalHeight); ctx.drawImage(tex, (W - tex.naturalWidth * s) / 2, (H - tex.naturalHeight * s) / 2, tex.naturalWidth * s, tex.naturalHeight * s); }
    else { ctx.fillStyle = "#4b6b22"; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = "destination-in";
    if (mask.width !== cv.width) { mask.width = cv.width; mask.height = cv.height; }
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0); mctx.clearRect(0, 0, W, H); drawText(mctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    if (any) raf = requestAnimationFrame(draw); else { active = false; ctx.clearRect(0, 0, cv.width, cv.height); }
  }
});

/* ================= WORK carousel ================= */
const ws = $("[data-work]");
if (ws) {
  const data = JSON.parse(ws.dataset.work), n = data.length;
  let idx = 0, layout = "vertical", lock = 0;
  const items = data.map((d, i) => {
    const el = document.createElement("div"); el.className = "work-item"; el.setAttribute("role", "button"); el.tabIndex = -1; el.setAttribute("aria-label", d.name);
    el.innerHTML = `<img src="${d.img}" alt="" draggable="false"><span class="fake-logo">${d.logo}</span>`;
    el.addEventListener("click", () => { if (i !== idx) go(i - idx); });
    ws.appendChild(el); return el;
  });
  const nameEl = $("[data-w-name]"), idxEl = $("[data-w-idx]"), yearEl = $("[data-w-year]");
  const SIZES = [[28.54, 15.97], [22.78, 12.78], [14.93, 7.29]]; // vw, measured 411×230, 328×184, 215×105
  function render() {
    const mobile = vw() < 1025, k = mobile ? 2.4 : 1;
    items.forEach((el, i) => {
      let d = i - idx; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
      const a = Math.abs(d), s = SIZES[Math.min(2, a)];
      const w = s[0] * k, h = s[1] * k;
      let x = 0, y = 0;
      const off = (a === 0 ? 0 : a === 1 ? 1 : 1.73 + (a - 2) * 0.6) * Math.sign(d);
      if (layout === "vertical") y = off * (mobile ? 21 : 26.1) * vh() / 100; else x = off * (mobile ? 50 : 25.5) * vw() / 100;
      el.style.width = `${w}vw`; el.style.height = `${h}vw`;
      el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
      el.style.opacity = a > 2.5 ? 0 : 1; el.style.zIndex = 10 - a;
      el.classList.toggle("is-active", a === 0);
    });
    const d = data[idx];
    nameEl.style.transform = "translateY(100%)";
    setTimeout(() => { nameEl.textContent = d.name; nameEl.style.transition = "none"; nameEl.style.transform = "translateY(-100%)"; void nameEl.offsetWidth; nameEl.style.transition = ""; nameEl.style.transform = "none"; }, 260);
    idxEl.textContent = String(idx + 1).padStart(3, "0"); yearEl.textContent = d.year;
  }
  function go(step) { idx = (idx + step + n * 10) % n; render(); }
  addEventListener("wheel", (e) => { e.preventDefault(); const now = performance.now(); if (now < lock || Math.abs(e.deltaY + e.deltaX) < 8) return; lock = now + 650; go(Math.sign(e.deltaY || e.deltaX)); }, { passive: false });
  addEventListener("keydown", (e) => { if (["ArrowDown", "ArrowRight"].includes(e.key)) go(1); if (["ArrowUp", "ArrowLeft"].includes(e.key)) go(-1); });
  let sx = 0, sy = 0, down = false;
  ws.addEventListener("pointerdown", (e) => { down = true; sx = e.clientX; sy = e.clientY; });
  addEventListener("pointerup", (e) => { if (!down) return; down = false; const dx = e.clientX - sx, dy = e.clientY - sy; const d = layout === "vertical" ? -dy : -dx; if (Math.abs(d) > 40) go(Math.sign(d)); });
  $$("[data-layout]").forEach((b) => b.addEventListener("click", () => { layout = b.dataset.layout; $$("[data-layout]").forEach((x) => x.classList.toggle("on", x === b)); render(); }));
  addEventListener("resize", render);
  render();
}

/* ================= STUDIO: brand chemistry ================= */
const chem = $("[data-chem]");
if (chem) {
  const cfg = JSON.parse(chem.dataset.chem), svg = $("svg", chem), sticky = $(".chem-sticky", chem), cards = $$(".ccard", chem);
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a = {}, p = svg) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
  const defs = el("defs");
  const pat = el("pattern", { id: "hatch", width: 10, height: 10, patternUnits: "userSpaceOnUse", patternTransform: "rotate(25)" }, defs);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 10, stroke: "rgba(242,242,242,.12)", "stroke-width": 1 }, pat);
  // stage 1: tick ring
  const g1 = el("g");
  for (let i = 0; i < 120; i++) { const a = (i / 120) * Math.PI * 2, r1 = 230, r2 = 250; el("line", { x1: Math.cos(a) * r1, y1: Math.sin(a) * r1, x2: Math.cos(a) * r2, y2: Math.sin(a) * r2, stroke: "#f2f2f2", "stroke-width": 2.2, class: "tick", "data-i": i }, g1); }
  el("text", { x: 0, y: 8, "text-anchor": "middle", fill: "#f2f2f2", "font-family": "Sora", "font-weight": 300, "font-size": 30 }, g1).textContent = cfg.title;
  const ticks = $$(".tick", g1);
  // stage 2: two crossing circles (lens)
  const g2 = el("g");
  el("circle", { cx: -260, cy: 0, r: 420, fill: "url(#hatch)", stroke: "rgba(242,242,242,.35)" }, g2);
  el("circle", { cx: 260, cy: 0, r: 420, fill: "url(#hatch)", stroke: "rgba(242,242,242,.35)" }, g2);
  const lens = []; for (let i = 0; i <= 60; i++) { const a = -Math.acos(260 / 420) + (i / 60) * 2 * Math.acos(260 / 420); lens.push([-260 + 420 * Math.cos(a), 420 * Math.sin(a)]); }
  const lensPts = [...lens, ...lens.map(([x, y]) => [-x, -y])];
  el("path", { d: "M" + lensPts.map((p) => p.join(",")).join("L") + "Z", fill: "#545e54" }, g2);
  const ring2 = el("g", {}, g2);
  for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2; el("line", { x1: Math.cos(a) * 130, y1: Math.sin(a) * 130, x2: Math.cos(a) * 140, y2: Math.sin(a) * 140, stroke: "#f2f2f2", "stroke-width": 1.5 }, ring2); }
  el("text", { x: 0, y: 6, "text-anchor": "middle", fill: "#f2f2f2", "font-family": "Sora", "font-weight": 300, "font-size": 22, transform: "rotate(8)" }, g2).textContent = cfg.title;
  // stage 3: venn of four
  const g3 = el("g"); const R = 215, O = 150;
  const centers = [[0, -O], [O, 0], [0, O], [-O, 0]];
  const inside = (x, y) => centers.every(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= R * R);
  const core = []; for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; let lo = 0, hi = R; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; inside(Math.cos(a) * m, Math.sin(a) * m) ? (lo = m) : (hi = m); } core.push([Math.cos(a) * lo, Math.sin(a) * lo]); }
  el("path", { d: "M" + core.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L") + "Z", fill: "#545e54" }, g3);
  centers.forEach(([cx, cy], i) => {
    el("circle", { cx, cy, r: R, fill: "none", stroke: "rgba(242,242,242,.55)", "stroke-width": 1.4 }, g3);
    const v = cfg.venn[i], dir = [cx, cy].map((q) => Math.sign(q));
    const lx = cx + dir[0] * 115, ly = cy + dir[1] * 115;
    el("text", { x: lx, y: ly + 4, "text-anchor": "middle", fill: "#f2f2f2", "font-family": "DM Mono", "font-size": 54 }, g3).textContent = v.k;
    el("text", { x: lx, y: ly + 30, "text-anchor": "middle", fill: "#f2f2f2", "font-family": "DM Mono", "font-size": 17 }, g3).textContent = v.t;
    const rr = R + 22, mid = Math.atan2(cy, cx), span = 1.0;
    const a0 = mid - span, a1 = mid + span;
    const pid = `arc${i}`;
    el("path", { id: pid, d: `M${cx + rr * Math.cos(a0)},${cy + rr * Math.sin(a0)} A${rr},${rr} 0 0 1 ${cx + rr * Math.cos(a1)},${cy + rr * Math.sin(a1)}`, fill: "none" }, defs);
    const t = el("text", { fill: "#f2f2f2", "font-family": "DM Mono", "font-size": 13, "letter-spacing": 0.5 }, g3);
    const tp = el("textPath", { href: `#${pid}`, startOffset: "50%", "text-anchor": "middle" }, t); tp.textContent = v.ring;
  });
  onFrame(() => {
    const r = chem.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh()) return;
    const p = stickyProgress(chem);
    const drawn = map(p, 0, 0.12) * ticks.length;
    ticks.forEach((t, i) => (t.style.opacity = i < drawn ? 1 : 0.08));
    g1.style.opacity = 1 - map(p, 0.16, 0.22); g1.setAttribute("transform", `scale(${1 + map(p, 0.12, 0.22) * 1.5})`);
    sticky.style.backgroundColor = p < 0.17 ? "#545e54" : "#0e0e0e";
    const s2 = map(p, 0.17, 0.38);
    g2.style.opacity = s2 > 0 && s2 < 1 ? 1 - map(p, 0.33, 0.4) : 0;
    g2.setAttribute("transform", `scale(${lerp(1.4, 0.6, easeInOut(s2))}) rotate(${-20 + s2 * 20})`);
    const s3 = easeOut(map(p, 0.36, 0.5));
    g3.style.opacity = s3; g3.setAttribute("transform", `scale(${lerp(2, 1.32, s3)})`);
    const dim = map(p, 0.66, 0.74);
    svg.style.filter = dim > 0 ? `blur(${dim * 10}px)` : "none"; svg.style.opacity = 1 - dim * 0.65;
    cards.forEach((c, i) => c.classList.toggle("is-in", p > 0.72 + i * 0.06));
  });
}

/* ================= STUDIO: pixel portrait ================= */
$$("[data-pix]").forEach((box) => {
  const cv = $("canvas", box), ctx = cv.getContext("2d"), img = new Image();
  const GW = 54, GH = 41; cv.width = GW; cv.height = GH;
  img.src = box.dataset.pix;
  img.onload = () => {
    const tmp = document.createElement("canvas"); tmp.width = GW; tmp.height = GH; const t = tmp.getContext("2d");
    const s = Math.max(GW / img.width, GH / img.height); t.filter = "grayscale(1) contrast(1.25)";
    t.drawImage(img, (GW - img.width * s) / 2, (GH - img.height * s) / 2, img.width * s, img.height * s);
    const order = [...Array(GW * GH).keys()];
    let timer = 0;
    const run = () => {
      clearInterval(timer); ctx.clearRect(0, 0, GW, GH);
      order.sort(() => Math.random() - 0.5);
      let k = 0, prev = [];
      timer = setInterval(() => {
        prev.forEach((i) => ctx.drawImage(tmp, i % GW, (i / GW) | 0, 1, 1, i % GW, (i / GW) | 0, 1, 1));
        prev = order.slice(k, k + 40); k += 40;
        ctx.fillStyle = "#cfff6a";
        prev.forEach((i) => ctx.fillRect(i % GW, (i / GW) | 0, 1, 1));
        if (k >= order.length) { clearInterval(timer); setTimeout(() => ctx.drawImage(tmp, 0, 0), 60); }
      }, 30);
    };
    watch(box, run);
    box.addEventListener("mouseenter", run);
  };
});

/* ================= CONTACT form (demo — never sends) ================= */
const cform = $("[data-cform]");
if (cform) {
  $$("[data-dd]", cform).forEach((dd) => {
    const btn = $(".dd-btn", dd), list = $$("li", dd), hidden = $("input[type=hidden]", dd);
    const close = () => { dd.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", () => { const o = !dd.classList.contains("is-open"); $$("[data-dd]").forEach((x) => x.classList.remove("is-open")); dd.classList.toggle("is-open", o); btn.setAttribute("aria-expanded", o); if (o) list[0].focus(); });
    list.forEach((li, i) => {
      const pick = () => { hidden.value = li.textContent; $("span", btn).textContent = li.textContent; btn.classList.add("has"); list.forEach((x) => x.setAttribute("aria-selected", x === li)); dd.closest(".field").classList.remove("err"); close(); btn.focus(); };
      li.addEventListener("click", pick);
      li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } if (e.key === "ArrowDown") { e.preventDefault(); list[Math.min(i + 1, list.length - 1)].focus(); } if (e.key === "ArrowUp") { e.preventDefault(); list[Math.max(i - 1, 0)].focus(); } if (e.key === "Escape") { close(); btn.focus(); } });
    });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("[data-dd]")) $$("[data-dd]").forEach((x) => x.classList.remove("is-open")); });
  $$("input, textarea", cform).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("err")));
  cform.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $(".form-msg", cform); let bad = false;
    $$(".field", cform).forEach((f) => {
      if (f.dataset.req !== "1") return;
      const inp = $("input:not([type=hidden]), textarea", f) || $("input[type=hidden]", f);
      const v = (inp.value || "").trim();
      const wrong = !v || (inp.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
      f.classList.toggle("err", wrong); bad ||= wrong;
    });
    msg.innerHTML = bad ? `<span class="bad">${msg.dataset.bad}</span>` : `<span class="good">${msg.dataset.good}</span>`;
  });
}

/* ================= JOURNAL filter ================= */
const jf = $("[data-jfilters]");
if (jf) $$("button", jf).forEach((b) => b.addEventListener("click", () => {
  $$("button", jf).forEach((x) => x.classList.toggle("on", x === b));
  $$(".j-card").forEach((c) => c.classList.toggle("is-hidden", b.dataset.f !== "all" && c.dataset.cat !== b.dataset.f));
}));

})();

/*!
 * Foundever AIDT NeonLines Engine v1.0
 * CDN Edition
 *
 * Trail-style neon particle lines oscillating between the Foundever
 * Indigo and Mint brand hues. Adapted from a standalone demo into the
 * AIDT_ASSET_LOADER pattern (see shapeshifter.js for the reference
 * guard/API shape this file follows).
 *
 * Status: experimental - pending visual validation.
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_NEONLINES_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_NEONLINES_RUNNING__ = true;

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var config = window.NEONLINES_CONFIG || {};

  var canvas = document.querySelector(config.target || "#neonlines-canvas");

  if (!canvas) {
    window.__FOUNDEVER_NEONLINES_RUNNING__ = false;
    return;
  }

  var ctx = canvas.getContext("2d");

  if (!ctx) {
    window.__FOUNDEVER_NEONLINES_RUNNING__ = false;
    return;
  }

  var heroEl = document.querySelector(config.hero || "#top");

  /*
   * Foundever brand tokens (AIDT-DESIGN-SYSTEM.md section 1):
   *   --fd-midnight: #09092D
   *   --fd-indigo:   #4B4BF9  -> hue ~240
   *   --fd-mint:     #8BF0BB  -> hue ~150
   * Read from the hero's computed style when available so a themed
   * page can override the tokens; fall back to the documented values.
   */
  function readToken(name, fallback) {
    if (!heroEl || typeof getComputedStyle !== "function") return fallback;
    var value = getComputedStyle(heroEl).getPropertyValue(name).trim();
    return value || fallback;
  }

  var MIDNIGHT = readToken("--fd-midnight", "#09092D");

  function isNum(v) {
    return typeof v === "number" && isFinite(v);
  }

  function num(v, fallback) {
    return isNum(v) ? v : fallback;
  }

  var opts = {
    len: num(config.len, 20),
    count: num(config.count, 50),
    baseTime: num(config.baseTime, 10),
    addedTime: num(config.addedTime, 10),
    dieChance: num(config.dieChance, 0.05),
    spawnChance: num(config.spawnChance, 1),
    sparkChance: num(config.sparkChance, 0.1),
    sparkDist: num(config.sparkDist, 10),
    sparkSize: num(config.sparkSize, 2),

    /* Cycle hue between indigo (240) and mint (150) */
    baseHue: num(config.baseHue, 240),
    hueRange: num(config.hueRange, 90),
    baseLight: num(config.baseLight, 55),
    addedLight: num(config.addedLight, 15),
    shadowToTimePropMult: 6,
    baseLightInputMultiplier: 0.01,
    addedLightInputMultiplier: 0.02,

    cx: 0,
    cy: 0,
    repaintAlpha: num(config.repaintAlpha, 0.04),
    hueSpeed: num(config.hueSpeed, 0.15)
  };

  var baseRad = (Math.PI * 2) / 6;
  var w, h, dieX, dieY, tick = 0, lines = [], animId = null, isDestroyed = false;

  function paintBackground() {
    ctx.fillStyle = MIDNIGHT;
    ctx.fillRect(0, 0, w, h);
  }

  function resize() {
    w = canvas.width = canvas.parentElement.offsetWidth || window.innerWidth;
    h = canvas.height = canvas.parentElement.offsetHeight || window.innerHeight;
    opts.cx = w / 2;
    opts.cy = h / 2;
    dieX = w / 2 / opts.len;
    dieY = h / 2 / opts.len;
    paintBackground();
  }

  function getHue() {
    var t = tick * opts.hueSpeed;
    return opts.baseHue - (Math.sin(t * 0.01) * 0.5 + 0.5) * opts.hueRange;
  }

  function Line() {
    this.reset();
  }

  Line.prototype.reset = function () {
    this.x = 0;
    this.y = 0;
    this.addedX = 0;
    this.addedY = 0;
    this.rad = 0;
    this.lightInputMultiplier =
      opts.baseLightInputMultiplier + opts.addedLightInputMultiplier * Math.random();
    this.hue = getHue();
    this.cumulativeTime = 0;
    this.beginPhase();
  };

  Line.prototype.beginPhase = function () {
    this.x += this.addedX;
    this.y += this.addedY;
    this.time = 0;
    this.targetTime = (opts.baseTime + opts.addedTime * Math.random()) | 0;
    this.rad += baseRad * (Math.random() < 0.5 ? 1 : -1);
    this.addedX = Math.cos(this.rad);
    this.addedY = Math.sin(this.rad);
    if (
      Math.random() < opts.dieChance ||
      this.x > dieX ||
      this.x < -dieX ||
      this.y > dieY ||
      this.y < -dieY
    )
      this.reset();
  };

  Line.prototype.step = function () {
    ++this.time;
    ++this.cumulativeTime;

    if (this.time >= this.targetTime) this.beginPhase();

    var prop = this.time / this.targetTime;
    var wave = Math.sin((prop * Math.PI) / 2);
    var x = this.addedX * wave;
    var y = this.addedY * wave;
    var light =
      opts.baseLight + opts.addedLight * Math.sin(this.cumulativeTime * this.lightInputMultiplier);

    var color = "hsl(" + this.hue + ",85%," + light + "%)";

    ctx.shadowBlur = prop * opts.shadowToTimePropMult;
    ctx.fillStyle = ctx.shadowColor = color;
    ctx.fillRect(opts.cx + (this.x + x) * opts.len, opts.cy + (this.y + y) * opts.len, 2, 2);

    if (Math.random() < opts.sparkChance) {
      ctx.fillRect(
        opts.cx +
          (this.x + x) * opts.len +
          Math.random() * opts.sparkDist * (Math.random() < 0.5 ? 1 : -1) -
          opts.sparkSize / 2,
        opts.cy +
          (this.y + y) * opts.len +
          Math.random() * opts.sparkDist * (Math.random() < 0.5 ? 1 : -1) -
          opts.sparkSize / 2,
        opts.sparkSize,
        opts.sparkSize
      );
    }
  };

  function tickFrame() {
    ++tick;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(9,9,45," + opts.repaintAlpha + ")";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    if (lines.length < opts.count && Math.random() < opts.spawnChance) lines.push(new Line());

    for (var i = 0; i < lines.length; i++) lines[i].step();
  }

  function loop() {
    if (isDestroyed) {
      animId = null;
      return;
    }
    animId = window.requestAnimationFrame(loop);
    tickFrame();
  }

  function renderStaticFrame() {
    for (var i = 0; i < 300; i++) tickFrame();
  }

  function handleResize() {
    resize();
  }

  function destroy() {
    isDestroyed = true;

    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    window.removeEventListener("resize", handleResize);
    if (observer) observer.disconnect();

    window.__FOUNDEVER_NEONLINES_RUNNING__ = false;
  }

  resize();

  if (reducedMotion) {
    renderStaticFrame();
  } else {
    loop();
  }

  window.addEventListener("resize", handleResize);

  /* Pause when off-screen */
  var observer = null;
  if (typeof IntersectionObserver !== "undefined" && heroEl) {
    observer = new IntersectionObserver(
      function (entries) {
        if (reducedMotion || isDestroyed) return;
        if (entries[0].isIntersecting) {
          if (!animId) loop();
        } else if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      },
      { threshold: 0 }
    );
    observer.observe(heroEl);
  }

  window.FOUNDEVER_NEONLINES = {
    version: "1.0",
    destroy: destroy,
    resize: resize
  };
})();

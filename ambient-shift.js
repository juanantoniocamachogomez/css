/*!
 * Foundever AIDT Canvas-Shift Engine v1.0
 *
 * Adapted from crnacura/AmbientCanvasBackgrounds js/shift.js (Codrops/
 * Tympanus): large soft circles drift in random directions, their hue
 * shifting slowly over time via simplex noise, then heavily blurred into a
 * smooth color-wash background. See components/_attribution-codrops.md
 * for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - Hue is fixed to the Foundever Indigo/Mint band instead of the
 *   original full hue wheel.
 * - Renders into the loader-created <canvas> (config.target) instead of
 *   appending its own canvas to the page.
 * - Dependencies: css-main/decorative-perlin.js, css-main/ambient-noise.js
 *   and css-main/ambient-util.js must all be loaded before this file (in
 *   that order).
 *
 * Config: window.SHIFT_CONFIG (see components/hero-ambient-shift.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_SHIFT_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_SHIFT_RUNNING__ = true;

  if (typeof window.SimplexNoise !== "function" || typeof rand !== "function") {
    console.error("Canvas-Shift requires decorative-perlin.js, ambient-noise.js and ambient-util.js to be loaded first.");
    window.__FOUNDEVER_SHIFT_RUNNING__ = false;
    return;
  }

  var config = window.SHIFT_CONFIG || {};

  var canvasB = document.querySelector(config.target || "#shift-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvasB || !hero) {
    window.__FOUNDEVER_SHIFT_RUNNING__ = false;
    return;
  }

  var ctxB = canvasB.getContext("2d");
  if (!ctxB) {
    window.__FOUNDEVER_SHIFT_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var circleCount = Math.max(10, Number(config.circleCount) || 150);
  var circlePropCount = 8;
  var circlePropsLength = circleCount * circlePropCount;
  var baseSpeed = Number(config.baseSpeed) || 0.1;
  var rangeSpeed = Number(config.rangeSpeed) || 1;
  var baseTTL = Number(config.baseTTL) || 150;
  var rangeTTL = Number(config.rangeTTL) || 200;
  var baseRadius = Number(config.baseRadius) || 100;
  var rangeRadius = Number(config.rangeRadius) || 200;
  var rangeHue = Number(config.rangeHue) || 50;
  var xOff = Number(config.xOff) || 0.0015;
  var yOff = Number(config.yOff) || 0.0015;
  var zOff = Number(config.zOff) || 0.0015;
  var backgroundColor = config.backgroundColor || "hsla(245,50%,4%,1)"; /* near --fd-midnight */

  var canvasA = document.createElement("canvas");
  var ctxA = canvasA.getContext("2d");

  var width = 0, height = 0;
  var circleProps = null;
  var simplex = null;
  var baseHue = 235; /* --fd-indigo hue band, drifts toward --fd-mint */
  var isVisible = true, isIntersecting = true, isDestroyed = false;
  var resizeTimer = null;
  var rafId = null;

  function initCircle(i) {
    var x = rand(canvasA.width);
    var y = rand(canvasA.height);
    var n = simplex.noise3D(x * xOff, y * yOff, baseHue * zOff);
    var t = rand(TAU);
    var speed = baseSpeed + rand(rangeSpeed);

    circleProps.set([
      x, y,
      speed * Math.cos(t), speed * Math.sin(t),
      0,
      baseTTL + rand(rangeTTL),
      baseRadius + rand(rangeRadius),
      baseHue + n * rangeHue
    ], i);
  }

  function initCircles() {
    circleProps = new Float32Array(circlePropsLength);
    simplex = new window.SimplexNoise();
    baseHue = 235;
    for (var i = 0; i < circlePropsLength; i += circlePropCount) {
      initCircle(i);
    }
  }

  function checkBounds(x, y, radius) {
    return x < -radius || x > canvasA.width + radius || y < -radius || y > canvasA.height + radius;
  }

  function drawCircle(x, y, life, ttl, radius, hue) {
    ctxA.save();
    ctxA.fillStyle = "hsla(" + hue + ",55%,32%," + fadeInOut(life, ttl) + ")";
    ctxA.beginPath();
    ctxA.arc(x, y, radius, 0, TAU);
    ctxA.fill();
    ctxA.closePath();
    ctxA.restore();
  }

  function updateCircle(i) {
    var i2 = 1 + i, i3 = 2 + i, i4 = 3 + i, i5 = 4 + i, i6 = 5 + i, i7 = 6 + i, i8 = 7 + i;
    var x = circleProps[i], y = circleProps[i2], vx = circleProps[i3], vy = circleProps[i4];
    var life = circleProps[i5], ttl = circleProps[i6], radius = circleProps[i7], hue = circleProps[i8];

    drawCircle(x, y, life, ttl, radius, hue);

    life++;
    circleProps[i] = x + vx;
    circleProps[i2] = y + vy;
    circleProps[i5] = life;

    if (checkBounds(x, y, radius) || life > ttl) initCircle(i);
  }

  function updateCircles() {
    baseHue++;
    for (var i = 0; i < circlePropsLength; i += circlePropCount) {
      updateCircle(i);
    }
  }

  function renderBlur() {
    ctxB.save();
    ctxB.filter = "blur(50px)";
    ctxB.drawImage(canvasA, 0, 0);
    ctxB.restore();
  }

  function drawTick() {
    ctxA.clearRect(0, 0, canvasA.width, canvasA.height);
    ctxB.fillStyle = backgroundColor;
    ctxB.fillRect(0, 0, canvasB.width, canvasB.height);
    updateCircles();
    renderBlur();
  }

  function resizeCanvas() {
    var rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));

    canvasA.width = width;
    canvasA.height = height;
    ctxA.drawImage(canvasB, 0, 0);

    canvasB.width = width;
    canvasB.height = height;
    ctxB.drawImage(canvasA, 0, 0);
  }

  function shouldAnimate() {
    return !reducedMotion && isVisible && isIntersecting && !isDestroyed;
  }

  function loop() {
    drawTick();
    rafId = shouldAnimate() ? requestAnimationFrame(loop) : null;
  }

  function startLoop() {
    if (!rafId && shouldAnimate()) rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (isDestroyed) return;
      resizeCanvas();
      if (!shouldAnimate()) drawTick();
    }, 200);
  }

  function handleVisibility() {
    isVisible = !document.hidden;
    if (shouldAnimate()) startLoop(); else stopLoop();
  }

  function handleMotionChange(event) {
    reducedMotion = event.matches;
    if (reducedMotion) stopLoop(); else startLoop();
  }

  var observer = null;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(function (entries) {
      isIntersecting = Boolean(entries[0] && entries[0].isIntersecting);
      if (shouldAnimate()) startLoop(); else stopLoop();
    }, { threshold: 0.05 });
    observer.observe(hero);
  }

  window.addEventListener("resize", handleResize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);

  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", handleMotionChange);
  } else if (typeof motionQuery.addListener === "function") {
    motionQuery.addListener(handleMotionChange);
  }

  resizeCanvas();
  initCircles();
  drawTick();
  if (shouldAnimate()) startLoop();

  function destroy() {
    isDestroyed = true;
    stopLoop();
    clearTimeout(resizeTimer);

    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibility);

    if (observer) observer.disconnect();

    if (typeof motionQuery.removeEventListener === "function") {
      motionQuery.removeEventListener("change", handleMotionChange);
    } else if (typeof motionQuery.removeListener === "function") {
      motionQuery.removeListener(handleMotionChange);
    }

    ctxA.clearRect(0, 0, canvasA.width, canvasA.height);
    ctxB.clearRect(0, 0, canvasB.width, canvasB.height);

    window.__FOUNDEVER_SHIFT_RUNNING__ = false;
  }

  window.FOUNDEVER_SHIFT = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) drawTick();
    }
  };
})();

/*!
 * Foundever AIDT Canvas-Aurora Engine v1.0
 *
 * Adapted from crnacura/AmbientCanvasBackgrounds js/aurora.js (Codrops/
 * Tympanus): vertical light rays drift sideways across the canvas, each
 * fading in/out over its lifetime and nudged by simplex noise, composited
 * with a blur pass for a soft aurora glow. See
 * components/_attribution-codrops.md for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - Hue is fixed to the Foundever Indigo/Mint range instead of the
 *   original random green-to-yellow hue band.
 * - The original appends its own offscreen <canvas> into the page; this
 *   version renders into the <canvas> the loader already created
 *   (config.target) and keeps a second canvas purely in memory for the
 *   blur compositing step.
 * - Dependencies: css-main/decorative-perlin.js, css-main/ambient-noise.js
 *   and css-main/ambient-util.js must all be loaded before this file (in
 *   that order) for window.SimplexNoise and the rand/TAU/fadeInOut helpers.
 *
 * Config: window.AURORA_CONFIG (see components/hero-ambient-aurora.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_AURORA_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_AURORA_RUNNING__ = true;

  if (typeof window.SimplexNoise !== "function" || typeof rand !== "function") {
    console.error("Canvas-Aurora requires decorative-perlin.js, ambient-noise.js and ambient-util.js to be loaded first.");
    window.__FOUNDEVER_AURORA_RUNNING__ = false;
    return;
  }

  var config = window.AURORA_CONFIG || {};

  var canvasB = document.querySelector(config.target || "#aurora-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvasB || !hero) {
    window.__FOUNDEVER_AURORA_RUNNING__ = false;
    return;
  }

  var ctxB = canvasB.getContext("2d");
  if (!ctxB) {
    window.__FOUNDEVER_AURORA_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var rayCount = Math.max(10, Number(config.rayCount) || 500);
  var rayPropCount = 8;
  var rayPropsLength = rayCount * rayPropCount;
  var baseLength = Number(config.baseLength) || 200;
  var rangeLength = Number(config.rangeLength) || 200;
  var baseSpeed = Number(config.baseSpeed) || 0.05;
  var rangeSpeed = Number(config.rangeSpeed) || 0.1;
  var baseWidth = Number(config.baseWidth) || 10;
  var rangeWidth = Number(config.rangeWidth) || 20;
  var baseHue = Number(config.baseHue) || 235;   /* --fd-indigo hue band */
  var rangeHue = Number(config.rangeHue) || 40;   /* drifts toward --fd-mint */
  var baseTTL = Number(config.baseTTL) || 50;
  var rangeTTL = Number(config.rangeTTL) || 100;
  var noiseStrength = Number(config.noiseStrength) || 100;
  var xOff = Number(config.xOff) || 0.0015;
  var yOff = Number(config.yOff) || 0.0015;
  var zOff = Number(config.zOff) || 0.0015;
  var backgroundColor = config.backgroundColor || "hsla(245,65%,4%,1)"; /* near --fd-midnight */

  var canvasA = document.createElement("canvas");
  var ctxA = canvasA.getContext("2d");

  var width = 0, height = 0, centerX = 0, centerY = 0;
  var tick = 0;
  var simplex = null;
  var rayProps = null;
  var isVisible = true, isIntersecting = true, isDestroyed = false;
  var resizeTimer = null;
  var rafId = null;

  function initRay(i) {
    var length = baseLength + rand(rangeLength);
    var x = rand(canvasA.width);
    var y1 = centerY + noiseStrength;
    var y2 = centerY + noiseStrength - length;
    var n = simplex.noise3D(x * xOff, y1 * yOff, tick * zOff) * noiseStrength;
    y1 += n;
    y2 += n;

    rayProps.set([
      x, y1, y2, 0,
      baseTTL + rand(rangeTTL),
      baseWidth + rand(rangeWidth),
      baseSpeed + rand(rangeSpeed) * (Math.round(rand(1)) ? 1 : -1),
      baseHue + rand(rangeHue)
    ], i);
  }

  function initRays() {
    tick = 0;
    simplex = new window.SimplexNoise();
    rayProps = new Float32Array(rayPropsLength);
    for (var i = 0; i < rayPropsLength; i += rayPropCount) {
      initRay(i);
    }
  }

  function checkBounds(x) {
    return x < 0 || x > canvasA.width;
  }

  function drawRay(x, y1, y2, life, ttl, lineWidth, hue) {
    var gradient = ctxA.createLinearGradient(x, y1, x, y2);
    gradient.addColorStop(0, "hsla(" + hue + ",90%,65%,0)");
    gradient.addColorStop(0.5, "hsla(" + hue + ",90%,65%," + fadeInOut(life, ttl) + ")");
    gradient.addColorStop(1, "hsla(" + hue + ",90%,65%,0)");

    ctxA.save();
    ctxA.beginPath();
    ctxA.strokeStyle = gradient;
    ctxA.lineWidth = lineWidth;
    ctxA.moveTo(x, y1);
    ctxA.lineTo(x, y2);
    ctxA.stroke();
    ctxA.closePath();
    ctxA.restore();
  }

  function updateRay(i) {
    var i2 = 1 + i, i3 = 2 + i, i4 = 3 + i, i5 = 4 + i, i6 = 5 + i, i7 = 6 + i, i8 = 7 + i;
    var x = rayProps[i], y1 = rayProps[i2], y2 = rayProps[i3];
    var life = rayProps[i4], ttl = rayProps[i5], lineWidth = rayProps[i6];
    var speed = rayProps[i7], hue = rayProps[i8];

    drawRay(x, y1, y2, life, ttl, lineWidth, hue);

    x += speed;
    life++;
    rayProps[i] = x;
    rayProps[i4] = life;

    if (checkBounds(x) || life > ttl) initRay(i);
  }

  function drawRays() {
    for (var i = 0; i < rayPropsLength; i += rayPropCount) {
      updateRay(i);
    }
  }

  function renderComposite() {
    ctxB.save();
    ctxB.filter = "blur(12px)";
    ctxA.globalCompositeOperation = "lighter";
    ctxB.drawImage(canvasA, 0, 0);
    ctxB.restore();
  }

  function drawTick() {
    tick++;
    ctxA.clearRect(0, 0, canvasA.width, canvasA.height);
    ctxB.fillStyle = backgroundColor;
    ctxB.fillRect(0, 0, canvasB.width, canvasA.height);
    drawRays();
    renderComposite();
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

    centerX = 0.5 * width;
    centerY = 0.5 * height;
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
  initRays();
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

    window.__FOUNDEVER_AURORA_RUNNING__ = false;
  }

  window.FOUNDEVER_AURORA = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) drawTick();
    }
  };
})();

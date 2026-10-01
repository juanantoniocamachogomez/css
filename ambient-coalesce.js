/*!
 * Foundever AIDT Canvas-Coalesce Engine v1.0
 *
 * Adapted from crnacura/AmbientCanvasBackgrounds js/coalesce.js (Codrops/
 * Tympanus): small square particles stream outward from the canvas
 * center, each spinning to face its direction of travel, with a glow
 * compositing pass. See components/_attribution-codrops.md for the
 * license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - Hue is fixed to the Foundever Indigo/Mint band instead of the
 *   original red-to-yellow hue band.
 * - Renders into the loader-created <canvas> (config.target) instead of
 *   appending its own canvas to the page.
 * - Dependency: css-main/ambient-util.js must be loaded before this file
 *   (this effect does not use simplex noise, so ambient-noise.js /
 *   decorative-perlin.js are not required).
 *
 * Config: window.COALESCE_CONFIG (see components/hero-ambient-coalesce.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_COALESCE_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_COALESCE_RUNNING__ = true;

  if (typeof rand !== "function" || typeof angle !== "function") {
    console.error("Canvas-Coalesce requires ambient-util.js to be loaded first.");
    window.__FOUNDEVER_COALESCE_RUNNING__ = false;
    return;
  }

  var config = window.COALESCE_CONFIG || {};

  var canvasB = document.querySelector(config.target || "#coalesce-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvasB || !hero) {
    window.__FOUNDEVER_COALESCE_RUNNING__ = false;
    return;
  }

  var ctxB = canvasB.getContext("2d");
  if (!ctxB) {
    window.__FOUNDEVER_COALESCE_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var particleCount = Math.max(50, Number(config.particleCount) || 700);
  var particlePropCount = 9;
  var particlePropsLength = particleCount * particlePropCount;
  var baseTTL = Number(config.baseTTL) || 100;
  var rangeTTL = Number(config.rangeTTL) || 500;
  var baseSpeed = Number(config.baseSpeed) || 0.1;
  var rangeSpeed = Number(config.rangeSpeed) || 1;
  var baseSize = Number(config.baseSize) || 2;
  var rangeSize = Number(config.rangeSize) || 10;
  var baseHue = Number(config.baseHue) || 235;  /* --fd-indigo hue band */
  var rangeHue = Number(config.rangeHue) || 40;  /* drifts toward --fd-mint */
  var backgroundColor = config.backgroundColor || "hsla(245,50%,3%,1)"; /* near --fd-midnight */

  var canvasA = document.createElement("canvas");
  var ctxA = canvasA.getContext("2d");

  var width = 0, height = 0, centerX = 0, centerY = 0;
  var tick = 0;
  var particleProps = null;
  var isVisible = true, isIntersecting = true, isDestroyed = false;
  var resizeTimer = null;
  var rafId = null;

  function initParticle(i) {
    var x = rand(canvasA.width);
    var y = rand(canvasA.height);
    var theta = angle(x, y, centerX, centerY);

    particleProps.set([
      x, y,
      Math.cos(theta) * 6, Math.sin(theta) * 6,
      0,
      baseTTL + rand(rangeTTL),
      baseSpeed + rand(rangeSpeed),
      baseSize + rand(rangeSize),
      baseHue + rand(rangeHue)
    ], i);
  }

  function initParticles() {
    tick = 0;
    particleProps = new Float32Array(particlePropsLength);
    for (var i = 0; i < particlePropsLength; i += particlePropCount) {
      initParticle(i);
    }
  }

  function drawParticle(x, y, theta, life, ttl, size, hue) {
    var xRel = x - (0.5 * size), yRel = y - (0.5 * size);

    ctxA.save();
    ctxA.lineCap = "round";
    ctxA.lineWidth = 1;
    ctxA.strokeStyle = "hsla(" + hue + ",90%,60%," + fadeInOut(life, ttl) + ")";
    ctxA.beginPath();
    ctxA.translate(xRel, yRel);
    ctxA.rotate(theta);
    ctxA.translate(-xRel, -yRel);
    ctxA.strokeRect(xRel, yRel, size, size);
    ctxA.closePath();
    ctxA.restore();
  }

  function updateParticle(i) {
    var i2 = 1 + i, i3 = 2 + i, i4 = 3 + i, i5 = 4 + i, i6 = 5 + i, i7 = 6 + i, i8 = 7 + i, i9 = 8 + i;
    var x = particleProps[i], y = particleProps[i2];
    var theta = angle(x, y, centerX, centerY) + 0.75 * HALF_PI;
    var vx = lerp(particleProps[i3], 2 * Math.cos(theta), 0.05);
    var vy = lerp(particleProps[i4], 2 * Math.sin(theta), 0.05);
    var life = particleProps[i5], ttl = particleProps[i6], speed = particleProps[i7];
    var x2 = x + vx * speed, y2 = y + vy * speed;
    var size = particleProps[i8], hue = particleProps[i9];

    drawParticle(x, y, theta, life, ttl, size, hue);

    life++;
    particleProps[i] = x2;
    particleProps[i2] = y2;
    particleProps[i3] = vx;
    particleProps[i4] = vy;
    particleProps[i5] = life;

    if (life > ttl) initParticle(i);
  }

  function drawParticles() {
    for (var i = 0; i < particlePropsLength; i += particlePropCount) {
      updateParticle(i);
    }
  }

  function renderGlow() {
    ctxB.save();
    ctxB.filter = "blur(8px) brightness(200%)";
    ctxB.globalCompositeOperation = "lighter";
    ctxB.drawImage(canvasA, 0, 0);
    ctxB.restore();

    ctxB.save();
    ctxB.filter = "blur(4px) brightness(200%)";
    ctxB.globalCompositeOperation = "lighter";
    ctxB.drawImage(canvasA, 0, 0);
    ctxB.restore();
  }

  function renderToScreen() {
    ctxB.save();
    ctxB.globalCompositeOperation = "lighter";
    ctxB.drawImage(canvasA, 0, 0);
    ctxB.restore();
  }

  function drawTick() {
    tick++;
    ctxA.clearRect(0, 0, canvasA.width, canvasA.height);
    ctxB.fillStyle = backgroundColor;
    ctxB.fillRect(0, 0, canvasA.width, canvasA.height);
    drawParticles();
    renderGlow();
    renderToScreen();
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
  initParticles();
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

    window.__FOUNDEVER_COALESCE_RUNNING__ = false;
  }

  window.FOUNDEVER_COALESCE = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) drawTick();
    }
  };
})();

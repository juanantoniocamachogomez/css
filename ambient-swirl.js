/*!
 * Foundever AIDT Canvas-Swirl Engine v1.0
 *
 * Adapted from crnacura/AmbientCanvasBackgrounds js/swirl.js (Codrops/
 * Tympanus): short line-segment particles flow around the canvas center,
 * their direction driven by simplex noise, with a glow compositing pass.
 * See components/_attribution-codrops.md for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - Hue is fixed to the Foundever Indigo/Mint band instead of the
 *   original full blue-to-magenta hue sweep.
 * - Renders into the loader-created <canvas> (config.target) instead of
 *   appending its own canvas to the page.
 * - Dependencies: css-main/decorative-perlin.js, css-main/ambient-noise.js
 *   and css-main/ambient-util.js must all be loaded before this file (in
 *   that order).
 *
 * Config: window.SWIRL_CONFIG (see components/hero-ambient-swirl.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_SWIRL_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_SWIRL_RUNNING__ = true;

  if (typeof window.SimplexNoise !== "function" || typeof rand !== "function") {
    console.error("Canvas-Swirl requires decorative-perlin.js, ambient-noise.js and ambient-util.js to be loaded first.");
    window.__FOUNDEVER_SWIRL_RUNNING__ = false;
    return;
  }

  var config = window.SWIRL_CONFIG || {};

  var canvasB = document.querySelector(config.target || "#swirl-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvasB || !hero) {
    window.__FOUNDEVER_SWIRL_RUNNING__ = false;
    return;
  }

  var ctxB = canvasB.getContext("2d");
  if (!ctxB) {
    window.__FOUNDEVER_SWIRL_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var particleCount = Math.max(50, Number(config.particleCount) || 700);
  var particlePropCount = 9;
  var particlePropsLength = particleCount * particlePropCount;
  var baseTTL = Number(config.baseTTL) || 50;
  var rangeTTL = Number(config.rangeTTL) || 150;
  var baseSpeed = Number(config.baseSpeed) || 0.1;
  var rangeSpeed = Number(config.rangeSpeed) || 2;
  var baseRadius = Number(config.baseRadius) || 1;
  var rangeRadius = Number(config.rangeRadius) || 4;
  var baseHue = Number(config.baseHue) || 235;  /* --fd-indigo hue band */
  var rangeHue = Number(config.rangeHue) || 40;  /* drifts toward --fd-mint */
  var noiseSteps = Number(config.noiseSteps) || 8;
  var xOff = Number(config.xOff) || 0.00125;
  var yOff = Number(config.yOff) || 0.00125;
  var zOff = Number(config.zOff) || 0.0005;
  var backgroundColor = config.backgroundColor || "hsla(245,55%,4%,1)"; /* near --fd-midnight */

  var canvasA = document.createElement("canvas");
  var ctxA = canvasA.getContext("2d");

  var width = 0, height = 0, centerX = 0, centerY = 0;
  var tick = 0;
  var simplex = null;
  var particleProps = null;
  var isVisible = true, isIntersecting = true, isDestroyed = false;
  var resizeTimer = null;
  var rafId = null;

  function initParticle(i) {
    particleProps.set([
      rand(canvasA.width),
      centerY + randRange(100),
      0, 0, 0,
      baseTTL + rand(rangeTTL),
      baseSpeed + rand(rangeSpeed),
      baseRadius + rand(rangeRadius),
      baseHue + rand(rangeHue)
    ], i);
  }

  function initParticles() {
    tick = 0;
    simplex = new window.SimplexNoise();
    particleProps = new Float32Array(particlePropsLength);
    for (var i = 0; i < particlePropsLength; i += particlePropCount) {
      initParticle(i);
    }
  }

  function checkBounds(x, y) {
    return x > canvasA.width || x < 0 || y > canvasA.height || y < 0;
  }

  function drawParticle(x, y, x2, y2, life, ttl, radius, hue) {
    ctxA.save();
    ctxA.lineCap = "round";
    ctxA.lineWidth = radius;
    ctxA.strokeStyle = "hsla(" + hue + ",90%,60%," + fadeInOut(life, ttl) + ")";
    ctxA.beginPath();
    ctxA.moveTo(x, y);
    ctxA.lineTo(x2, y2);
    ctxA.stroke();
    ctxA.closePath();
    ctxA.restore();
  }

  function updateParticle(i) {
    var i2 = 1 + i, i3 = 2 + i, i4 = 3 + i, i5 = 4 + i, i6 = 5 + i, i7 = 6 + i, i8 = 7 + i, i9 = 8 + i;
    var x = particleProps[i], y = particleProps[i2];
    var n = simplex.noise3D(x * xOff, y * yOff, tick * zOff) * noiseSteps * TAU;
    var vx = lerp(particleProps[i3], Math.cos(n), 0.5);
    var vy = lerp(particleProps[i4], Math.sin(n), 0.5);
    var life = particleProps[i5], ttl = particleProps[i6], speed = particleProps[i7];
    var x2 = x + vx * speed, y2 = y + vy * speed;
    var radius = particleProps[i8], hue = particleProps[i9];

    drawParticle(x, y, x2, y2, life, ttl, radius, hue);

    life++;
    particleProps[i] = x2;
    particleProps[i2] = y2;
    particleProps[i3] = vx;
    particleProps[i4] = vy;
    particleProps[i5] = life;

    if (checkBounds(x, y) || life > ttl) initParticle(i);
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

    window.__FOUNDEVER_SWIRL_RUNNING__ = false;
  }

  window.FOUNDEVER_SWIRL = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) drawTick();
    }
  };
})();

/*!
 * Foundever AIDT Canvas-Pipeline Engine v1.0
 *
 * Adapted from crnacura/AmbientCanvasBackgrounds js/pipeline.js (Codrops/
 * Tympanus): point "pipes" travel horizontally from the center, taking
 * random 45deg turns at intervals, leaving faint circular trail marks
 * composited with a blur pass. See components/_attribution-codrops.md
 * for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - Hue is fixed to the Foundever Indigo/Mint band instead of the
 *   original cyan-to-blue hue band.
 * - Renders into the loader-created <canvas> (config.target) instead of
 *   appending its own canvas to the page.
 * - Dependency: css-main/ambient-util.js must be loaded before this file
 *   (this effect does not use simplex noise, so ambient-noise.js /
 *   decorative-perlin.js are not required).
 *
 * Config: window.PIPELINE_CONFIG (see components/hero-ambient-pipeline.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_PIPELINE_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_PIPELINE_RUNNING__ = true;

  if (typeof rand !== "function" || typeof TO_RAD !== "number") {
    console.error("Canvas-Pipeline requires ambient-util.js to be loaded first.");
    window.__FOUNDEVER_PIPELINE_RUNNING__ = false;
    return;
  }

  var config = window.PIPELINE_CONFIG || {};

  var canvasB = document.querySelector(config.target || "#pipeline-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvasB || !hero) {
    window.__FOUNDEVER_PIPELINE_RUNNING__ = false;
    return;
  }

  var ctxB = canvasB.getContext("2d");
  if (!ctxB) {
    window.__FOUNDEVER_PIPELINE_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var pipeCount = Math.max(5, Number(config.pipeCount) || 30);
  var pipePropCount = 8;
  var pipePropsLength = pipeCount * pipePropCount;
  var turnCount = Number(config.turnCount) || 8;
  var turnAmount = (360 / turnCount) * TO_RAD;
  var turnChanceRange = Number(config.turnChanceRange) || 58;
  var baseSpeed = Number(config.baseSpeed) || 0.5;
  var rangeSpeed = Number(config.rangeSpeed) || 1;
  var baseTTL = Number(config.baseTTL) || 100;
  var rangeTTL = Number(config.rangeTTL) || 300;
  var baseWidth = Number(config.baseWidth) || 2;
  var rangeWidth = Number(config.rangeWidth) || 4;
  var baseHue = Number(config.baseHue) || 235;  /* --fd-indigo hue band */
  var rangeHue = Number(config.rangeHue) || 40;  /* drifts toward --fd-mint */
  var backgroundColor = config.backgroundColor || "hsla(245,60%,2%,1)"; /* near --fd-midnight */

  var canvasA = document.createElement("canvas");
  var ctxA = canvasA.getContext("2d");

  var width = 0, height = 0, centerX = 0, centerY = 0;
  var tick = 0;
  var pipeProps = null;
  var isVisible = true, isIntersecting = true, isDestroyed = false;
  var resizeTimer = null;
  var rafId = null;

  function initPipe(i) {
    pipeProps.set([
      rand(canvasA.width), centerY,
      Math.round(rand(1)) ? HALF_PI : TAU - HALF_PI,
      baseSpeed + rand(rangeSpeed),
      0,
      baseTTL + rand(rangeTTL),
      baseWidth + rand(rangeWidth),
      baseHue + rand(rangeHue)
    ], i);
  }

  function initPipes() {
    pipeProps = new Float32Array(pipePropsLength);
    for (var i = 0; i < pipePropsLength; i += pipePropCount) {
      initPipe(i);
    }
  }

  function drawPipe(x, y, life, ttl, lineWidth, hue) {
    ctxA.save();
    ctxA.strokeStyle = "hsla(" + hue + ",80%,55%," + (fadeInOut(life, ttl) * 0.125) + ")";
    ctxA.beginPath();
    ctxA.arc(x, y, lineWidth, 0, TAU);
    ctxA.stroke();
    ctxA.closePath();
    ctxA.restore();
  }

  function updatePipe(i) {
    var i2 = 1 + i, i3 = 2 + i, i4 = 3 + i, i5 = 4 + i, i6 = 5 + i, i7 = 6 + i, i8 = 7 + i;
    var x = pipeProps[i], y = pipeProps[i2], direction = pipeProps[i3], speed = pipeProps[i4];
    var life = pipeProps[i5], ttl = pipeProps[i6], lineWidth = pipeProps[i7], hue = pipeProps[i8];

    drawPipe(x, y, life, ttl, lineWidth, hue);

    life++;
    x += Math.cos(direction) * speed;
    y += Math.sin(direction) * speed;

    var turnChance = !(tick % Math.round(rand(turnChanceRange))) && (!(Math.round(x) % 6) || !(Math.round(y) % 6));
    var turnBias = Math.round(rand(1)) ? -1 : 1;
    direction += turnChance ? turnAmount * turnBias : 0;

    pipeProps[i] = x;
    pipeProps[i2] = y;
    pipeProps[i3] = direction;
    pipeProps[i5] = life;

    if (x > canvasA.width) x = 0;
    if (x < 0) x = canvasA.width;
    if (y > canvasA.height) y = 0;
    if (y < 0) y = canvasA.height;
    pipeProps[i] = x;
    pipeProps[i2] = y;

    if (life > ttl) initPipe(i);
  }

  function updatePipes() {
    tick++;
    for (var i = 0; i < pipePropsLength; i += pipePropCount) {
      updatePipe(i);
    }
  }

  function render() {
    ctxB.save();
    ctxB.fillStyle = backgroundColor;
    ctxB.fillRect(0, 0, canvasB.width, canvasB.height);
    ctxB.restore();

    ctxB.save();
    ctxB.filter = "blur(12px)";
    ctxB.drawImage(canvasA, 0, 0);
    ctxB.restore();

    ctxB.save();
    ctxB.drawImage(canvasA, 0, 0);
    ctxB.restore();
  }

  function drawTick() {
    updatePipes();
    render();
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
      if (!shouldAnimate()) render();
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
  initPipes();
  render();
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

    window.__FOUNDEVER_PIPELINE_RUNNING__ = false;
  }

  window.FOUNDEVER_PIPELINE = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) render();
    }
  };
})();

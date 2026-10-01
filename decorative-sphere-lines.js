/*!
 * Foundever AIDT Canvas-DecorativeSphereLines Engine v1.0
 *
 * Adapted from Mamboleoo/DecorativeBackgrounds demo4.js (Codrops/Tympanus),
 * renamed from "demo4" to describe what it actually draws: a stack of
 * horizontal ring outlines, each displaced radially by simplex noise and
 * scrolling upward through a spherical envelope, forming a wavy "sphere
 * made of lines" that tilts with pointer Y. See
 * components/_attribution-codrops.md for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - TweenMax pointer-tilt easing is replaced with a plain per-frame lerp.
 * - Line color is Foundever Coral in the original demo (0xfe0e55, a red);
 *   kept visually distinct from indigo/mint neighbors but swapped to
 *   Foundever Coral token usage is intentionally NOT used here per the
 *   palette rule (Coral is reserved for error states) — uses Indigo instead.
 * - Dependencies: css-main/vanta/vendor/three.r134.min.js AND
 *   css-main/decorative-perlin.js (window.noise.simplex3) must both be
 *   loaded before this file.
 *
 * Config: window.DECORATIVE_SPHERE_LINES_CONFIG
 * (see components/hero-decorative-sphere-lines.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_DECORATIVE_SPHERE_LINES_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_DECORATIVE_SPHERE_LINES_RUNNING__ = true;

  if (typeof THREE === "undefined" || !window.noise || typeof window.noise.simplex3 !== "function") {
    console.error("Canvas-DecorativeSphereLines requires three.r134.min.js and decorative-perlin.js to be loaded first.");
    window.__FOUNDEVER_DECORATIVE_SPHERE_LINES_RUNNING__ = false;
    return;
  }

  var config = window.DECORATIVE_SPHERE_LINES_CONFIG || {};

  var canvas = document.querySelector(config.target || "#decorative-sphere-lines-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvas || !hero) {
    window.__FOUNDEVER_DECORATIVE_SPHERE_LINES_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var lineColor = config.lineColor || 0x4b4bf9; /* --fd-indigo */
  var linesAmount = Math.max(1, Number(config.linesAmount) || 18);
  var radius = Math.max(10, Number(config.radius) || 100);
  var verticesAmount = Math.max(8, Number(config.verticesAmount) || 50);
  var cameraDistance = Number(config.cameraDistance) || 350;

  var width = 0, height = 0;
  var isVisible = true, isIntersecting = true, isDestroyed = false;
  var resizeTimer = null;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  camera.position.set(0, 0, cameraDistance);

  var sphereGroup = new THREE.Group();
  scene.add(sphereGroup);

  var material = new THREE.LineBasicMaterial({ color: lineColor });

  var lines = [];
  for (var j = 0; j < linesAmount; j++) {
    var positions = new Float32Array((verticesAmount + 1) * 3);
    var baseXZ = [];
    for (var v = 0; v <= verticesAmount; v++) {
      var a = v / verticesAmount * Math.PI * 2;
      baseXZ.push([Math.cos(a), Math.sin(a)]);
    }
    var geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    var line = new THREE.Line(geom, material);
    line.userData.y = (j / linesAmount) * radius * 2;
    line.userData.baseXZ = baseXZ;
    sphereGroup.add(line);
    lines.push(line);
  }

  var targetTiltX = 0;

  function onPointerMove(event) {
    var rect = canvas.getBoundingClientRect();
    var py = (event.clientY - rect.top) / Math.max(1, window.innerHeight);
    targetTiltX = py;
  }

  function resizeCanvas() {
    var rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  var clock = new THREE.Clock();
  var rafId = null;

  function frame() {
    var t = clock.getElapsedTime() * 1000;

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      line.userData.y += 0.3;
      if (line.userData.y > radius * 2) line.userData.y = 0;

      var y = line.userData.y;
      var radiusHeight = Math.sqrt(y * (2 * radius - y));
      var positionsAttr = line.geometry.attributes.position;
      var arr = positionsAttr.array;
      var baseXZ = line.userData.baseXZ;

      for (var vi = 0; vi <= verticesAmount; vi++) {
        var x0 = baseXZ[vi][0];
        var z0 = baseXZ[vi][1];
        var ratio = window.noise.simplex3(x0 * 0.009, z0 * 0.009 + t * 0.0006, y * 0.009) * 15;
        var scaled = radiusHeight + ratio;
        arr[vi * 3] = x0 * scaled;
        arr[vi * 3 + 1] = y - radius;
        arr[vi * 3 + 2] = z0 * scaled;
      }
      positionsAttr.needsUpdate = true;
    }

    sphereGroup.rotation.x += (targetTiltX - sphereGroup.rotation.x) * 0.05;

    renderer.render(scene, camera);
  }

  function renderSingleFrame() {
    renderer.render(scene, camera);
  }

  function shouldAnimate() {
    return !reducedMotion && isVisible && isIntersecting && !isDestroyed;
  }

  function loop() {
    frame();
    rafId = shouldAnimate() ? requestAnimationFrame(loop) : null;
  }

  function startLoop() {
    if (!rafId && shouldAnimate()) {
      clock.start();
      rafId = requestAnimationFrame(loop);
    }
  }

  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (isDestroyed) return;
      resizeCanvas();
      if (!shouldAnimate()) renderSingleFrame();
    }, 200);
  }

  function handleVisibility() {
    isVisible = !document.hidden;
    if (shouldAnimate()) startLoop(); else stopLoop();
  }

  function handleMotionChange(event) {
    reducedMotion = event.matches;
    if (reducedMotion) { stopLoop(); renderSingleFrame(); } else { startLoop(); }
  }

  var observer = null;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(function (entries) {
      isIntersecting = Boolean(entries[0] && entries[0].isIntersecting);
      if (shouldAnimate()) startLoop(); else stopLoop();
    }, { threshold: 0.05 });
    observer.observe(hero);
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);

  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", handleMotionChange);
  } else if (typeof motionQuery.addListener === "function") {
    motionQuery.addListener(handleMotionChange);
  }

  resizeCanvas();
  renderSingleFrame();
  if (shouldAnimate()) startLoop();

  function destroy() {
    isDestroyed = true;
    stopLoop();
    clearTimeout(resizeTimer);

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibility);

    if (observer) observer.disconnect();

    if (typeof motionQuery.removeEventListener === "function") {
      motionQuery.removeEventListener("change", handleMotionChange);
    } else if (typeof motionQuery.removeListener === "function") {
      motionQuery.removeListener(handleMotionChange);
    }

    lines.forEach(function (line) { line.geometry.dispose(); });
    material.dispose();
    renderer.dispose();

    window.__FOUNDEVER_DECORATIVE_SPHERE_LINES_RUNNING__ = false;
  }

  window.FOUNDEVER_DECORATIVE_SPHERE_LINES = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) renderSingleFrame();
    }
  };
})();

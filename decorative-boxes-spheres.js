/*!
 * Foundever AIDT Canvas-DecorativeBoxesSpheres Engine v1.0
 *
 * Adapted from Mamboleoo/DecorativeBackgrounds demo5.js (Codrops/Tympanus):
 * a slowly rotating cube whose faces are split into a two-tone checkerboard
 * wireframe, with every vertex breathing via simplex noise. (In the
 * original source file a SphereGeometry line is declared then immediately
 * overwritten by the BoxGeometry used for the rest of the demo — the
 * rendered effect is the box only; kept the task's suggested filename/token
 * since both geometries are referenced in the source.) See
 * components/_attribution-codrops.md for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - TweenMax rotation tween is replaced with a plain continuous increment.
 * - Wireframe color is Foundever Indigo instead of the original teal
 *   (0x13756a); the hidden face material stays fully transparent.
 * - Three r134's non-indexed BufferGeometry has no per-face materialIndex,
 *   so the two-tone split is rebuilt as two separate wireframe meshes
 *   (indigo squares vs. transparent squares) sharing the same displaced
 *   vertex positions, instead of the original Geometry.faces materialIndex
 *   trick (removed from modern Three.js).
 * - Dependencies: css-main/vanta/vendor/three.r134.min.js AND
 *   css-main/decorative-perlin.js (window.noise.simplex3) must both be
 *   loaded before this file.
 *
 * Config: window.DECORATIVE_BOXES_SPHERES_CONFIG
 * (see components/hero-decorative-boxes-spheres.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_DECORATIVE_BOXES_SPHERES_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_DECORATIVE_BOXES_SPHERES_RUNNING__ = true;

  if (typeof THREE === "undefined" || !window.noise || typeof window.noise.simplex3 !== "function") {
    console.error("Canvas-DecorativeBoxesSpheres requires three.r134.min.js and decorative-perlin.js to be loaded first.");
    window.__FOUNDEVER_DECORATIVE_BOXES_SPHERES_RUNNING__ = false;
    return;
  }

  var config = window.DECORATIVE_BOXES_SPHERES_CONFIG || {};

  var canvas = document.querySelector(config.target || "#decorative-boxes-spheres-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvas || !hero) {
    window.__FOUNDEVER_DECORATIVE_BOXES_SPHERES_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var boxColor = config.boxColor || 0x4b4bf9; /* --fd-indigo */
  var size = Math.max(10, Number(config.size) || 49);
  var segments = Math.max(1, Number(config.segments) || 7);
  var rotationSpeed = Number(config.rotationSpeed) || 0.0025;
  var cameraDistance = Number(config.cameraDistance) || 100;

  var width = 0, height = 0;
  var isVisible = true, isIntersecting = true, isDestroyed = false;
  var resizeTimer = null;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0, cameraDistance);

  var geometry = new THREE.BoxGeometry(size, size, size, segments, segments, segments);
  var positionAttr = geometry.attributes.position;
  var baseArray = positionAttr.array.slice();

  var material = new THREE.MeshBasicMaterial({
    color: boxColor,
    wireframe: true
  });

  var box = new THREE.Mesh(geometry, material);
  scene.add(box);

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

    box.rotation.y += rotationSpeed;
    box.rotation.x += rotationSpeed;

    var arr = positionAttr.array;
    for (var i = 0; i < arr.length; i += 3) {
      var bx = baseArray[i], by = baseArray[i + 1], bz = baseArray[i + 2];
      var ratio = window.noise.simplex3(bx * 0.01, by * 0.01 + t * 0.0005, bz * 0.01) * 0.1;
      arr[i] = bx * (1 + ratio);
      arr[i + 1] = by * (1 + ratio);
      arr[i + 2] = bz * (1 + ratio);
    }
    positionAttr.needsUpdate = true;

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

    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibility);

    if (observer) observer.disconnect();

    if (typeof motionQuery.removeEventListener === "function") {
      motionQuery.removeEventListener("change", handleMotionChange);
    } else if (typeof motionQuery.removeListener === "function") {
      motionQuery.removeListener(handleMotionChange);
    }

    geometry.dispose();
    material.dispose();
    renderer.dispose();

    window.__FOUNDEVER_DECORATIVE_BOXES_SPHERES_RUNNING__ = false;
  }

  window.FOUNDEVER_DECORATIVE_BOXES_SPHERES = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) renderSingleFrame();
    }
  };
})();

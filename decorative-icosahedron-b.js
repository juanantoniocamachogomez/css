/*!
 * Foundever AIDT Canvas-DecorativeIcosahedronB Engine v1.0
 *
 * Adapted from Mamboleoo/DecorativeBackgrounds demo3.js (Codrops/Tympanus):
 * a solid, lit icosahedron whose surface is continuously displaced along
 * simplex noise, producing a slow "breathing blob" look, with pointer-Y
 * nudging the displacement amount. See components/_attribution-codrops.md
 * for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - TweenMax pointer easing is replaced with a plain per-frame lerp.
 * - Emissive color is Foundever Mint instead of the original flat green;
 *   the two directional lights use Indigo instead of purple.
 * - Dependencies: css-main/vanta/vendor/three.r134.min.js AND
 *   css-main/decorative-perlin.js (for window.noise.simplex3) must both be
 *   loaded before this file.
 *
 * Config: window.DECORATIVE_ICOSAHEDRON_B_CONFIG
 * (see components/hero-decorative-icosahedron-b.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_B_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_B_RUNNING__ = true;

  if (typeof THREE === "undefined" || !window.noise || typeof window.noise.simplex3 !== "function") {
    console.error("Canvas-DecorativeIcosahedronB requires three.r134.min.js and decorative-perlin.js to be loaded first.");
    window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_B_RUNNING__ = false;
    return;
  }

  var config = window.DECORATIVE_ICOSAHEDRON_B_CONFIG || {};

  var canvas = document.querySelector(config.target || "#decorative-icosahedron-b-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvas || !hero) {
    window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_B_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var radius = Math.max(10, Number(config.radius) || 120);
  var detail = Math.max(1, Number(config.detail) || 4);
  var noiseScale = Number(config.noiseScale) || 0.006;
  var noiseSpeed = Number(config.noiseSpeed) || 0.0002;
  var emissiveColor = config.emissiveColor || 0x8bf0bb; /* --fd-mint */
  var lightColor = config.lightColor || 0x4b4bf9; /* --fd-indigo */
  var cameraDistance = Number(config.cameraDistance) || 300;

  var width = 0, height = 0;
  var isVisible = true, isIntersecting = true, isDestroyed = false;
  var resizeTimer = null;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(100, 1, 0.1, 10000);
  camera.position.set(radius, 0, cameraDistance);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x09092d, 0.6));

  var lightA = new THREE.DirectionalLight(lightColor, 0.5);
  lightA.position.set(200, 300, 400);
  scene.add(lightA);

  var lightB = lightA.clone();
  lightB.position.set(-200, 300, 400);
  scene.add(lightB);

  var geometry = new THREE.IcosahedronGeometry(radius, detail);
  var positionAttr = geometry.attributes.position;
  var baseArray = positionAttr.array.slice();

  var material = new THREE.MeshPhongMaterial({
    emissive: emissiveColor,
    emissiveIntensity: 0.4,
    shininess: 0
  });

  var shape = new THREE.Mesh(geometry, material);
  scene.add(shape);

  var pointer = new THREE.Vector2(0.8, 0.5);
  var targetPointerY = 0.5;

  function onPointerMove(event) {
    var rect = canvas.getBoundingClientRect();
    targetPointerY = (event.clientY - rect.top) / height;
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
    pointer.y += (targetPointerY - pointer.y) * 0.08;

    var array = positionAttr.array;
    for (var i = 0; i < array.length; i += 3) {
      var bx = baseArray[i], by = baseArray[i + 1], bz = baseArray[i + 2];
      var n = window.noise.simplex3(bx * noiseScale + t * noiseSpeed, by * noiseScale + t * (noiseSpeed * 1.5), bz * noiseScale);
      var ratio = (n * 0.4 * (pointer.y + 0.1)) + 0.8;
      array[i] = bx * ratio;
      array[i + 1] = by * ratio;
      array[i + 2] = bz * ratio;
    }
    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();

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

    geometry.dispose();
    material.dispose();
    renderer.dispose();

    window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_B_RUNNING__ = false;
  }

  window.FOUNDEVER_DECORATIVE_ICOSAHEDRON_B = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) renderSingleFrame();
    }
  };
})();

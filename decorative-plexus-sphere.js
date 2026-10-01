/*!
 * Foundever AIDT Canvas-DecorativePlexusSphere Engine v1.0
 *
 * Adapted from Mamboleoo/DecorativeBackgrounds demo6.js (Codrops/Tympanus),
 * renamed from "demo6" to describe what it draws: a ball formed by many
 * latitude-line rings, each rippling with an independent sine wave, slowly
 * auto-rotating, in two alternating line colors. See
 * components/_attribution-codrops.md for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - Two line colors are Foundever Indigo (majority) and Mint (accent,
 *   ~20% of lines) instead of the original dark-grey / blue-violet pair.
 * - Dependency: css-main/vanta/vendor/three.r134.min.js must be loaded
 *   first; this file adds no new copy of Three.js. No noise dependency
 *   (this demo uses a plain sine wave, not simplex noise).
 *
 * Config: window.DECORATIVE_PLEXUS_SPHERE_CONFIG
 * (see components/hero-decorative-plexus-sphere.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_DECORATIVE_PLEXUS_SPHERE_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_DECORATIVE_PLEXUS_SPHERE_RUNNING__ = true;

  if (typeof THREE === "undefined") {
    console.error("Canvas-DecorativePlexusSphere requires three.r134.min.js to be loaded first.");
    window.__FOUNDEVER_DECORATIVE_PLEXUS_SPHERE_RUNNING__ = false;
    return;
  }

  var config = window.DECORATIVE_PLEXUS_SPHERE_CONFIG || {};

  var canvas = document.querySelector(config.target || "#decorative-plexus-sphere-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvas || !hero) {
    window.__FOUNDEVER_DECORATIVE_PLEXUS_SPHERE_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var baseColor = config.baseColor || 0x4b4bf9; /* --fd-indigo */
  var accentColor = config.accentColor || 0x8bf0bb; /* --fd-mint */
  var lineCount = Math.max(1, Number(config.lineCount) || 50);
  var dotsPerLine = Math.max(4, Number(config.dotsPerLine) || 50);
  var radius = Math.max(10, Number(config.radius) || 100);
  var cameraDistance = Number(config.cameraDistance) || 280;

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

  var baseMaterial = new THREE.LineBasicMaterial({ color: baseColor });
  var accentMaterial = new THREE.LineBasicMaterial({ color: accentColor });

  var lines = [];
  for (var i = 0; i < lineCount; i++) {
    var lineRadius = Math.floor(radius + (Math.random() - 0.5) * (radius * 0.2));
    var positions = new Float32Array((dotsPerLine + 1) * 3);
    for (var j = 0; j <= dotsPerLine; j++) {
      var x = ((j / dotsPerLine) * lineRadius * 2) - lineRadius;
      positions[j * 3] = x;
      positions[j * 3 + 1] = 0;
      positions[j * 3 + 2] = 0;
    }
    var geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    var line = new THREE.Line(geom, Math.random() > 0.2 ? baseMaterial : accentMaterial);
    line.userData.speed = Math.random() * 300 + 250;
    line.userData.radius = lineRadius;
    line.rotation.x = Math.random() * Math.PI;
    line.rotation.y = Math.random() * Math.PI;
    line.rotation.z = Math.random() * Math.PI;

    sphereGroup.add(line);
    lines.push(line);
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
      var positionsAttr = line.geometry.attributes.position;
      var arr = positionsAttr.array;
      var lineRadius = line.userData.radius;

      for (var vi = 0; vi <= dotsPerLine; vi++) {
        var vx = arr[vi * 3];
        var ratio = 1 - ((lineRadius - Math.abs(vx)) / lineRadius);
        arr[vi * 3 + 1] = Math.sin(t / line.userData.speed + vi * 0.15) * 12 * ratio;
      }
      positionsAttr.needsUpdate = true;
    }

    sphereGroup.rotation.y = t * 0.0001;
    sphereGroup.rotation.x = -t * 0.0001;

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

    lines.forEach(function (line) { line.geometry.dispose(); });
    baseMaterial.dispose();
    accentMaterial.dispose();
    renderer.dispose();

    window.__FOUNDEVER_DECORATIVE_PLEXUS_SPHERE_RUNNING__ = false;
  }

  window.FOUNDEVER_DECORATIVE_PLEXUS_SPHERE = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) renderSingleFrame();
    }
  };
})();

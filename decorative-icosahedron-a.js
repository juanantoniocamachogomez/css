/*!
 * Foundever AIDT Canvas-DecorativeIcosahedronA Engine v1.0
 *
 * Adapted from Mamboleoo/DecorativeBackgrounds demo2.js (Codrops/Tympanus):
 * the vertices of an icosahedron sphere pulse in and out towards the Y axis
 * on a yoyo loop, forming a breathing wireframe-like dot cloud; the whole
 * thing tilts gently toward the pointer. See
 * components/_attribution-codrops.md for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - TweenMax/GSAP easing is replaced with a plain sine-based oscillator
 *   (per-vertex phase/duration), since this project does not vendor GSAP.
 * - The external img/dotTexture.png sprite is replaced with a radial-
 *   gradient texture generated on an offscreen <canvas> at boot.
 * - Single color (Foundever Mint) instead of the original flat green fill.
 * - Dependency: css-main/vanta/vendor/three.r134.min.js must be loaded
 *   first; this file adds no new copy of Three.js.
 *
 * Config: window.DECORATIVE_ICOSAHEDRON_A_CONFIG
 * (see components/hero-decorative-icosahedron-a.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_A_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_A_RUNNING__ = true;

  if (typeof THREE === "undefined") {
    console.error("Canvas-DecorativeIcosahedronA requires three.r134.min.js to be loaded first.");
    window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_A_RUNNING__ = false;
    return;
  }

  var config = window.DECORATIVE_ICOSAHEDRON_A_CONFIG || {};

  var canvas = document.querySelector(config.target || "#decorative-icosahedron-a-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvas || !hero) {
    window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_A_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var radius = Math.max(10, Number(config.radius) || 50);
  var detail = Math.max(1, Number(config.detail) || 5);
  var dotColor = config.dotColor || 0x4b4bf9; /* --fd-indigo */
  var cameraDistance = Number(config.cameraDistance) || 80;

  var width = 0, height = 0;
  var isVisible = true, isIntersecting = true, isDestroyed = false;
  var resizeTimer = null;

  function makeDotTexture() {
    var size = 64;
    var tex = document.createElement("canvas");
    tex.width = size;
    tex.height = size;
    var tctx = tex.getContext("2d");
    var gradient = tctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    tctx.fillStyle = gradient;
    tctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(tex);
  }

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.set(0, 0, cameraDistance);

  var icoGeometry = new THREE.IcosahedronGeometry(radius, detail);
  var vertexCount = icoGeometry.attributes.position.count;
  var positions = icoGeometry.attributes.position.array.slice();
  var basePositions = positions.slice();
  var phases = new Float32Array(vertexCount);
  var durations = new Float32Array(vertexCount);
  var delays = new Float32Array(vertexCount);

  for (var i = 0; i < vertexCount; i++) {
    phases[i] = Math.random() * Math.PI * 2;
    durations[i] = Math.random() * 3 + 3;
    delays[i] = Math.abs(basePositions[i * 3 + 1] / radius) * 2;
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  var dotTexture = makeDotTexture();
  var material = new THREE.PointsMaterial({
    size: 2.4,
    map: dotTexture,
    color: dotColor,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true
  });

  var dots = new THREE.Points(geometry, material);
  scene.add(dots);

  var pointer = new THREE.Vector2(0.8, 0.5);
  var targetRotX = 0, targetRotZ = 0;

  function onPointerMove(event) {
    var rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / width - 0.5;
    pointer.y = (event.clientY - rect.top) / height - 0.5;
    targetRotX = pointer.y * Math.PI * 0.5;
    targetRotZ = pointer.x * Math.PI * 0.2;
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
    var elapsed = clock.getElapsedTime();

    for (var i2 = 0; i2 < vertexCount; i2++) {
      var t = elapsed - delays[i2];
      var ratio = t > 0 ? (Math.sin(t / durations[i2] * Math.PI * 2 + phases[i2]) + 1) / 2 : 0;
      positions[i2 * 3] = basePositions[i2 * 3] * ratio;
      positions[i2 * 3 + 2] = basePositions[i2 * 3 + 2] * ratio;
    }
    geometry.attributes.position.needsUpdate = true;

    dots.rotation.x += (targetRotX - dots.rotation.x) * 0.05;
    dots.rotation.z += (targetRotZ - dots.rotation.z) * 0.05;

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

    icoGeometry.dispose();
    geometry.dispose();
    material.dispose();
    dotTexture.dispose();
    renderer.dispose();

    window.__FOUNDEVER_DECORATIVE_ICOSAHEDRON_A_RUNNING__ = false;
  }

  window.FOUNDEVER_DECORATIVE_ICOSAHEDRON_A = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) renderSingleFrame();
    }
  };
})();

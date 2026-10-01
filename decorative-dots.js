/*!
 * Foundever AIDT Canvas-DecorativeDots Engine v1.0
 *
 * Adapted from Mamboleoo/DecorativeBackgrounds demo1.js (Codrops/Tympanus):
 * a 3D field of orbiting dots connected by faint segments when close enough,
 * with a pointer-hover "pop" on the nearest dots. See
 * components/_attribution-codrops.md for the license note.
 *
 * Adaptation notes (deviations from the original demo, by design):
 * - TweenMax/GSAP easing is replaced with a plain per-frame lerp, since this
 *   project does not vendor GSAP.
 * - The external img/dotTexture.png sprite is replaced with a radial-gradient
 *   texture generated on an offscreen <canvas> at boot (no new binary asset).
 * - Colors are the Foundever palette (indigo / mint / white) instead of the
 *   original demo's red/purple/grey.
 * - Dependency: css-main/vanta/vendor/three.r134.min.js (already vendored in
 *   this project for the Vanta engines) must be loaded first; this file adds
 *   no new copy of Three.js.
 *
 * Config: window.DECORATIVE_DOTS_CONFIG (see components/hero-decorative-dots.md)
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_DECORATIVE_DOTS_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_DECORATIVE_DOTS_RUNNING__ = true;

  if (typeof THREE === "undefined") {
    console.error("Canvas-DecorativeDots requires three.r134.min.js to be loaded first.");
    window.__FOUNDEVER_DECORATIVE_DOTS_RUNNING__ = false;
    return;
  }

  var config = window.DECORATIVE_DOTS_CONFIG || {};

  var canvas = document.querySelector(config.target || "#decorative-dots-canvas");
  var hero = document.querySelector(config.hero || "#top");

  if (!canvas || !hero) {
    window.__FOUNDEVER_DECORATIVE_DOTS_RUNNING__ = false;
    return;
  }

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = motionQuery.matches;

  var dotCount = Math.max(50, Number(config.dotCount) || 900);
  var connectDistance = Math.max(1, Number(config.connectDistance) || 12);
  var hoverRadius = Math.max(1, Number(config.hoverRadius) || 6);
  var cameraDistance = Number(config.cameraDistance) || 350;

  var colors = (Array.isArray(config.colors) && config.colors.length ? config.colors : [
    0x4b4bf9, /* --fd-indigo */
    0x8bf0bb, /* --fd-mint */
    0xeeeef8  /* near-white, matches shapeshifter's light dot */
  ]).map(function (hex) { return new THREE.Color(hex); });

  var width = 0;
  var height = 0;
  var isVisible = true;
  var isIntersecting = true;
  var isDestroyed = false;
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

  var dotTexture = makeDotTexture();

  var basePositions = [];
  var driftSeeds = [];
  var positions = new Float32Array(dotCount * 3);
  var sizes = new Float32Array(dotCount);
  var colorAttr = new Float32Array(dotCount * 3);

  for (var i = 0; i < dotCount; i++) {
    var theta = Math.random() * Math.PI * 2;
    var phi = (1 - Math.sqrt(Math.random())) * (Math.PI / 2) * (Math.random() > 0.5 ? 1 : -1);
    var vector = new THREE.Vector3(
      Math.cos(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.sin(theta) * Math.cos(phi)
    ).multiplyScalar(120 + (Math.random() - 0.5) * 5);

    basePositions.push(vector);
    driftSeeds.push({
      amp: (Math.random() - 0.5) * 0.2 + 1,
      speed: Math.random() * 0.6 + 0.3,
      phase: Math.random() * Math.PI * 2
    });

    vector.toArray(positions, i * 3);
    sizes[i] = 5;

    var color = colors[Math.floor(Math.random() * colors.length)];
    color.toArray(colorAttr, i * 3);
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("color", new THREE.BufferAttribute(colorAttr, 3));

  var material = new THREE.PointsMaterial({
    size: 5,
    map: dotTexture,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true
  });

  var points = new THREE.Points(geometry, material);
  scene.add(points);

  var lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25
  });
  var lineGeometry = new THREE.BufferGeometry();
  var segments = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(segments);

  function rebuildSegments() {
    var verts = [];
    for (var a = 0; a < dotCount; a++) {
      var ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      for (var b = a + 1; b < dotCount; b++) {
        var bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
        var dx = ax - bx, dy = ay - by, dz = az - bz;
        if (dx * dx + dy * dy + dz * dz < connectDistance * connectDistance) {
          verts.push(ax, ay, az, bx, by, bz);
        }
      }
    }
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  }

  var pointer = new THREE.Vector2(-100, -100);
  var raycaster = new THREE.Raycaster();
  raycaster.params.Points = raycaster.params.Points || {};
  raycaster.params.Points.threshold = hoverRadius;

  function onPointerMove(event) {
    var rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / height) * 2 + 1;
  }

  function onPointerLeave() {
    pointer.set(-100, -100);
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

    for (var i2 = 0; i2 < dotCount; i2++) {
      var base = basePositions[i2];
      var seed = driftSeeds[i2];
      var t = Math.sin(elapsed * seed.speed + seed.phase);
      var scale = 1 + t * (seed.amp - 1) * 0.5;
      positions[i2 * 3] = base.x * scale;
      positions[i2 * 3 + 1] = base.y * scale;
      positions[i2 * 3 + 2] = base.z * scale;

      var dx = positions[i2 * 3] - pointer.x * 140;
      var dy = positions[i2 * 3 + 1] - pointer.y * 140;
      var dist = Math.sqrt(dx * dx + dy * dy);
      sizes[i2] = dist < hoverRadius * 10 ? 10 : 5;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;

    if (Math.floor(elapsed * 4) % 4 === 0) {
      rebuildSegments();
    }

    raycaster.setFromCamera(pointer, camera);

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
    if (shouldAnimate()) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }

  function startLoop() {
    if (!rafId && shouldAnimate()) {
      clock.start();
      rafId = requestAnimationFrame(loop);
    }
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
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

  hero.addEventListener("pointermove", onPointerMove, { passive: true });
  hero.addEventListener("pointerleave", onPointerLeave, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);

  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", handleMotionChange);
  } else if (typeof motionQuery.addListener === "function") {
    motionQuery.addListener(handleMotionChange);
  }

  resizeCanvas();
  rebuildSegments();
  renderSingleFrame();

  if (shouldAnimate()) {
    startLoop();
  }

  function destroy() {
    isDestroyed = true;
    stopLoop();
    clearTimeout(resizeTimer);

    hero.removeEventListener("pointermove", onPointerMove);
    hero.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibility);

    if (observer) observer.disconnect();

    if (typeof motionQuery.removeEventListener === "function") {
      motionQuery.removeEventListener("change", handleMotionChange);
    } else if (typeof motionQuery.removeListener === "function") {
      motionQuery.removeListener(handleMotionChange);
    }

    geometry.dispose();
    lineGeometry.dispose();
    material.dispose();
    lineMaterial.dispose();
    dotTexture.dispose();
    renderer.dispose();

    window.__FOUNDEVER_DECORATIVE_DOTS_RUNNING__ = false;
  }

  window.FOUNDEVER_DECORATIVE_DOTS = {
    version: "1.0",
    destroy: destroy,
    resize: function () {
      resizeCanvas();
      if (!shouldAnimate()) renderSingleFrame();
    }
  };
})();

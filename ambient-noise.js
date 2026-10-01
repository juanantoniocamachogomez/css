/*!
 * Foundever AIDT ambient-noise.js
 * Shared dependency: SimplexNoise adapter for the ambient-*.js engines.
 *
 * The original crnacura/AmbientCanvasBackgrounds demos load a third-party
 * `simplex-noise` CDN package that exposes `new SimplexNoise().noise3D(x,y,z)`.
 * The AIDT loader never pulls a third-party CDN (see
 * window.AIDT_ASSET_LOADER docs), and this project already vendors an
 * equivalent noise implementation for the decorative-*.js engines
 * (css-main/decorative-perlin.js, exposing window.noise.simplex3). Rather
 * than vendoring a second noise library, this file adapts that same one:
 * load order is decorative-perlin.js -> ambient-noise.js -> ambient-util.js
 * -> the ambient-*.js engine.
 *
 * No window.__FOUNDEVER_*_RUNNING__ guard here on purpose: this is a
 * stateless vendor math shim, not an engine instance.
 */

(function () {
  "use strict";

  if (typeof window.noise === "undefined" || typeof window.noise.simplex3 !== "function") {
    console.error("ambient-noise.js requires decorative-perlin.js to be loaded first.");
    return;
  }

  function SimplexNoise() {
    // Reseed per instance, matching the original demos creating
    // `new SimplexNoise()` once per engine boot for varied runs.
    window.noise.seed(Math.random());
  }

  SimplexNoise.prototype.noise3D = function (x, y, z) {
    return window.noise.simplex3(x, y, z);
  };

  window.SimplexNoise = SimplexNoise;
})();

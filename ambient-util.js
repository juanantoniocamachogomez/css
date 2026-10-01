/*!
 * Foundever AIDT ambient-util.js
 * Shared dependency: small math helpers used by every ambient-*.js engine.
 *
 * Vendored as-is (unmodified) from crnacura/AmbientCanvasBackgrounds
 * (js/util.js). See components/_attribution-codrops.md.
 *
 * Load this BEFORE ambient-noise.js and any css-main/ambient-*.js engine
 * (aurora, swirl, shift, coalesce, pipeline). No
 * window.__FOUNDEVER_*_RUNNING__ guard here on purpose: this is a stateless
 * vendor math library, not an engine instance.
 */

const { PI, cos, sin, abs, sqrt, pow, round, random, atan2 } = Math;
const HALF_PI = 0.5 * PI;
const TAU = 2 * PI;
const TO_RAD = PI / 180;
const floor = n => n | 0;
const rand = n => n * random();
const randIn = (min, max) => rand(max - min) + min;
const randRange = n => n - rand(2 * n);
const fadeIn = (t, m) => t / m;
const fadeOut = (t, m) => (m - t) / m;
const fadeInOut = (t, m) => {
	let hm = 0.5 * m;
	return abs((t + hm) % m - hm) / (hm);
};
const dist = (x1, y1, x2, y2) => sqrt(pow(x2 - x1, 2) + pow(y2 - y1, 2));
const angle = (x1, y1, x2, y2) => atan2(y2 - y1, x2 - x1);
const lerp = (n1, n2, speed) => (1 - speed) * n1 + speed * n2;

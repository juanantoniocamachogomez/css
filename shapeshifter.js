/*!
 * Foundever AIDT ShapeShifter Engine v3.2
 * CDN Edition
 *
 * Faithful adaptation of Kenneth Cachia's Shape Shifter particle physics.
 * Palette: Foundever brand tokens
 * Year: 2026
 *
 * v3.2 changes:
 * - Prevents particles from moving to the top-left corner
 * - Completes missing waypoint coordinates before queueing
 * - Uses explicit numeric validation instead of logical OR fallbacks
 * - Normalizes sampled shape coordinates
 * - Calculates the real shape width and height
 * - Keeps new particles invisible at the canvas center
 * - Protects against invalid and non-finite coordinates
 * - Prevents duplicate engine initialization
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_SHAPESHIFTER_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_SHAPESHIFTER_RUNNING__ = true;

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var canvas = document.getElementById("ss-canvas");

  if (!canvas) {
    window.__FOUNDEVER_SHAPESHIFTER_RUNNING__ = false;
    return;
  }

  var ctx = canvas.getContext("2d");

  if (!ctx) {
    window.__FOUNDEVER_SHAPESHIFTER_RUNNING__ = false;
    return;
  }

  var config = window.SHAPESHIFTER_CONFIG || {};

  var GAP =
    typeof config.gap === "number" &&
    isFinite(config.gap) &&
    config.gap >= 6
      ? Math.floor(config.gap)
      : 13;

  var MAX_FONT =
    typeof config.maxFontSize === "number" &&
    isFinite(config.maxFontSize) &&
    config.maxFontSize > 0
      ? config.maxFontSize
      : 500;

  var CYCLE_MS =
    typeof config.interval === "number" &&
    isFinite(config.interval) &&
    config.interval >= 1000
      ? config.interval
      : 4200;

  var COLOR_POOL = [
    [255, 255, 255],
    [139, 240, 187],
    [75, 75, 249],
    [238, 238, 248],
    [139, 240, 187],
    [255, 255, 255]
  ];

  var DEFAULT_WORDS = [
    "AI Deployment Team",
    "EverAssist",
    "EverCoach",
    "EverGPT",
    "Adoption",
    "Impact",
    "Foundever",
    "AI Team"
  ];

  var WORDS =
    Array.isArray(config.words) && config.words.length > 0
      ? config.words
          .filter(function (word) {
            return typeof word === "string" && word.trim().length > 0;
          })
          .map(function (word) {
            return word.trim();
          })
      : DEFAULT_WORDS.slice();

  if (WORDS.length === 0) {
    WORDS = DEFAULT_WORDS.slice();
  }

  var wordIndex = 0;
  var area = {
    w: 0,
    h: 0
  };

  var dots = [];
  var shapeWidth = 0;
  var shapeHeight = 0;
  var animId = null;
  var cycleTimer = null;
  var resizeTimer = null;
  var isVisible = true;
  var isDestroyed = false;

  var shapeCanvas = document.createElement("canvas");
  var shapeCtx = shapeCanvas.getContext("2d", {
    willReadFrequently: true
  });

  function isValidNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function validOr(value, fallback) {
    return isValidNumber(value) ? value : fallback;
  }

  function getCanvasSize() {
    var hero = document.getElementById("top");
    var rect = hero ? hero.getBoundingClientRect() : null;

    var width =
      rect && rect.width > 0
        ? rect.width
        : window.innerWidth;

    var height =
      rect && rect.height > 0
        ? rect.height
        : window.innerHeight;

    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height))
    };
  }

  function adjustCanvas() {
    var size = getCanvasSize();

    area.w = size.width;
    area.h = size.height;

    if (canvas.width !== area.w) {
      canvas.width = area.w;
    }

    if (canvas.height !== area.h) {
      canvas.height = area.h;
    }
  }

  function fitShapeCanvas() {
    shapeCanvas.width = Math.max(
      GAP,
      Math.floor(area.w / GAP) * GAP
    );

    shapeCanvas.height = Math.max(
      GAP,
      Math.floor(area.h / GAP) * GAP
    );
  }

  function buildShape(word) {
    var sw = shapeCanvas.width;
    var sh = shapeCanvas.height;

    if (!sw || !sh || !shapeCtx) {
      return {
        dots: [],
        w: 0,
        h: 0
      };
    }

    shapeCtx.clearRect(0, 0, sw, sh);
    shapeCtx.fillStyle = "#FFFFFF";
    shapeCtx.textBaseline = "middle";
    shapeCtx.textAlign = "center";

    shapeCtx.font =
      "700 " +
      MAX_FONT +
      "px Calibri, Arial, Helvetica, sans-serif";

    var measured = shapeCtx.measureText(word);
    var measuredWidth = Math.max(1, measured.width);

    var widthSize = (sw * 0.8 * MAX_FONT) / measuredWidth;
    var heightSize = sh * 0.45;

    var fontSize = Math.floor(
      Math.max(
        12,
        Math.min(MAX_FONT, widthSize, heightSize)
      )
    );

    shapeCtx.font =
      "700 " +
      fontSize +
      "px Calibri, Arial, Helvetica, sans-serif";

    shapeCtx.fillText(word, sw / 2, sh / 2);

    var imageData;

    try {
      imageData = shapeCtx.getImageData(0, 0, sw, sh);
    } catch (error) {
      console.warn("ShapeShifter could not sample the text shape.", error);

      return {
        dots: [],
        w: 0,
        h: 0
      };
    }

    var pixels = imageData.data;
    var sampledDots = [];

    var minX = sw;
    var minY = sh;
    var maxX = 0;
    var maxY = 0;

    var x;
    var y;
    var pixelIndex;

    for (y = 0; y < sh; y += GAP) {
      for (x = 0; x < sw; x += GAP) {
        pixelIndex = (y * sw + x) * 4;

        if (pixels[pixelIndex + 3] > 0) {
          sampledDots.push({
            x: x,
            y: y
          });

          if (x < minX) {
            minX = x;
          }

          if (x > maxX) {
            maxX = x;
          }

          if (y < minY) {
            minY = y;
          }

          if (y > maxY) {
            maxY = y;
          }
        }
      }
    }

    if (sampledDots.length === 0) {
      return {
        dots: [],
        w: 0,
        h: 0
      };
    }

    var normalizedDots = sampledDots.map(function (dot) {
      return {
        x: dot.x - minX,
        y: dot.y - minY
      };
    });

    return {
      dots: normalizedDots,
      w: Math.max(GAP, maxX - minX),
      h: Math.max(GAP, maxY - minY)
    };
  }

  function Point(args) {
    args = args || {};

    this.x = args.x;
    this.y = args.y;
    this.z = args.z;
    this.a = args.a;
    this.h = args.h;
  }

  function Dot(x, y) {
    var safeX = validOr(x, area.w / 2);
    var safeY = validOr(y, area.h / 2);

    var color =
      COLOR_POOL[
        Math.floor(Math.random() * COLOR_POOL.length)
      ];

    this.p = new Point({
      x: safeX,
      y: safeY,
      z: 0,
      a: 0,
      h: 0
    });

    this.t = new Point({
      x: safeX,
      y: safeY,
      z: 0,
      a: 0,
      h: 0
    });

    this.e = 0.07;
    this.s = true;
    this.r = color[0];
    this.g = color[1];
    this.b = color[2];
    this.q = [];
  }

  Dot.prototype.distanceTo = function (point, details) {
    var targetX = validOr(point && point.x, this.p.x);
    var targetY = validOr(point && point.y, this.p.y);

    var dx = this.p.x - targetX;
    var dy = this.p.y - targetY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    return details
      ? [dx, dy, distance]
      : distance;
  };

  Dot.prototype.move = function (point, avoidStatic) {
    point = point || {};

    /*
     * Critical v3.2 correction:
     * Every queued waypoint receives valid coordinates.
     * A visual-only waypoint can no longer become (0, 0).
     */
    var safePoint = new Point({
      x: validOr(point.x, this.p.x),
      y: validOr(point.y, this.p.y),
      z: validOr(point.z, this.p.z),
      a: validOr(point.a, this.p.a),
      h: validOr(point.h, 0)
    });

    if (
      !avoidStatic ||
      this.distanceTo(safePoint) > 1
    ) {
      this.q.push(safePoint);
    }
  };

  Dot.prototype._moveTowards = function (point) {
    if (!point) {
      return true;
    }

    point.x = validOr(point.x, this.p.x);
    point.y = validOr(point.y, this.p.y);

    var details = this.distanceTo(point, true);
    var dx = details[0];
    var dy = details[1];
    var distance = details[2];

    if (!isValidNumber(distance)) {
      this.p.x = validOr(this.p.x, area.w / 2);
      this.p.y = validOr(this.p.y, area.h / 2);
      return true;
    }

    if (this.p.h === -1) {
      this.p.x = point.x;
      this.p.y = point.y;
      return true;
    }

    if (distance > 1) {
      var easing = this.e * distance;

      this.p.x -= (dx / distance) * easing;
      this.p.y -= (dy / distance) * easing;

      if (!isValidNumber(this.p.x)) {
        this.p.x = area.w / 2;
      }

      if (!isValidNumber(this.p.y)) {
        this.p.y = area.h / 2;
      }
    } else if (this.p.h > 0) {
      this.p.h--;
    } else {
      return true;
    }

    return false;
  };

  Dot.prototype._update = function () {
    if (this._moveTowards(this.t)) {
      var nextPoint = this.q.shift();

      if (nextPoint) {
        /*
         * Explicit validation preserves valid zero coordinates
         * while rejecting undefined, NaN and Infinity.
         */
        this.t.x = validOr(nextPoint.x, this.p.x);
        this.t.y = validOr(nextPoint.y, this.p.y);
        this.t.z = validOr(nextPoint.z, this.p.z);
        this.t.a = validOr(nextPoint.a, this.p.a);
        this.p.h = validOr(nextPoint.h, 0);
      } else if (this.s) {
        this.p.x -= Math.sin(Math.random() * Math.PI);
        this.p.y -= Math.sin(Math.random() * Math.PI);
      } else {
        this.move(
          new Point({
            x: this.p.x + Math.random() * 50 - 25,
            y: this.p.y + Math.random() * 50 - 25,
            z: this.p.z,
            a: this.p.a,
            h: 0
          })
        );
      }
    }

    var alphaDifference = this.p.a - this.t.a;

    this.p.a = Math.max(
      0.1,
      this.p.a - alphaDifference * 0.05
    );

    var radiusDifference = this.p.z - this.t.z;

    this.p.z = Math.max(
      1,
      this.p.z - radiusDifference * 0.05
    );

    if (!isValidNumber(this.p.a)) {
      this.p.a = 0.1;
    }

    if (!isValidNumber(this.p.z)) {
      this.p.z = 1;
    }
  };

  Dot.prototype._draw = function () {
    if (
      !isValidNumber(this.p.x) ||
      !isValidNumber(this.p.y) ||
      !isValidNumber(this.p.z) ||
      !isValidNumber(this.p.a)
    ) {
      return;
    }

    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, this.p.a)
    );

    ctx.fillStyle =
      "rgb(" +
      this.r +
      "," +
      this.g +
      "," +
      this.b +
      ")";

    ctx.beginPath();

    ctx.arc(
      this.p.x,
      this.p.y,
      Math.max(0.1, this.p.z),
      0,
      2 * Math.PI,
      true
    );

    ctx.closePath();
    ctx.fill();
  };

  Dot.prototype.render = function () {
    this._update();
    this._draw();
  };

  function compensate() {
    return {
      x: Math.round(area.w / 2 - shapeWidth / 2),
      y: Math.round(area.h / 2 - shapeHeight / 2)
    };
  }

  function addRequiredDots(requiredAmount) {
    var amountToAdd = requiredAmount - dots.length;

    if (amountToAdd <= 0) {
      return;
    }

    var centerX = area.w / 2;
    var centerY = area.h / 2;

    for (var index = 0; index < amountToAdd; index++) {
      dots.push(new Dot(centerX, centerY));
    }
  }

  function switchShape(shape, fast) {
    if (!shape || !Array.isArray(shape.dots)) {
      return;
    }

    shapeWidth = validOr(shape.w, 0);
    shapeHeight = validOr(shape.h, 0);

    var offset = compensate();
    var shapeDots = shape.dots.slice();

    addRequiredDots(shapeDots.length);

    var dotIndex = 0;

    while (shapeDots.length > 0 && dotIndex < dots.length) {
      var randomIndex = Math.floor(
        Math.random() * shapeDots.length
      );

      var shapePoint = shapeDots[randomIndex];
      var dot = dots[dotIndex];

      dot.e = fast
        ? 0.25
        : dot.s
          ? 0.14
          : 0.11;

      /*
       * All visual transition points retain the current
       * particle coordinates explicitly.
       */
      if (dot.s) {
        dot.move(
          new Point({
            x: dot.p.x,
            y: dot.p.y,
            z: Math.random() * 20 + 10,
            a: Math.random(),
            h: 18
          })
        );
      } else {
        dot.move(
          new Point({
            x: dot.p.x,
            y: dot.p.y,
            z: Math.random() * 5 + 5,
            a: dot.p.a,
            h: fast ? 18 : 30
          })
        );
      }

      dot.s = true;

      dot.move(
        new Point({
          x: shapePoint.x + offset.x,
          y: shapePoint.y + offset.y,
          a: 1,
          z: 5,
          h: 0
        })
      );

      shapeDots.splice(randomIndex, 1);
      dotIndex++;
    }

    for (
      var excessIndex = dotIndex;
      excessIndex < dots.length;
      excessIndex++
    ) {
      var excessDot = dots[excessIndex];

      if (excessDot.s) {
        excessDot.move(
          new Point({
            x: excessDot.p.x,
            y: excessDot.p.y,
            z: Math.random() * 20 + 10,
            a: Math.random(),
            h: 20
          })
        );

        excessDot.s = false;
        excessDot.e = 0.04;

        excessDot.move(
          new Point({
            x: Math.random() * area.w,
            y: Math.random() * area.h,
            a: 0.3,
            z: Math.random() * 4,
            h: 0
          })
        );
      }
    }
  }

  function frame() {
    if (
      isDestroyed ||
      !isVisible ||
      reducedMotion
    ) {
      animId = null;
      return;
    }

    ctx.clearRect(0, 0, area.w, area.h);

    for (var index = 0; index < dots.length; index++) {
      dots[index].render();
    }

    ctx.globalAlpha = 1;
    animId = requestAnimationFrame(frame);
  }

  function renderSingleFrame() {
    ctx.clearRect(0, 0, area.w, area.h);

    for (var index = 0; index < dots.length; index++) {
      dots[index]._draw();
    }

    ctx.globalAlpha = 1;
  }

  function startLoop() {
    if (
      !animId &&
      isVisible &&
      !isDestroyed &&
      !reducedMotion
    ) {
      animId = requestAnimationFrame(frame);
    }
  }

  function stopLoop() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function showNextWord() {
    if (isDestroyed || WORDS.length === 0) {
      return;
    }

    var word = WORDS[wordIndex];
    var shape = buildShape(word);

    switchShape(shape, wordIndex === 0);

    wordIndex = (wordIndex + 1) % WORDS.length;
  }

  function startCycle() {
    if (cycleTimer) {
      clearInterval(cycleTimer);
    }

    showNextWord();

    if (!reducedMotion && WORDS.length > 1) {
      cycleTimer = window.setInterval(
        showNextWord,
        CYCLE_MS
      );
    }
  }

  function waitForSize(callback, attempts) {
    attempts = attempts || 0;

    adjustCanvas();

    if (area.w > 1 && area.h > 1) {
      callback();
      return;
    }

    if (attempts >= 60) {
      callback();
      return;
    }

    requestAnimationFrame(function () {
      waitForSize(callback, attempts + 1);
    });
  }

  function boot() {
    if (isDestroyed) {
      return;
    }

    waitForSize(function () {
      fitShapeCanvas();
      startCycle();

      if (reducedMotion) {
        /*
         * Place the first word immediately for a static,
         * accessible reduced-motion presentation.
         */
        dots.forEach(function (dot) {
          while (dot.q.length > 0) {
            var finalPoint = dot.q.shift();

            dot.p.x = validOr(finalPoint.x, dot.p.x);
            dot.p.y = validOr(finalPoint.y, dot.p.y);
            dot.p.z = validOr(finalPoint.z, dot.p.z);
            dot.p.a = validOr(finalPoint.a, dot.p.a);
          }
        });

        renderSingleFrame();
      } else {
        startLoop();
      }
    });
  }

  function handleResize() {
    clearTimeout(resizeTimer);

    resizeTimer = window.setTimeout(function () {
      if (isDestroyed) {
        return;
      }

      adjustCanvas();
      fitShapeCanvas();

      var currentWordIndex =
        (wordIndex - 1 + WORDS.length) % WORDS.length;

      var shape = buildShape(WORDS[currentWordIndex]);

      switchShape(shape, true);

      if (reducedMotion) {
        renderSingleFrame();
      }
    }, 200);
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      isVisible = false;
      stopLoop();
    } else {
      isVisible = true;
      startLoop();
    }
  }

  function destroy() {
    isDestroyed = true;

    stopLoop();
    clearTimeout(resizeTimer);

    if (cycleTimer) {
      clearInterval(cycleTimer);
      cycleTimer = null;
    }

    window.removeEventListener("resize", handleResize);
    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.__FOUNDEVER_SHAPESHIFTER_RUNNING__ = false;
  }

  window.addEventListener("resize", handleResize);

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  if (typeof IntersectionObserver !== "undefined") {
    var heroElement = document.getElementById("top");

    if (heroElement) {
      var observer = new IntersectionObserver(
        function (entries) {
          var entry = entries[0];

          if (!entry) {
            return;
          }

          isVisible = entry.isIntersecting;

          if (isVisible) {
            startLoop();
          } else {
            stopLoop();
          }
        },
        {
          threshold: 0
        }
      );

      observer.observe(heroElement);
    }
  }

  window.FOUNDEVER_SHAPESHIFTER = {
    version: "3.2",
    destroy: destroy,
    next: showNextWord,
    rebuild: function () {
      adjustCanvas();
      fitShapeCanvas();

      var currentWordIndex =
        (wordIndex - 1 + WORDS.length) % WORDS.length;

      switchShape(
        buildShape(WORDS[currentWordIndex]),
        true
      );
    }
  };

  /*
   * Dynamic loaders can inject this file after the window load event.
   * For that reason, interactive and complete states boot immediately.
   */
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    boot();
  } else {
    window.addEventListener("load", boot, {
      once: true
    });
  }
})();

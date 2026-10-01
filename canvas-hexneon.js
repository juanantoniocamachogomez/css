/*!
 * Foundever AIDT Canvas-HexNeon Engine v1.0
 * Native inline Canvas 2D implementation
 *
 * Reads configuration from window.HEXNEON_CONFIG.
 * No external dependencies.
 */

(function () {
  "use strict";

  if (window.__FOUNDEVER_HEXNEON_RUNNING__) {
    return;
  }

  window.__FOUNDEVER_HEXNEON_RUNNING__ = true;

  var config = window.HEXNEON_CONFIG || {};
  var canvas = document.querySelector(
    config.target || "#hexneon-canvas"
  );
  var hero = document.querySelector(
    config.hero || ".custom-hexneon-hero"
  );

  if (!canvas || !hero) {
    window.__FOUNDEVER_HEXNEON_RUNNING__ = false;
    document.body.style.opacity = "1";
    return;
  }

  var context = canvas.getContext("2d");

  if (!context) {
    canvas.hidden = true;
    window.__FOUNDEVER_HEXNEON_RUNNING__ = false;
    document.body.style.opacity = "1";
    return;
  }

  var state = {
    width: 0,
    height: 0,
    ratio: 1,
    frame: 0,
    resizeTimer: 0,
    visible: true,
    intersecting: true,
    reducedMotion: false,
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
    startTime: performance.now()
  };

  var radius = Math.max(18, Number(config.radius) || 42);
  var gap = Math.max(0, Number(config.gap) || 5);
  var lineWidth = Math.max(
    0.5,
    Number(config.lineWidth) || 1.15
  );
  var activeLineWidth = Math.max(
    lineWidth,
    Number(config.activeLineWidth) || 1.8
  );
  var pointerRadius = Math.max(
    radius,
    Number(config.pointerRadius) || 190
  );
  var drift = Math.max(0, Number(config.drift) || 18);
  var speed = Math.max(
    0.00005,
    Number(config.speed) || 0.00032
  );
  var maxRatio = Math.max(
    1,
    Number(config.maxDevicePixelRatio) || 2
  );

  var lineColor =
    config.lineColor || "rgba(75, 75, 249, 0.34)";
  var activeColor =
    config.activeColor || "rgba(139, 240, 187, 0.9)";
  var glowColor =
    config.glowColor || "rgba(75, 75, 249, 0.55)";

  var motionQuery = window.matchMedia
    ? window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      )
    : null;

  state.reducedMotion = Boolean(
    motionQuery && motionQuery.matches
  );

  function resizeCanvas() {
    var bounds = hero.getBoundingClientRect();

    state.width = Math.max(
      1,
      Math.round(bounds.width)
    );
    state.height = Math.max(
      1,
      Math.round(bounds.height)
    );
    state.ratio = Math.min(
      maxRatio,
      Math.max(1, window.devicePixelRatio || 1)
    );

    canvas.width = Math.round(
      state.width * state.ratio
    );
    canvas.height = Math.round(
      state.height * state.ratio
    );
    canvas.style.width = state.width + "px";
    canvas.style.height = state.height + "px";

    context.setTransform(
      state.ratio,
      0,
      0,
      state.ratio,
      0,
      0
    );
  }

  function drawHexagon(x, y, size) {
    context.beginPath();

    for (var side = 0; side < 6; side += 1) {
      var angle =
        Math.PI / 3 * side + Math.PI / 6;
      var pointX = x + Math.cos(angle) * size;
      var pointY = y + Math.sin(angle) * size;

      if (side === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }

    context.closePath();
  }

  function distanceToPointer(x, y) {
    if (!state.pointerActive) {
      return Infinity;
    }

    var dx = state.pointerX - x;
    var dy = state.pointerY - y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  function draw(time) {
    context.clearRect(
      0,
      0,
      state.width,
      state.height
    );

    var horizontalStep =
      Math.sqrt(3) * (radius + gap);
    var verticalStep =
      1.5 * (radius + gap);

    var phase = state.reducedMotion
      ? 0
      : (time - state.startTime) * speed;

    var driftX = Math.cos(phase) * drift;
    var driftY = Math.sin(phase * 0.82) * drift;

    var columns =
      Math.ceil(state.width / horizontalStep) + 4;
    var rows =
      Math.ceil(state.height / verticalStep) + 4;

    context.lineJoin = "round";
    context.lineCap = "round";

    for (var row = -2; row < rows; row += 1) {
      for (
        var column = -2;
        column < columns;
        column += 1
      ) {
        var offset =
          row % 2 === 0 ? 0 : horizontalStep / 2;

        var x =
          column * horizontalStep +
          offset +
          driftX;

        var y =
          row * verticalStep +
          driftY;

        var distance = distanceToPointer(x, y);
        var influence = Math.max(
          0,
          1 - distance / pointerRadius
        );

        var pulse = state.reducedMotion
          ? 0.2
          : (
              Math.sin(
                phase * 3 +
                row * 0.34 +
                column * 0.28
              ) +
              1
            ) / 2;

        var ambient = 0.08 + pulse * 0.18;
        var alpha = Math.min(
          1,
          ambient + influence * 0.88
        );

        drawHexagon(x, y, radius);

        context.strokeStyle =
          influence > 0.08
            ? activeColor
            : lineColor;

        context.globalAlpha = alpha;
        context.lineWidth =
          lineWidth +
          influence *
          (activeLineWidth - lineWidth);

        context.shadowColor = glowColor;
        context.shadowBlur =
          influence > 0.08
            ? 5 + influence * 16
            : pulse * 3;

        context.stroke();
      }
    }

    context.globalAlpha = 1;
    context.shadowBlur = 0;
  }

  function shouldAnimate() {
    return (
      !state.reducedMotion &&
      state.visible &&
      state.intersecting
    );
  }

  function render(time) {
    draw(time);

    if (shouldAnimate()) {
      state.frame = requestAnimationFrame(render);
    } else {
      state.frame = 0;
    }
  }

  function requestRender() {
    if (!state.frame) {
      state.frame = requestAnimationFrame(render);
    }
  }

  function stopAnimation() {
    if (state.frame) {
      cancelAnimationFrame(state.frame);
      state.frame = 0;
    }
  }

  function updatePointer(event) {
    var bounds = canvas.getBoundingClientRect();

    state.pointerX = event.clientX - bounds.left;
    state.pointerY = event.clientY - bounds.top;
    state.pointerActive = true;

    requestRender();
  }

  function clearPointer() {
    state.pointerActive = false;
    requestRender();
  }

  function handleVisibility() {
    state.visible = !document.hidden;

    if (shouldAnimate()) {
      requestRender();
    } else {
      stopAnimation();
      draw(performance.now());
    }
  }

  function handleResize() {
    window.clearTimeout(state.resizeTimer);

    state.resizeTimer = window.setTimeout(
      function () {
        resizeCanvas();
        requestRender();
      },
      140
    );
  }

  function handleMotionChange(event) {
    state.reducedMotion = event.matches;

    if (state.reducedMotion) {
      stopAnimation();
      draw(performance.now());
    } else {
      state.startTime = performance.now();
      requestRender();
    }
  }

  var observer = null;

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      function (entries) {
        state.intersecting = Boolean(
          entries[0] && entries[0].isIntersecting
        );

        if (shouldAnimate()) {
          requestRender();
        } else {
          stopAnimation();
        }
      },
      {
        threshold: 0.05
      }
    );

    observer.observe(hero);
  }

  hero.addEventListener(
    "pointermove",
    updatePointer,
    { passive: true }
  );
  hero.addEventListener(
    "pointerleave",
    clearPointer,
    { passive: true }
  );
  window.addEventListener(
    "resize",
    handleResize,
    { passive: true }
  );
  document.addEventListener(
    "visibilitychange",
    handleVisibility
  );

  if (motionQuery) {
    if (
      typeof motionQuery.addEventListener ===
      "function"
    ) {
      motionQuery.addEventListener(
        "change",
        handleMotionChange
      );
    } else if (
      typeof motionQuery.addListener === "function"
    ) {
      motionQuery.addListener(handleMotionChange);
    }
  }

  resizeCanvas();
  draw(performance.now());

  if (shouldAnimate()) {
    requestRender();
  }

  window.FOUNDEVER_HEXNEON = {
    version: "1.0",
    redraw: function () {
      resizeCanvas();
      requestRender();
    },
    destroy: function () {
      stopAnimation();
      window.clearTimeout(state.resizeTimer);

      hero.removeEventListener(
        "pointermove",
        updatePointer
      );
      hero.removeEventListener(
        "pointerleave",
        clearPointer
      );
      window.removeEventListener(
        "resize",
        handleResize
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      if (observer) {
        observer.disconnect();
      }

      if (motionQuery) {
        if (
          typeof motionQuery.removeEventListener ===
          "function"
        ) {
          motionQuery.removeEventListener(
            "change",
            handleMotionChange
          );
        } else if (
          typeof motionQuery.removeListener ===
          "function"
        ) {
          motionQuery.removeListener(
            handleMotionChange
          );
        }
      }

      context.clearRect(
        0,
        0,
        state.width,
        state.height
      );

      window.__FOUNDEVER_HEXNEON_RUNNING__ = false;
    }
  };

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.body.style.opacity = "1";
    });
  });
})();

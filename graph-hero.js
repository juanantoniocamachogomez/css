/*! GRAPH-HERO v1.0 - 2025-07-14
    Config-driven knowledge-network canvas for the Blue Graph-Hero.
    Reads window.GRAPH_HERO_CONFIG = { labels: [...], connections: [...] }
    Place config inline BEFORE this script. */

(function () {
  "use strict";

  // ── Configuration ──────────────────────────────────────────────
  var config = window.GRAPH_HERO_CONFIG || null;

  var FALLBACK_LABELS = [
    "AI", "NLP", "RAG", "deployment", "adoption", "quality",
    "analytics", "training", "CSAT", "AHT", "compliance",
    "knowledge", "automation", "coaching", "multilingual",
    "sentiment", "embeddings", "grounding", "vector-search",
    "prompt-engineering", "evaluation", "integration"
  ];

  var DESKTOP_COUNT_MIN = 60;
  var DESKTOP_COUNT_MAX = 65;
  var MOBILE_COUNT_MIN = 28;
  var MOBILE_COUNT_MAX = 35;
  var MOBILE_BREAKPOINT = 760;
  var CONNECTION_DISTANCE = 165;
  var PROXIMITY_RANGE = 210;
  var DPR_CAP = 2;
  var RESIZE_DEBOUNCE = 110;
  var BASE_VELOCITY = 0.2;
  var MAX_VELOCITY = 0.5;

  // Core colors
var INDIGO = { r: 75, g: 75, b: 249 };
var MINT = { r: 139, g: 240, b: 187 };
var MIDNIGHT = { r: 9, g: 9, b: 45 };
var WHITE = { r: 255, g: 255, b: 255 };
var STONE = { r: 243, g: 243, b: 247 };

// Supporting accent colors
var YELLOW = { r: 246, g: 245, b: 103 };
var SAND = { r: 212, g: 203, b: 188 };
var PINK = { r: 255, g: 164, b: 164 };
var GREEN = { r: 140, g: 240, b: 188 };
var LIGHT_BLUE = { r: 159, g: 188, b: 254 };

// Extended Midnight colors
var MIDNIGHT_DEEP = { r: 7, g: 7, b: 36 };
var MIDNIGHT_1 = { r: 22, g: 18, b: 70 };
var MIDNIGHT_2 = { r: 26, g: 23, b: 93 };
var MIDNIGHT_3 = { r: 34, g: 33, b: 102 };

// Extended Indigo colors
var INDIGO_DEEP = { r: 30, g: 30, b: 100 };
var INDIGO_1 = { r: 44, g: 44, b: 144 };
var INDIGO_2 = { r: 60, g: 60, b: 198 };
var INDIGO_LIGHT = { r: 93, g: 93, b: 249 };

// Extended Stone colors
var STONE_DARK = { r: 219, g: 219, b: 222 };
var STONE_MID = { r: 231, g: 231, b: 236 };
var STONE_LIGHT = { r: 248, g: 248, b: 250 };

// Status colors
var SUCCESS = { r: 245, g: 245, b: 103 };
var ERROR = { r: 234, g: 93, b: 90 };

  // ── State ──────────────────────────────────────────────────────
  var hero, wrap, canvas, ctx;
  var nodes = [];
  var rafId = null;
  var canvasW = 0, canvasH = 0;
  var dpr = 1;
  var pointerX = -9999, pointerY = -9999;
  var pointerActive = false;
  var reducedMotion = false;
  var prevWidth = 0, prevHeight = 0;
  var resizeTimer = null;
  var isHidden = false;

  // ── Label management ───────────────────────────────────────────

  function buildLabelPool() {
    var pool = [];
    if (config && config.labels && config.labels.length > 0) {
      for (var i = 0; i < config.labels.length; i++) {
        var item = config.labels[i];
        var text = typeof item === "string" ? item : (item.text || "");
        var weight = (typeof item === "object" && item.weight) ? item.weight : 1;
        if (text) {
          pool.push({ text: text, weight: weight });
        }
      }
    }
    if (pool.length === 0) {
      for (var f = 0; f < FALLBACK_LABELS.length; f++) {
        pool.push({ text: FALLBACK_LABELS[f], weight: 1 });
      }
    }
    return pool;
  }

  function buildPreferredConnections() {
    var pairs = [];
    if (config && config.connections && config.connections.length > 0) {
      for (var i = 0; i < config.connections.length; i++) {
        var c = config.connections[i];
        if (c.length >= 2) {
          pairs.push([c[0].toLowerCase(), c[1].toLowerCase()]);
        }
      }
    }
    return pairs;
  }

  // ── Node creation ──────────────────────────────────────────────

  function getNodeCount() {
    var isMobile = canvasW < MOBILE_BREAKPOINT;
    var min = isMobile ? MOBILE_COUNT_MIN : DESKTOP_COUNT_MIN;
    var max = isMobile ? MOBILE_COUNT_MAX : DESKTOP_COUNT_MAX;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function createNode(index, total, labelPool, w, h) {
    var labelItem = labelPool[index % labelPool.length];
    var isIndigo = Math.random() < 0.7;
    var color = isIndigo ? INDIGO : MINT;
    var baseRadius = 3 + Math.random() * 2.5;
    var weightScale = labelItem.weight === 3 ? 1.3 : (labelItem.weight === 2 ? 1.1 : 1);
    var radius = baseRadius * weightScale;
    var margin = 40;
    var x = margin + Math.random() * (w - margin * 2);
    var y = margin + Math.random() * (h - margin * 2);

    var angle = Math.random() * Math.PI * 2;
    var speed = BASE_VELOCITY * (0.75 + Math.random() * 0.5);
    var vx = Math.cos(angle) * speed;
    var vy = Math.sin(angle) * speed;

    var baseFontSize = 9 + (labelItem.weight - 1) * 2 + Math.random() * 2;

    return {
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      radius: radius,
      baseRadius: radius,
      color: color,
      label: labelItem.text,
      weight: labelItem.weight,
      fontSize: Math.min(baseFontSize, 14),
      phase: Math.random() * Math.PI * 2,
      coreAlpha: 0.55 + Math.random() * 0.1,
      labelAlpha: 0.45 + Math.random() * 0.1,
      currentCoreAlpha: 0.6,
      currentLabelAlpha: 0.5,
      currentFontWeight: 600,
      currentHalo: 0
    };
  }

  function buildNodes() {
    var pool = buildLabelPool();
    var count = getNodeCount();
    // Do not exceed available labels (avoid meaningless duplicates)
    if (count > pool.length * 3) {
      count = pool.length * 3;
    }
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push(createNode(i, count, pool, canvasW, canvasH));
    }
  }

  // ── Canvas sizing ──────────────────────────────────────────────

  function measureAndSize() {
    if (!wrap) return false;
    var rect = wrap.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if (w < 1 || h < 1) return false;

    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvasW = w;
    canvasH = h;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    prevWidth = w;
    prevHeight = h;
    return true;
  }

  // ── Physics ────────────────────────────────────────────────────

  function updatePhysics(time) {
    var margin = 30;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];

      // Drift
      n.x += n.vx;
      n.y += n.vy;

      // Clamp velocity
      var v = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (v > MAX_VELOCITY) {
        n.vx = (n.vx / v) * MAX_VELOCITY;
        n.vy = (n.vy / v) * MAX_VELOCITY;
      }

      // Soft boundary bounce
      if (n.x < margin) { n.x = margin; n.vx = Math.abs(n.vx) * 0.8; }
      if (n.x > canvasW - margin) { n.x = canvasW - margin; n.vx = -Math.abs(n.vx) * 0.8; }
      if (n.y < margin) { n.y = margin; n.vy = Math.abs(n.vy) * 0.8; }
      if (n.y > canvasH - margin) { n.y = canvasH - margin; n.vy = -Math.abs(n.vy) * 0.8; }

      // Pulse radius
      var pulse = Math.sin(time * 0.001 + n.phase) * 0.2;
      n.radius = n.baseRadius * (1 + pulse);

      // Pointer proximity
      var dx = n.x - pointerX;
      var dy = n.y - pointerY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var proximity = 0;
      if (pointerActive && dist < PROXIMITY_RANGE) {
        proximity = 1 - dist / PROXIMITY_RANGE;
        proximity = proximity * proximity; // Quadratic easing
      }

      var targetCore = n.coreAlpha + proximity * (0.92 - n.coreAlpha);
      var targetLabel = n.labelAlpha + proximity * (0.90 - n.labelAlpha);
      var targetWeight = proximity > 0.1 ? 800 : 600;
      var targetHalo = proximity * 0.18;

      var lerp = 0.07;
      n.currentCoreAlpha += (targetCore - n.currentCoreAlpha) * lerp;
      n.currentLabelAlpha += (targetLabel - n.currentLabelAlpha) * lerp;
      n.currentFontWeight += (targetWeight - n.currentFontWeight) * lerp;
      n.currentHalo += (targetHalo - n.currentHalo) * lerp;
    }
  }

  // ── Rendering ──────────────────────────────────────────────────

  function render(time) {
    ctx.clearRect(0, 0, canvasW, canvasH);

    var preferredPairs = buildPreferredConnections();

    // Connections
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i];
        var b = nodes[j];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        var maxDist = CONNECTION_DISTANCE;

        // Check preferred connection - extend range
        var isPreferred = false;
        var aLabel = a.label.toLowerCase();
        var bLabel = b.label.toLowerCase();
        for (var p = 0; p < preferredPairs.length; p++) {
          if ((preferredPairs[p][0] === aLabel && preferredPairs[p][1] === bLabel) ||
              (preferredPairs[p][1] === aLabel && preferredPairs[p][0] === bLabel)) {
            isPreferred = true;
            maxDist = CONNECTION_DISTANCE * 1.8;
            break;
          }
        }

        if (dist > maxDist) continue;

        var alpha = (1 - dist / maxDist) * 0.25;
        if (isPreferred) alpha *= 1.4;

        // Brighten near pointer
        var midX = (a.x + b.x) * 0.5;
        var midY = (a.y + b.y) * 0.5;
        var pdx = midX - pointerX;
        var pdy = midY - pointerY;
        var pDist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pointerActive && pDist < PROXIMITY_RANGE) {
          var pProx = 1 - pDist / PROXIMITY_RANGE;
          alpha = Math.min(alpha + pProx * 0.2, 0.5);
        }

        var lineWidth = 0.7;
        if (pointerActive && pDist < PROXIMITY_RANGE) {
          lineWidth += (1 - pDist / PROXIMITY_RANGE) * 0.8;
        }

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(" + INDIGO.r + "," + INDIGO.g + "," + INDIGO.b + "," + alpha.toFixed(3) + ")";
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }

    // Nodes and labels
    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];

      // Halo
      if (n.currentHalo > 0.005) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.min(n.radius + 18, 22), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + n.color.r + "," + n.color.g + "," + n.color.b + "," + n.currentHalo.toFixed(3) + ")";
        ctx.fill();
      }

      // Outer ring
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(" + n.color.r + "," + n.color.g + "," + n.color.b + "," + (n.currentCoreAlpha * 0.4).toFixed(3) + ")";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Core
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + n.color.r + "," + n.color.g + "," + n.color.b + "," + n.currentCoreAlpha.toFixed(3) + ")";
      ctx.fill();

      // Label
      var fw = Math.round(n.currentFontWeight);
      var fs = n.fontSize;
      ctx.font = fw + " " + fs + "px 'Foundever Sans', Calibri, Arial, sans-serif";
      ctx.fillStyle = "rgba(" + MIDNIGHT.r + "," + MIDNIGHT.g + "," + MIDNIGHT.b + "," + n.currentLabelAlpha.toFixed(3) + ")";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(n.label, n.x, n.y + n.radius + 5);
    }
  }

  // ── Animation loop ─────────────────────────────────────────────

  function loop(time) {
    if (isHidden) return;
    updatePhysics(time);
    render(time);
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // ── Resize handling ────────────────────────────────────────────

  function handleResize() {
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    if (Math.abs(rect.width - prevWidth) < 1 && Math.abs(rect.height - prevHeight) < 1) return;

    var oldW = canvasW || rect.width;
    var oldH = canvasH || rect.height;

    measureAndSize();

    // Proportionally reposition
    var scaleX = canvasW / oldW;
    var scaleY = canvasH / oldH;
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].x = Math.max(30, Math.min(canvasW - 30, nodes[i].x * scaleX));
      nodes[i].y = Math.max(30, Math.min(canvasH - 30, nodes[i].y * scaleY));
    }

    // Adjust node count for breakpoint
    var targetCount = getNodeCount();
    if (nodes.length > targetCount + 5) {
      nodes.length = targetCount;
    } else if (nodes.length < targetCount - 5) {
      var pool = buildLabelPool();
      while (nodes.length < targetCount) {
        nodes.push(createNode(nodes.length, targetCount, pool, canvasW, canvasH));
      }
    }

    if (reducedMotion) {
      render(performance.now());
    }
  }

  function debouncedResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleResize, RESIZE_DEBOUNCE);
  }

  // ── Pointer tracking ──────────────────────────────────────────

  function onPointerMove(e) {
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
    pointerActive = true;
  }

  function onPointerLeave() {
    pointerActive = false;
  }

  // ── Visibility API ─────────────────────────────────────────────

  function onVisibilityChange() {
    if (document.hidden) {
      isHidden = true;
      stopLoop();
    } else {
      isHidden = false;
      if (!reducedMotion) {
        startLoop();
      }
    }
  }

  // ── Initialization ─────────────────────────────────────────────

  function init() {
    hero = document.querySelector(".custom-graph-hero");
    if (!hero) return;

    wrap = hero.querySelector(".custom-graph-wrap");
    if (!wrap) return;

    canvas = wrap.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      wrap.appendChild(canvas);
    }

    ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check reduced motion
    var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = motionQuery.matches;
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener("change", function (e) {
        reducedMotion = e.matches;
        if (reducedMotion) {
          stopLoop();
          render(performance.now());
        } else if (!isHidden) {
          startLoop();
        }
      });
    }

    // Wait for fonts, then measure
    var afterFonts = function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!measureAndSize()) {
            // Retry once more after a short delay
            setTimeout(function () {
              if (measureAndSize()) {
                buildNodes();
                if (reducedMotion) {
                  render(performance.now());
                } else {
                  startLoop();
                }
              }
            }, 200);
            return;
          }
          buildNodes();
          if (reducedMotion) {
            render(performance.now());
          } else {
            startLoop();
          }
        });
      });
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(afterFonts);
    } else {
      afterFonts();
    }

    // Pointer events on the hero (not the canvas, which has pointer-events: none)
    hero.addEventListener("mousemove", onPointerMove);
    hero.addEventListener("mouseleave", onPointerLeave);
    hero.addEventListener("touchmove", function (e) {
      if (e.touches.length === 1) {
        onPointerMove(e.touches[0]);
      }
    }, { passive: true });
    hero.addEventListener("touchend", onPointerLeave);

    // ResizeObserver (primary)
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () {
        debouncedResize();
      });
      ro.observe(wrap);
    }

    // Window resize (fallback)
    window.addEventListener("resize", debouncedResize);

    // Visibility
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  // ── Entry point ────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

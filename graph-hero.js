/*! GRAPH-HERO v1.2 - 2025-07-14
    Config-driven knowledge-network canvas for Blue Graph-Hero and Section Graph.
    Reads window.GRAPH_HERO_CONFIG = { targets: [...], labels: [...], connections: [...] }
    Place config inline BEFORE this script.
    Supports multiple independent graph instances via the targets array.

    When GRAPH_HERO_CONFIG is missing or incomplete, the engine infers labels and
    relationships from the page's own headings (h2/h3) and repeated strong/bold terms
    instead of refusing to render. Inferred graphs are never presented as verified data:
    window.FOUNDEVER_GRAPH_HERO.inferred reports whether the current graph was inferred,
    so the surrounding markup can show the required "inferred, not verified" notice. */

(function () {
  "use strict";

  // ── Configuration validation ───────────────────────────────────
  function validateGraphConfig(cfg) {
    return Boolean(
      cfg &&
      Array.isArray(cfg.targets) && cfg.targets.length > 0 &&
      Array.isArray(cfg.labels) && cfg.labels.length > 0 &&
      Array.isArray(cfg.connections) && cfg.connections.length > 0
    );
  }

  // ── Inference from page content (used only when config is absent/incomplete) ──
  function inferGraphFromDOM() {
    var labels = [];
    var seenLabels = {};

    function addLabel(text, weight) {
      text = (text || "").trim();
      if (!text || text.length > 40) return null;
      var key = text.toLowerCase();
      if (seenLabels[key]) {
        if (weight > seenLabels[key].weight) seenLabels[key].weight = weight;
        return seenLabels[key];
      }
      var item = { text: text, weight: weight };
      seenLabels[key] = item;
      labels.push(item);
      return item;
    }

    // Section headings become anchor nodes.
    var headingEls = document.querySelectorAll("h2, h3");
    var headingNodes = [];
    for (var i = 0; i < headingEls.length; i++) {
      var item = addLabel(headingEls[i].textContent, 2);
      if (item) headingNodes.push({ el: headingEls[i], text: item.text });
    }

    // Repeated strong/bold terms become supporting nodes.
    var scope = document.querySelector(".custom-graph-hero") || document;
    var strongEls = scope.querySelectorAll("strong, b");
    var counts = {};
    var order = [];
    for (var j = 0; j < strongEls.length; j++) {
      var txt = (strongEls[j].textContent || "").trim();
      if (!txt || txt.length > 40) continue;
      var key = txt.toLowerCase();
      if (!counts[key]) {
        counts[key] = { text: txt, count: 0, el: strongEls[j] };
        order.push(key);
      }
      counts[key].count++;
    }

    var termNodes = [];
    for (var m = 0; m < order.length; m++) {
      var c = counts[order[m]];
      if (c.count >= 2) {
        var termItem = addLabel(c.text, c.count >= 4 ? 3 : 2);
        if (termItem) termNodes.push({ el: c.el, text: termItem.text });
      }
    }

    if (labels.length === 0) return null;

    // Connect each repeated term to the nearest preceding heading (its section).
    function nearestHeadingBefore(el) {
      var best = null;
      for (var h = 0; h < headingNodes.length; h++) {
        if (headingNodes[h].el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
          best = headingNodes[h];
        }
      }
      return best;
    }

    var connections = [];
    for (var n = 0; n < termNodes.length; n++) {
      var near = nearestHeadingBefore(termNodes[n].el);
      if (near && near.text.toLowerCase() !== termNodes[n].text.toLowerCase()) {
        connections.push([near.text, termNodes[n].text]);
      }
    }

    // Fall back to heading-to-heading sequence so an inferred graph with only
    // headings still shows relationships instead of isolated dots.
    if (connections.length === 0 && headingNodes.length > 1) {
      for (var p = 0; p < headingNodes.length - 1; p++) {
        connections.push([headingNodes[p].text, headingNodes[p + 1].text]);
      }
    }

    return { labels: labels, connections: connections };
  }

  // ── Configuration ──────────────────────────────────────────────
  // Resolved inside init() (after DOMContentLoaded) so inference can read the
  // fully-parsed page. `isInferred` and `config` are module-scoped so the rest
  // of the engine (buildLabelPool, buildPreferredConnections, getTargets) can
  // keep reading the single `config` closure variable unchanged.
  var config = null;
  var isInferred = false;

  function resolveConfig() {
    var rawConfig = window.GRAPH_HERO_CONFIG || null;
    if (validateGraphConfig(rawConfig)) {
      config = rawConfig;
      isInferred = false;
    } else {
      var inferred = inferGraphFromDOM();
      isInferred = true;
      config = {
        targets: (rawConfig && rawConfig.targets && rawConfig.targets.length > 0) ? rawConfig.targets : null,
        labels: inferred ? inferred.labels : [],
        connections: inferred ? inferred.connections : []
      };
      console.info("Graph-Hero: no verified GRAPH_HERO_CONFIG found; rendering an inferred, unverified graph from page content.");
    }
    window.FOUNDEVER_GRAPH_HERO = { inferred: isInferred, version: "1.2" };
  }

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

  // ── Active instances registry ──────────────────────────────────
  var instances = [];

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

  // ── Detect dark background ─────────────────────────────────────

  function isDarkContext(el) {
    // Check if the element or ancestors suggest a dark background
    if (!el) return false;
    // Check for reminder class (dark section in Blue)
    if (el.classList.contains("reminder")) return true;
    // Check for dark hero
    if (el.classList.contains("custom-hero-dark")) return true;
    // Check data-theme on html
    var html = document.documentElement;
    if (html && html.getAttribute("data-theme") === "dark") return true;
    // Check computed background color
    try {
      var bg = window.getComputedStyle(el).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        var match = bg.match(/\d+/g);
        if (match && match.length >= 3) {
          var luminance = (parseInt(match[0]) * 299 + parseInt(match[1]) * 587 + parseInt(match[2]) * 114) / 1000;
          if (luminance < 128) return true;
        }
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // ── Node creation ──────────────────────────────────────────────

  function getNodeCount(canvasW) {
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

  function buildNodes(inst) {
    var pool = buildLabelPool();
    var count = getNodeCount(inst.canvasW);
    // Do not exceed available labels times 3 (avoid meaningless duplicates)
    if (count > pool.length * 3) {
      count = pool.length * 3;
    }
    inst.nodes = [];
    for (var i = 0; i < count; i++) {
      inst.nodes.push(createNode(i, count, pool, inst.canvasW, inst.canvasH));
    }
  }

  // ── Canvas sizing ──────────────────────────────────────────────

  function measureAndSize(inst) {
    if (!inst.wrap) return false;
    var rect = inst.wrap.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if (w < 1 || h < 1) return false;

    inst.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    inst.canvasW = w;
    inst.canvasH = h;

    inst.canvas.width = Math.round(w * inst.dpr);
    inst.canvas.height = Math.round(h * inst.dpr);

    inst.ctx.setTransform(inst.dpr, 0, 0, inst.dpr, 0, 0);

    inst.prevWidth = w;
    inst.prevHeight = h;
    return true;
  }

  // ── Physics ────────────────────────────────────────────────────

  function updatePhysics(inst, time) {
    var margin = 30;
    var nodes = inst.nodes;
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
      if (n.x > inst.canvasW - margin) { n.x = inst.canvasW - margin; n.vx = -Math.abs(n.vx) * 0.8; }
      if (n.y < margin) { n.y = margin; n.vy = Math.abs(n.vy) * 0.8; }
      if (n.y > inst.canvasH - margin) { n.y = inst.canvasH - margin; n.vy = -Math.abs(n.vy) * 0.8; }

      // Pulse radius
      var pulse = Math.sin(time * 0.001 + n.phase) * 0.2;
      n.radius = n.baseRadius * (1 + pulse);

      // Pointer proximity
      var dx = n.x - inst.pointerX;
      var dy = n.y - inst.pointerY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var proximity = 0;
      if (inst.pointerActive && dist < PROXIMITY_RANGE) {
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

  function render(inst, time) {
    var ctx = inst.ctx;
    var nodes = inst.nodes;
    ctx.clearRect(0, 0, inst.canvasW, inst.canvasH);

    var preferredPairs = buildPreferredConnections();
    var labelColor = inst.isDark ? WHITE : MIDNIGHT;

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
        var pdx = midX - inst.pointerX;
        var pdy = midY - inst.pointerY;
        var pDist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (inst.pointerActive && pDist < PROXIMITY_RANGE) {
          var pProx = 1 - pDist / PROXIMITY_RANGE;
          alpha = Math.min(alpha + pProx * 0.2, 0.5);
        }

        var lineWidth = 0.7;
        if (inst.pointerActive && pDist < PROXIMITY_RANGE) {
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
      ctx.fillStyle = "rgba(" + labelColor.r + "," + labelColor.g + "," + labelColor.b + "," + n.currentLabelAlpha.toFixed(3) + ")";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(n.label, n.x, n.y + n.radius + 5);
    }
  }

  // ── Animation loop (per instance) ─────────────────────────────

  function createLoop(inst) {
    function loop(time) {
      if (inst.isHidden || inst.paused) return;
      updatePhysics(inst, time);
      render(inst, time);
      inst.rafId = requestAnimationFrame(loop);
    }
    return loop;
  }

  function startLoop(inst) {
    if (inst.rafId) cancelAnimationFrame(inst.rafId);
    inst.paused = false;
    inst.rafId = requestAnimationFrame(inst.loop);
  }

  function stopLoop(inst) {
    if (inst.rafId) {
      cancelAnimationFrame(inst.rafId);
      inst.rafId = null;
    }
    inst.paused = true;
  }

  // ── Resize handling (per instance) ─────────────────────────────

  function handleResize(inst) {
    if (!inst.wrap) return;
    var rect = inst.wrap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    if (Math.abs(rect.width - inst.prevWidth) < 1 && Math.abs(rect.height - inst.prevHeight) < 1) return;

    var oldW = inst.canvasW || rect.width;
    var oldH = inst.canvasH || rect.height;

    measureAndSize(inst);

    // Proportionally reposition
    var scaleX = inst.canvasW / oldW;
    var scaleY = inst.canvasH / oldH;
    for (var i = 0; i < inst.nodes.length; i++) {
      inst.nodes[i].x = Math.max(30, Math.min(inst.canvasW - 30, inst.nodes[i].x * scaleX));
      inst.nodes[i].y = Math.max(30, Math.min(inst.canvasH - 30, inst.nodes[i].y * scaleY));
    }

    // Adjust node count for breakpoint
    var targetCount = getNodeCount(inst.canvasW);
    if (inst.nodes.length > targetCount + 5) {
      inst.nodes.length = targetCount;
    } else if (inst.nodes.length < targetCount - 5) {
      var pool = buildLabelPool();
      while (inst.nodes.length < targetCount) {
        inst.nodes.push(createNode(inst.nodes.length, targetCount, pool, inst.canvasW, inst.canvasH));
      }
    }

    if (inst.reducedMotion) {
      render(inst, performance.now());
    }
  }

  function createDebouncedResize(inst) {
    var timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(function () { handleResize(inst); }, RESIZE_DEBOUNCE);
    };
  }

  // ── Pointer tracking (per instance) ────────────────────────────

  function createPointerMove(inst) {
    return function (e) {
      if (!inst.canvas) return;
      var rect = inst.canvas.getBoundingClientRect();
      inst.pointerX = e.clientX - rect.left;
      inst.pointerY = e.clientY - rect.top;
      inst.pointerActive = true;
    };
  }

  function createPointerLeave(inst) {
    return function () {
      inst.pointerActive = false;
    };
  }

  // ── Resolve the graph container from a target selector ─────────

  function resolveTarget(selector) {
    // The selector might point to:
    // 1. An element with .custom-graph-hero (hero or section with graph)
    // 2. A .custom-graph-wrap directly
    var el = document.querySelector(selector);
    if (!el) return null;

    var container, wrap;

    if (el.classList.contains("custom-graph-wrap")) {
      // Selector points directly to the wrapper
      wrap = el;
      container = el.parentElement;
    } else if (el.classList.contains("custom-graph-hero")) {
      // Selector points to the parent section
      container = el;
      wrap = el.querySelector(".custom-graph-wrap");
    } else {
      // Try finding .custom-graph-wrap inside the selected element
      wrap = el.querySelector(".custom-graph-wrap");
      container = wrap ? wrap.parentElement : null;
    }

    if (!container || !wrap) return null;

    return { container: container, wrap: wrap };
  }

  // ── Create one instance ────────────────────────────────────────

  function createInstance(selector) {
    var resolved = resolveTarget(selector);
    if (!resolved) {
      console.warn("Graph-Hero: target not found for selector:", selector);
      return null;
    }

    var wrap = resolved.wrap;
    var container = resolved.container;

    // Find or create canvas
    var canvas = wrap.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      wrap.appendChild(canvas);
    }

    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var inst = {
      selector: selector,
      container: container,
      wrap: wrap,
      canvas: canvas,
      ctx: ctx,
      nodes: [],
      rafId: null,
      canvasW: 0,
      canvasH: 0,
      dpr: 1,
      prevWidth: 0,
      prevHeight: 0,
      pointerX: -9999,
      pointerY: -9999,
      pointerActive: false,
      reducedMotion: false,
      isHidden: false,
      paused: false,
      isDark: isDarkContext(container),
      inferred: isInferred,
      loop: null,
      debouncedResize: null,
      onPointerMove: null,
      onPointerLeave: null,
      resizeObserver: null
    };

    // Create bound functions
    inst.loop = createLoop(inst);
    inst.debouncedResize = createDebouncedResize(inst);
    inst.onPointerMove = createPointerMove(inst);
    inst.onPointerLeave = createPointerLeave(inst);

    return inst;
  }

  // ── Initialize one instance ────────────────────────────────────

  function initInstance(inst) {
    // Pointer events on the container (not the canvas, which has pointer-events: none)
    inst.container.addEventListener("mousemove", inst.onPointerMove);
    inst.container.addEventListener("mouseleave", inst.onPointerLeave);
    inst.container.addEventListener("touchmove", function (e) {
      if (e.touches.length === 1) {
        inst.onPointerMove(e.touches[0]);
      }
    }, { passive: true });
    inst.container.addEventListener("touchend", inst.onPointerLeave);

    // ResizeObserver (primary)
    if (typeof ResizeObserver !== "undefined") {
      inst.resizeObserver = new ResizeObserver(function () {
        inst.debouncedResize();
      });
      inst.resizeObserver.observe(inst.wrap);
    }

    // Window resize (fallback)
    window.addEventListener("resize", inst.debouncedResize);

    // Attempt initial measurement and build
    attemptBuild(inst);
  }

  function attemptBuild(inst) {
    if (!measureAndSize(inst)) {
      // Retry after a short delay (CSS may not be applied yet)
      setTimeout(function () {
        if (measureAndSize(inst)) {
          buildAndStart(inst);
        }
      }, 200);
      return;
    }
    buildAndStart(inst);
  }

  function buildAndStart(inst) {
    buildNodes(inst);
    if (inst.reducedMotion) {
      render(inst, performance.now());
    } else if (!inst.isHidden) {
      startLoop(inst);
    }
  }

  // ── Visibility API (shared) ────────────────────────────────────

  function onVisibilityChange() {
    var hidden = document.hidden;
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (hidden) {
        inst.isHidden = true;
        stopLoop(inst);
      } else {
        inst.isHidden = false;
        if (!inst.reducedMotion) {
          startLoop(inst);
        }
      }
    }
  }

  // ── Reduced motion (shared) ────────────────────────────────────

  function applyReducedMotion(reduced) {
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      inst.reducedMotion = reduced;
      if (reduced) {
        stopLoop(inst);
        render(inst, performance.now());
      } else if (!inst.isHidden) {
        startLoop(inst);
      }
    }
  }

  // ── Resolve targets ────────────────────────────────────────────

  function getTargets() {
    if (config && config.targets && config.targets.length > 0) {
      return config.targets;
    }
    // Default: look for .custom-graph-hero elements
    var heroes = document.querySelectorAll(".custom-graph-hero");
    var selectors = [];
    for (var i = 0; i < heroes.length; i++) {
      if (heroes[i].id) {
        selectors.push("#" + heroes[i].id);
      } else {
        // Use the class as selector (will match the first one)
        selectors.push(".custom-graph-hero");
        break;
      }
    }
    if (selectors.length === 0) {
      selectors.push(".custom-graph-hero");
    }
    return selectors;
  }

  // ── Main initialization ────────────────────────────────────────

  function init() {
    resolveConfig();
    var targets = getTargets();

    for (var i = 0; i < targets.length; i++) {
      var inst = createInstance(targets[i]);
      if (inst) {
        instances.push(inst);
      }
    }

    if (instances.length === 0) return;

    // Check reduced motion
    var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    var reduced = motionQuery.matches;

    for (var j = 0; j < instances.length; j++) {
      instances[j].reducedMotion = reduced;
    }

    if (motionQuery.addEventListener) {
      motionQuery.addEventListener("change", function (e) {
        applyReducedMotion(e.matches);
      });
    }

    // Visibility
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Wait for fonts, then initialize all instances
    var afterFonts = function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          for (var k = 0; k < instances.length; k++) {
            initInstance(instances[k]);
          }
        });
      });
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(afterFonts);
    } else {
      afterFonts();
    }
  }

  // ── Entry point ────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

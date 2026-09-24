/*!
 * Foundever AIDT ShapeShifter Engine v2.1 (CDN Edition)
 * Replicates 100% canonical Kenneth Cachia particle morphing physics.
 * Palette: Foundever brand tokens (Midnight, Mint, Indigo, White)
 * Year: 2026
 */
(function(){
  "use strict";

  /* ── Reduced-motion bail ── */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced) return;

  var canvas = document.getElementById('ss-canvas');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  if(!ctx) return;

  /* ── Configuration & Parameters ── */
  var config = window.SHAPESHIFTER_CONFIG || {};

  var GAP = 13;
  var MAX_FONT = 500;
  var CYCLE_MS = typeof config.interval === 'number' ? config.interval : 4200;

  var COLOR_POOL = [
    [255, 255, 255], [139, 240, 187], [75, 75, 249],
    [238, 238, 248], [139, 240, 187], [255, 255, 255]
  ];

  var DEFAULT_WORDS = [
    'AI Deployment Team', 'EverAssist', 'EverCoach', 'EverGPT',
    'Adoption', 'Impact', 'Foundever', 'AI Team'
  ];

  var WORDS = (config.words && Array.isArray(config.words) && config.words.length > 0)
    ? config.words.slice(0)
    : DEFAULT_WORDS;

  var wordIndex = 0;

  /* ── Canvas Area Dimensions ── */
  var area = {w: 0, h: 0};

  function adjustCanvas(){
    area.w = canvas.width = window.innerWidth;
    area.h = canvas.height = window.innerHeight;
  }

  /* ── ShapeBuilder (Off-screen canvas) ── */
  var shapeCanvas = document.createElement('canvas');
  var shapeCtx = shapeCanvas.getContext('2d');

  function fitShapeCanvas(){
    shapeCanvas.width = Math.floor(area.w / GAP) * GAP;
    shapeCanvas.height = Math.floor(area.h / GAP) * GAP;
  }

  function buildShape(word){
    var sw = shapeCanvas.width;
    var sh = shapeCanvas.height;
    shapeCtx.clearRect(0, 0, sw, sh);
    shapeCtx.fillStyle = '#000';
    shapeCtx.textBaseline = 'middle';
    shapeCtx.font = 'bold ' + MAX_FONT + 'px Calibri, Arial, Helvetica, sans-serif';

    var measured = shapeCtx.measureText(word).width;
    var s = Math.min(MAX_FONT, (sw / measured) * 0.8 * MAX_FONT, (sh / MAX_FONT) * 0.45 * MAX_FONT);
    shapeCtx.font = 'bold ' + Math.floor(s) + 'px Calibri, Arial, Helvetica, sans-serif';
    measured = shapeCtx.measureText(word).width;
    shapeCtx.fillText(word, (sw - measured) / 2, sh / 2);

    var data = shapeCtx.getImageData(0, 0, sw, sh).data;
    var dots = [];
    var minX = sw, minY = sh, maxX = 0, maxY = 0;

    for(var y = 0; y < sh; y += GAP){
      for(var x = 0; x < sw; x += GAP){
        var idx = (y * sw + x) * 4;
        if(data[idx + 3] > 0){
          dots.push({x: x, y: y});
          if(x < minX) minX = x;
          if(x > maxX) maxX = x;
          if(y < minY) minY = y;
          if(y > maxY) maxY = y;
        }
      }
    }

    return {
      dots: dots,
      w: maxX + minX,
      h: maxY + minY
    };
  }

  /* ── Dot Class ── */
  function Dot(x, y){
    var c = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
    this.p = {x: x, y: y, z: 5, a: 1, h: 0};  /* position state */
    this.t = {x: x, y: y, z: 5, a: 1};        /* target state */
    this.q = [];                              /* trajectory queue */
    this.r = c[0];
    this.g = c[1];
    this.b = c[2];
    this.e = 0.04;                            /* easing */
    this.s = false;                           /* static letter flag */
  }

  Dot.prototype.move = function(pt){
    this.q.push({
      x: pt.x !== undefined ? pt.x : undefined,
      y: pt.y !== undefined ? pt.y : undefined,
      z: pt.z !== undefined ? pt.z : undefined,
      a: pt.a !== undefined ? pt.a : undefined,
      h: pt.h !== undefined ? pt.h : 0
    });
  };

  Dot.prototype._shiftQueue = function(){
    if(this.q.length === 0) return false;
    var next = this.q.shift();
    if(next.x !== undefined) this.t.x = next.x;
    if(next.y !== undefined) this.t.y = next.y;
    if(next.z !== undefined) this.t.z = next.z;
    if(next.a !== undefined) this.t.a = next.a;
    this.p.h = next.h || 0;
    return true;
  };

  Dot.prototype._moveTowards = function(tx, ty){
    var dx = this.p.x - tx;
    var dy = this.p.y - ty;
    var d = Math.sqrt(dx * dx + dy * dy);
    var e = this.e * d;

    if(d > 1){
      this.p.x -= (dx / d) * e;
      this.p.y -= (dy / d) * e;
      return false;
    } else {
      if(this.p.h > 0){
        this.p.h--;
        return false;
      }
      return true;
    }
  };

  Dot.prototype.update = function(){
    /* Continuous alpha easing */
    var da = this.p.a - this.t.a;
    this.p.a = Math.max(0.1, this.p.a - da * 0.05);

    /* Continuous radius easing */
    var dz = this.p.z - this.t.z;
    this.p.z = Math.max(1, this.p.z - dz * 0.05);

    /* Position progression */
    var arrived = this._moveTowards(this.t.x, this.t.y);

    if(arrived){
      if(!this._shiftQueue()){
        /* Queue is empty */
        if(this.s){
          /* Letter dot: stay perfectly still */
        } else {
          /* Floater: wander randomly and shift trajectory immediately */
          this.move({
            x: this.p.x + (Math.random() * 50) - 25,
            y: this.p.y + (Math.random() * 50) - 25
          });
          this._shiftQueue();
        }
      }
    }
  };

  Dot.prototype.render = function(c){
    c.globalAlpha = this.p.a;
    c.fillStyle = 'rgb(' + this.r + ',' + this.g + ',' + this.b + ')';
    c.beginPath();
    c.arc(this.p.x, this.p.y, this.p.z, 0, Math.PI * 2);
    c.fill();
  };

  /* ── Dot Pool Management ── */
  var dots = [];

  function switchShape(newShape, fast){
    var cx = (area.w / 2) - (newShape.w / 2);
    var cy = (area.h / 2) - (newShape.h / 2);

    /* Grow pool if needed */
    while(newShape.dots.length > dots.length){
      dots.push(new Dot(area.w / 2, area.h / 2));
    }

    var shapeDots = newShape.dots.slice();
    var d = 0;

    /* Assign letter targets */
    while(shapeDots.length > 0){
      var i = Math.floor(Math.random() * shapeDots.length);
      var sd = shapeDots[i];
      var dot = dots[d];

      dot.e = fast ? 0.25 : (dot.s ? 0.14 : 0.11);

      if(dot.s){
        /* Scatter burst from previous word */
        dot.move({z: Math.random() * 20 + 10, a: Math.random(), h: 18});
      } else {
        /* Floating dot transitioning to letter */
        dot.move({z: Math.random() * 5 + 5, h: fast ? 18 : 30});
      }

      dot.s = true;
      dot.move({x: sd.x + cx, y: sd.y + cy, a: 1, z: 5, h: 0});

      shapeDots.splice(i, 1);
      d++;
    }

    /* Excess dots become floaters */
    for(var j = d; j < dots.length; j++){
      var fd = dots[j];
      if(fd.s){
        fd.move({z: Math.random() * 20 + 10, a: Math.random(), h: 20});
      }
      fd.s = false;
      fd.e = 0.04;
      fd.move({
        x: Math.random() * area.w,
        y: Math.random() * area.h,
        a: 0.3,
        z: Math.random() * 4,
        h: 0
      });
    }
  }

  /* ── Render Loop ── */
  var animId = null;
  var isVisible = true;

  function frame(){
    animId = requestAnimationFrame(frame);
    ctx.clearRect(0, 0, area.w, area.h);
    for(var i = 0; i < dots.length; i++){
      dots[i].update();
      dots[i].render(ctx);
    }
    ctx.globalAlpha = 1;
  }

  function startLoop(){
    if(!animId && isVisible) animId = requestAnimationFrame(frame);
  }

  function stopLoop(){
    if(animId){ cancelAnimationFrame(animId); animId = null; }
  }

  /* ── Word Cycling ── */
  var cycleTimer = null;

  function showNextWord(){
    var shape = buildShape(WORDS[wordIndex]);
    /* The first word assembles rapidly (fast = true) */
    switchShape(shape, wordIndex === 0);
    wordIndex = (wordIndex + 1) % WORDS.length;
  }

  function startCycle(){
    showNextWord();
    cycleTimer = setInterval(showNextWord, CYCLE_MS);
  }

  /* ── Boot Sequence ── */
  function waitForSize(cb, attempts){
    attempts = attempts || 0;
    if(attempts > 60){ cb(); return; }
    adjustCanvas();
    if(area.w > 0 && area.h > 0){
      cb();
    } else {
      requestAnimationFrame(function(){ waitForSize(cb, attempts + 1); });
    }
  }

  function boot(){
    waitForSize(function(){
      fitShapeCanvas();
      startLoop();
      startCycle();
    });
  }

  if(document.readyState === 'complete'){
    boot();
  } else {
    window.addEventListener('load', boot);
  }

  /* ── Resize with Debounce ── */
  var resizeTimer = null;
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      adjustCanvas();
      fitShapeCanvas();
      /* Re-render current word to refit to new dimensions */
      var shape = buildShape(WORDS[(wordIndex - 1 + WORDS.length) % WORDS.length]);
      switchShape(shape, true);
    }, 200);
  });

  /* ── Visibility API ── */
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      stopLoop();
    } else {
      isVisible = true;
      startLoop();
    }
  });

  /* ── IntersectionObserver ── */
  if(typeof IntersectionObserver !== 'undefined'){
    var heroEl = document.getElementById('top');
    if(heroEl){
      var obs = new IntersectionObserver(function(entries){
        if(entries[0].isIntersecting){
          isVisible = true;
          startLoop();
        } else {
          isVisible = false;
          stopLoop();
        }
      }, {threshold: 0});
      obs.observe(heroEl);
    }
  }

})();

/*!
 * Foundever AIDT ShapeShifter Engine v3.1 (CDN Edition)
 * Faithful port of Kenneth Cachia's Shape Shifter particle physics.
 * Palette: Foundever brand tokens (Midnight, Mint, Indigo, White)
 * Year: 2026
 *
 * v3.1 changelog:
 * - Fix: Dots initialize with a:0, z:0 to prevent center flash on boot
 */
(function(){
  "use strict";

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced) return;

  var canvas = document.getElementById('ss-canvas');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  if(!ctx) return;

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
  var area = {w: 0, h: 0};

  function adjustCanvas(){
    area.w = canvas.width = window.innerWidth;
    area.h = canvas.height = window.innerHeight;
  }

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
    shapeCtx.fillStyle = 'red';
    shapeCtx.textBaseline = 'middle';
    shapeCtx.textAlign = 'center';

    shapeCtx.font = 'bold ' + MAX_FONT + 'px Calibri, Arial, Helvetica, sans-serif';
    var measured = shapeCtx.measureText(word).width;
    var s = Math.min(MAX_FONT,
      (sw / measured) * 0.8 * MAX_FONT,
      (sh / MAX_FONT) * 0.45 * MAX_FONT);
    shapeCtx.font = 'bold ' + Math.floor(s) + 'px Calibri, Arial, Helvetica, sans-serif';

    shapeCtx.fillText(word, sw / 2, sh / 2);

    var pixels = shapeCtx.getImageData(0, 0, sw, sh).data;
    var dots = [];
    var x = 0, y = 0;
    var fx = sw, fy = sh, w = 0, h = 0;

    for(var p = 0; p < pixels.length; p += (4 * GAP)){
      if(pixels[p + 3] > 0){
        dots.push({x: x, y: y});
        if(x > w) w = x;
        if(y > h) h = y;
        if(x < fx) fx = x;
        if(y < fy) fy = y;
      }
      x += GAP;
      if(x >= sw){
        x = 0;
        y += GAP;
        p += GAP * 4 * sw;
      }
    }

    return { dots: dots, w: w + fx, h: h + fy };
  }

  function Point(args){
    this.x = args.x;
    this.y = args.y;
    this.z = args.z;
    this.a = args.a;
    this.h = args.h;
  }

  function Dot(x, y){
    var c = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
    /* v3.1 fix: born invisible (a:0, z:0) to prevent center flash */
    this.p = new Point({x: x, y: y, z: 0, a: 0, h: 0});
    this.e = 0.07;
    this.s = true;
    this.r = c[0];
    this.g = c[1];
    this.b = c[2];
    this.t = new Point({x: x, y: y, z: 0, a: 0, h: 0});
    this.q = [];
  }

  Dot.prototype.distanceTo = function(n, details){
    var dx = this.p.x - n.x;
    var dy = this.p.y - n.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    return details ? [dx, dy, d] : d;
  };

  Dot.prototype.move = function(p, avoidStatic){
    if(!avoidStatic || (avoidStatic && this.distanceTo(p) > 1)){
      this.q.push(p);
    }
  };

  Dot.prototype._moveTowards = function(n){
    var details = this.distanceTo(n, true);
    var dx = details[0];
    var dy = details[1];
    var d = details[2];
    var e = this.e * d;

    if(this.p.h === -1){
      this.p.x = n.x;
      this.p.y = n.y;
      return true;
    }

    if(d > 1){
      this.p.x -= ((dx / d) * e);
      this.p.y -= ((dy / d) * e);
    } else {
      if(this.p.h > 0){
        this.p.h--;
      } else {
        return true;
      }
    }
    return false;
  };

  Dot.prototype._update = function(){
    if(this._moveTowards(this.t)){
      var p = this.q.shift();

      if(p){
        this.t.x = p.x || this.p.x;
        this.t.y = p.y || this.p.y;
        this.t.z = p.z || this.p.z;
        this.t.a = p.a || this.p.a;
        this.p.h = p.h || 0;
      } else {
        if(this.s){
          this.p.x -= Math.sin(Math.random() * 3.142);
          this.p.y -= Math.sin(Math.random() * 3.142);
        } else {
          this.move(new Point({
            x: this.p.x + (Math.random() * 50) - 25,
            y: this.p.y + (Math.random() * 50) - 25
          }));
        }
      }
    }

    var d = this.p.a - this.t.a;
    this.p.a = Math.max(0.1, this.p.a - (d * 0.05));
    d = this.p.z - this.t.z;
    this.p.z = Math.max(1, this.p.z - (d * 0.05));
  };

  Dot.prototype._draw = function(){
    ctx.globalAlpha = this.p.a;
    ctx.fillStyle = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + this.p.a + ')';
    ctx.beginPath();
    ctx.arc(this.p.x, this.p.y, this.p.z, 0, 2 * Math.PI, true);
    ctx.closePath();
    ctx.fill();
  };

  Dot.prototype.render = function(){
    this._update();
    this._draw();
  };

  var dots = [];
  var shapeWidth = 0;
  var shapeHeight = 0;

  function compensate(){
    return {
      x: area.w / 2 - shapeWidth / 2,
      y: area.h / 2 - shapeHeight / 2
    };
  }

  function switchShape(n, fast){
    shapeWidth = n.w;
    shapeHeight = n.h;
    var offset = compensate();

    if(n.dots.length > dots.length){
      var size = n.dots.length - dots.length;
      for(var d = 1; d <= size; d++){
        dots.push(new Dot(area.w / 2, area.h / 2));
      }
    }

    var d = 0;
    var i = 0;
    var shapeDots = n.dots.slice();

    while(shapeDots.length > 0){
      i = Math.floor(Math.random() * shapeDots.length);
      dots[d].e = fast ? 0.25 : (dots[d].s ? 0.14 : 0.11);

      if(dots[d].s){
        dots[d].move(new Point({
          z: Math.random() * 20 + 10,
          a: Math.random(),
          h: 18
        }));
      } else {
        dots[d].move(new Point({
          z: Math.random() * 5 + 5,
          h: fast ? 18 : 30
        }));
      }

      dots[d].s = true;
      dots[d].move(new Point({
        x: shapeDots[i].x + offset.x,
        y: shapeDots[i].y + offset.y,
        a: 1,
        z: 5,
        h: 0
      }));

      shapeDots.splice(i, 1);
      d++;
    }

    for(var j = d; j < dots.length; j++){
      if(dots[j].s){
        dots[j].move(new Point({
          z: Math.random() * 20 + 10,
          a: Math.random(),
          h: 20
        }));

        dots[j].s = false;
        dots[j].e = 0.04;
        dots[j].move(new Point({
          x: Math.random() * area.w,
          y: Math.random() * area.h,
          a: 0.3,
          z: Math.random() * 4,
          h: 0
        }));
      }
    }
  }

  var animId = null;
  var isVisible = true;

  function frame(){
    animId = requestAnimationFrame(frame);
    ctx.clearRect(0, 0, area.w, area.h);
    for(var i = 0; i < dots.length; i++){
      dots[i].render();
    }
    ctx.globalAlpha = 1;
  }

  function startLoop(){
    if(!animId && isVisible) animId = requestAnimationFrame(frame);
  }

  function stopLoop(){
    if(animId){ cancelAnimationFrame(animId); animId = null; }
  }

  var cycleTimer = null;

  function showNextWord(){
    var shape = buildShape(WORDS[wordIndex]);
    switchShape(shape, wordIndex === 0);
    wordIndex = (wordIndex + 1) % WORDS.length;
  }

  function startCycle(){
    showNextWord();
    cycleTimer = setInterval(showNextWord, CYCLE_MS);
  }

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

  var resizeTimer = null;
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      adjustCanvas();
      fitShapeCanvas();
      var shape = buildShape(WORDS[(wordIndex - 1 + WORDS.length) % WORDS.length]);
      switchShape(shape, true);
    }, 200);
  });

  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      stopLoop();
    } else {
      isVisible = true;
      startLoop();
    }
  });

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

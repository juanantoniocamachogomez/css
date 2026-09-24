(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var config = window.SHAPESHIFTER_CONFIG || {};
  var defaultSequence = [
    "AI Deployment Team",
    "EverAssist",
    "EverCoach",
    "EverGPT",
    "Deployment",
    "Adoption",
    "Impact",
    "Foundever",
    "AI Team"
  ];

  // Si se configuran palabras en window.SHAPESHIFTER_CONFIG, se usan; si no, el default
  var wordSequence = (config.words && Array.isArray(config.words) && config.words.length > 0)
    ? config.words.slice(0)
    : defaultSequence;

  var cycleInterval = typeof config.interval === "number" ? config.interval : 4200;
  var targetCanvasId = config.canvasId || "ss-canvas";
  var targetHeroId = config.heroId || "top";

  var gap = 13;
  var colorPool = [
    [255, 255, 255],
    [139, 240, 187],
    [75, 75, 249],
    [238, 238, 248],
    [139, 240, 187],
    [255, 255, 255]
  ];

  var S = {};

  // --- S.Drawing ---
  S.Drawing = (function () {
    var canvas, context, renderFn;
    var animId = null;

    return {
      init: function (el) {
        canvas = el;
        context = canvas.getContext("2d");
        this.adjustCanvas();
        window.addEventListener("resize", function () {
          S.Drawing.adjustCanvas();
        });
      },
      loop: function (fn) {
        renderFn = fn;
        var step = function () {
          animId = window.requestAnimationFrame(step);
          renderFn();
        };
        step();
      },
      stop: function () {
        if (animId) {
          window.cancelAnimationFrame(animId);
          animId = null;
        }
      },
      adjustCanvas: function () {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (S.ShapeBuilder) {
          S.ShapeBuilder.fit();
        }
      },
      clear: function () {
        context.clearRect(0, 0, canvas.width, canvas.height);
      },
      getArea: function () {
        return { w: canvas.width, h: canvas.height };
      },
      drawCircle: function (p, c) {
        context.fillStyle = "rgba(" + c.r + "," + c.g + "," + c.b + "," + p.a + ")";
        context.beginPath();
        context.arc(p.x, p.y, p.z, 0, Math.PI * 2, true);
        context.closePath();
        context.fill();
      }
    };
  })();

  // --- S.Point & S.Color ---
  S.Point = function (args) {
    this.x = args.x || 0;
    this.y = args.y || 0;
    this.z = args.z || 5;
    this.a = args.a || 1;
    this.h = args.h || 0;
  };

  S.Color = function () {
    var pick = colorPool[Math.floor(Math.random() * colorPool.length)];
    this.r = pick[0];
    this.g = pick[1];
    this.b = pick[2];
  };

  // --- S.Dot (Fisica original Kenneth Cachia) ---
  S.Dot = function (x, y) {
    this.p = new S.Point({ x: x, y: y, z: 5, a: 1, h: 0 });
    this.e = 0.11;
    this.s = true;
    this.c = new S.Color();
    this.t = new S.Point({ x: x, y: y, z: 5, a: 1, h: 0 });
    this.q = [];
  };

  S.Dot.prototype = {
    _moveTowards: function (target) {
      var dx = this.p.x - target.x;
      var dy = this.p.y - target.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var e = this.e * d;

      if (d > 1) {
        this.p.x -= (dx / d) * e;
        this.p.y -= (dy / d) * e;
        return false;
      } else {
        if (this.p.h > 0) {
          this.p.h--;
          return false;
        } else {
          return true;
        }
      }
    },

    _update: function () {
      if (this._moveTowards(this.t)) {
        var next = this.q.shift();
        if (next) {
          this.t.x = next.x !== undefined ? next.x : this.t.x;
          this.t.y = next.y !== undefined ? next.y : this.t.y;
          this.t.z = next.z !== undefined ? next.z : this.t.z;
          this.t.a = next.a !== undefined ? next.a : this.t.a;
          this.p.h = next.h !== undefined ? next.h : 0;
        } else {
          if (!this.s) {
            this.move(
              new S.Point({
                x: this.p.x + (Math.random() * 50 - 25),
                y: this.p.y + (Math.random() * 50 - 25)
              })
            );
          }
        }
      }

      var d_alpha = this.p.a - this.t.a;
      this.p.a = Math.max(0.1, this.p.a - d_alpha * 0.05);

      var d_z = this.p.z - this.t.z;
      this.p.z = Math.max(1, this.p.z - d_z * 0.05);
    },

    move: function (point) {
      this.q.push(point);
    },

    render: function () {
      this._update();
      S.Drawing.drawCircle(this.p, this.c);
    }
  };

  // --- S.ShapeBuilder ---
  S.ShapeBuilder = (function () {
    var offCanvas = document.createElement("canvas");
    var offContext = offCanvas.getContext("2d");

    return {
      fit: function () {
        offCanvas.width = Math.floor(window.innerWidth / gap) * gap;
        offCanvas.height = Math.floor(window.innerHeight / gap) * gap;
      },
      letter: function (word) {
        if (offCanvas.width < 1 || offCanvas.height < 1) {
          this.fit();
        }
        var maxFontSize = 500;
        offContext.clearRect(0, 0, offCanvas.width, offCanvas.height);
        offContext.font = "bold " + maxFontSize + "px 'Calibri', 'Arial', 'Helvetica', sans-serif";

        var measured = offContext.measureText(word).width;
        var s = Math.min(
          maxFontSize,
          (offCanvas.width / measured) * 0.8 * maxFontSize,
          (offCanvas.height / maxFontSize) * 0.45 * maxFontSize
        );

        offContext.font = "bold " + Math.floor(s) + "px 'Calibri', 'Arial', 'Helvetica', sans-serif";
        offContext.textAlign = "center";
        offContext.textBaseline = "middle";
        offContext.fillStyle = "#ffffff";
        offContext.fillText(word, offCanvas.width / 2, offCanvas.height / 2);

        var imgData = offContext.getImageData(0, 0, offCanvas.width, offCanvas.height).data;
        var dots = [];
        var minX = offCanvas.width,
          maxX = 0,
          minY = offCanvas.height,
          maxY = 0;

        for (var y = 0; y < offCanvas.height; y += gap) {
          for (var x = 0; x < offCanvas.width; x += gap) {
            var index = (y * offCanvas.width + x) * 4;
            if (imgData[index + 3] > 0) {
              dots.push(new S.Point({ x: x, y: y }));
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        return { dots: dots, w: maxX + minX, h: maxY + minY };
      }
    };
  })();

  // --- S.Shape ---
  S.Shape = (function () {
    var dots = [];
    var cx = 0,
      cy = 0;

    var compensate = function (shape) {
      var area = S.Drawing.getArea();
      cx = area.w / 2 - shape.w / 2;
      cy = area.h / 2 - shape.h / 2;
    };

    return {
      switchShape: function (newShape, fast) {
        if (!newShape || !newShape.dots || newShape.dots.length === 0) return;
        var area = S.Drawing.getArea();
        compensate(newShape);

        if (newShape.dots.length > dots.length) {
          var count = newShape.dots.length - dots.length;
          for (var k = 0; k < count; k++) {
            dots.push(new S.Dot(area.w / 2, area.h / 2));
          }
        }

        var d = 0;
        var pool = newShape.dots.slice(0);

        while (pool.length > 0) {
          var i = Math.floor(Math.random() * pool.length);
          var shapeDot = pool.splice(i, 1)[0];

          dots[d].e = fast ? 0.25 : dots[d].s ? 0.14 : 0.11;

          if (dots[d].s) {
            dots[d].move(
              new S.Point({
                z: Math.random() * 20 + 10,
                a: Math.random(),
                h: 18
              })
            );
          } else {
            dots[d].move(
              new S.Point({
                z: Math.random() * 5 + 5,
                h: fast ? 18 : 30
              })
            );
          }

          dots[d].s = true;
          dots[d].move(
            new S.Point({
              x: shapeDot.x + cx,
              y: shapeDot.y + cy,
              a: 1,
              z: 5,
              h: 0
            })
          );
          d++;
        }

        for (var f = d; f < dots.length; f++) {
          if (dots[f].s) {
            dots[f].move(
              new S.Point({
                z: Math.random() * 20 + 10,
                a: Math.random(),
                h: 20
              })
            );
            dots[f].s = false;
            dots[f].e = 0.04;
            dots[f].move(
              new S.Point({
                x: Math.random() * area.w,
                y: Math.random() * area.h,
                a: 0.3,
                z: Math.random() * 4,
                h: 0
              })
            );
          }
        }
      },
      render: function () {
        for (var i = 0; i < dots.length; i++) {
          dots[i].render();
        }
      }
    };
  })();

  // --- Orquestacion y Ciclo ---
  var wordIndex = 0;
  var timer = null;

  function cycleWords() {
    var word = wordSequence[wordIndex];
    var shape = S.ShapeBuilder.letter(word);
    S.Shape.switchShape(shape, false);
    wordIndex++;

    if (wordIndex >= wordSequence.length) {
      wordIndex = 0;
      wordSequence.sort(function () {
        return Math.random() - 0.5;
      });
    }
  }

  function waitForSize(heroEl, callback) {
    var attempts = 0;
    var check = function () {
      attempts++;
      if (heroEl.offsetWidth > 0 && heroEl.offsetHeight > 0) {
        callback();
      } else if (attempts < 60) {
        window.requestAnimationFrame(check);
      }
    };
    check();
  }

  function startEngine() {
    var heroEl = document.getElementById(targetHeroId);
    var canvasEl = document.getElementById(targetCanvasId);
    if (!heroEl || !canvasEl) return;

    waitForSize(heroEl, function () {
      S.Drawing.init(canvasEl);
      S.ShapeBuilder.fit();
      S.Drawing.loop(function () {
        S.Drawing.clear();
        S.Shape.render();
      });

      cycleWords();
      timer = setInterval(cycleWords, cycleInterval);

      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          if (timer) clearInterval(timer);
          S.Drawing.stop();
        } else {
          S.Drawing.loop(function () {
            S.Drawing.clear();
            S.Shape.render();
          });
          cycleWords();
          timer = setInterval(cycleWords, cycleInterval);
        }
      });

      if (typeof IntersectionObserver !== "undefined") {
        var obs = new IntersectionObserver(
          function (entries) {
            if (entries[0].isIntersecting) {
              if (!timer) {
                S.Drawing.loop(function () {
                  S.Drawing.clear();
                  S.Shape.render();
                });
                timer = setInterval(cycleWords, cycleInterval);
              }
            } else {
              if (timer) {
                clearInterval(timer);
                timer = null;
              }
              S.Drawing.stop();
            }
          },
          { threshold: 0 }
        );
        obs.observe(heroEl);
      }
    });
  }

  if (document.readyState === "complete") {
    startEngine();
  } else {
    window.addEventListener("load", startEngine);
  }
})();

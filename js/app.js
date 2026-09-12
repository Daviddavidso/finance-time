/* ==========================================================================
   finance-time — поведение страницы.

   Всё написано без библиотек: страница должна открываться на любом хостинге
   и работать, даже если этот файл не загрузился. Без JS остаются рабочими
   ссылки, таблица и кнопки — закрытыми будут только ответы в блоке вопросов,
   поэтому раскрытие включается отсюда же (см. блок «Вопросы»).
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Звёздное поле в первом экране.

     Три ограничения держат контраст заголовка: звёзды не рисуются под
     текстом, они не ярче #c8d4e8 и не крупнее 1.4 px. Плюс поверх лежит
     затемнение из CSS. Анимацию можно остановить кнопкой, и она сама
     выключается при системной настройке «уменьшить движение».
     ------------------------------------------------------------------------ */

  var hero = document.querySelector('.hero');
  var canvas = document.querySelector('.hero__stars');
  var toggle = document.getElementById('motion-toggle');

  if (hero && canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var stars = [];
    var raf = null;
    var w = 0, h = 0;
    var STORE_KEY = 'ft-motion';
    var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    var wanted = true;                       // чего хочет посетитель
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved === 'off') wanted = false;
    } catch (e) { /* приватный режим — просто оставляем значение по умолчанию */ }

    function animationAllowed() {
      return wanted && !reduceQuery.matches;
    }

    function excluded() {
      // Прямоугольники текста: под ними звёзд быть не должно.
      var pad = 24;
      var base = canvas.getBoundingClientRect();
      var zones = [];
      var nodes = hero.querySelectorAll('.hero__content, .board, .hero__toolbar');
      for (var i = 0; i < nodes.length; i++) {
        var r = nodes[i].getBoundingClientRect();
        zones.push({
          x1: r.left - base.left - pad,
          y1: r.top - base.top - pad,
          x2: r.right - base.left + pad,
          y2: r.bottom - base.top + pad
        });
      }
      return zones;
    }

    function build() {
      var zones = excluded();
      var target = Math.round((w * h) / 9000);   // не плотнее одной звезды на 9000 px²
      stars = [];
      var guard = 0;
      while (stars.length < target && guard < target * 12) {
        guard++;
        var x = Math.random() * w;
        var y = Math.random() * h;
        var inside = false;
        for (var i = 0; i < zones.length; i++) {
          var z = zones[i];
          if (x > z.x1 && x < z.x2 && y > z.y1 && y < z.y2) { inside = true; break; }
        }
        if (inside) continue;
        stars.push({
          x: x,
          y: y,
          r: 0.5 + Math.random() * 0.9,          // максимум 1.4 px
          a: 0.28 + Math.random() * 0.5,         // максимум 0.78
          period: 1800 + Math.random() * 3600,   // мерцание не быстрее 1.8 с
          phase: Math.random() * Math.PI * 2,
          drift: (Math.random() * 6 + 2) / 1000  // максимум 8 px в секунду
        });
      }
    }

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = hero.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function draw(time) {
      ctx.clearRect(0, 0, w, h);
      ctx.shadowBlur = 0;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var alpha = s.a;
        if (time) {
          // мягкое мерцание: амплитуда небольшая, период — секунды
          alpha = s.a * (0.72 + 0.28 * Math.sin(s.phase + (time / s.period) * Math.PI * 2));
          s.x += s.drift;
          if (s.x > w + 2) s.x = -2;
        }
        ctx.globalAlpha = Math.max(0, Math.min(0.85, alpha));
        ctx.fillStyle = '#c8d4e8';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function loop(time) {
      draw(time);
      raf = window.requestAnimationFrame(loop);
    }

    function start() {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(loop);
    }

    function stop() {
      if (raf !== null) {
        window.cancelAnimationFrame(raf);
        raf = null;
      }
      draw(0);   // статичный кадр рисуем всегда: иначе после пересчёта
                 // размеров холст остаётся пустым — так пропадали звёзды
                 // при системной настройке «уменьшить движение».
    }

    function sync() {
      if (toggle) toggle.setAttribute('aria-pressed', animationAllowed() ? 'true' : 'false');
      if (animationAllowed() && !document.hidden) start(); else stop();
    }

    size();
    draw(0);                                    // первый кадр рисуем сразу
    sync();

    if (toggle) {
      toggle.addEventListener('click', function () {
        wanted = !animationAllowed();
        try { localStorage.setItem(STORE_KEY, wanted ? 'on' : 'off'); } catch (e) {}
        sync();
      });
    }

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        size();
        draw(0);
        sync();
      }, 180);
    });

    document.addEventListener('visibilitychange', sync);

    if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', sync);
    else if (reduceQuery.addListener) reduceQuery.addListener(sync);

    window.addEventListener('load', function () { size(); draw(0); sync(); });
  }

  /* ------------------------------------------------------------------------
     Вопросы. Обычное раскрытие: состояние живёт в aria-expanded,
     содержимое прячется атрибутом hidden — иначе внутрь можно попасть
     табуляцией и «провалиться» в невидимое место.
     ------------------------------------------------------------------------ */

  var faqButtons = document.querySelectorAll('.faq__btn');
  for (var i = 0; i < faqButtons.length; i++) {
    faqButtons[i].addEventListener('click', function () {
      var panel = document.getElementById(this.getAttribute('aria-controls'));
      if (!panel) return;
      var open = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.hidden = open;
    });
  }

  /* ------------------------------------------------------------------------
     Таблица сравнения. Если она не помещается по ширине, контейнер должен
     получать фокус — иначе прокрутить её с клавиатуры невозможно.
     ------------------------------------------------------------------------ */

  var scroller = document.querySelector('.table-scroll');
  if (scroller) {
    var syncScroller = function () {
      if (scroller.scrollWidth > scroller.clientWidth + 1) {
        scroller.setAttribute('tabindex', '0');
      } else if (scroller !== document.activeElement) {
        scroller.removeAttribute('tabindex');
      }
    };
    syncScroller();
    window.addEventListener('resize', syncScroller);
    window.addEventListener('load', syncScroller);

    /* Смена раздела меняет число колонок, но не вызывает ни resize, ни load:
       без этого таблица пошире оставалась бы без tabindex, и до ссылок
       в последней колонке нельзя было бы добраться с клавиатуры.
       Второй заход через кадр — логотипы в строках грузятся лениво
       и меняют ширину уже после первого замера. */
    document.addEventListener('ft:catalog-rendered', function () {
      scroller.scrollLeft = 0;
      syncScroller();
      window.requestAnimationFrame(syncScroller);
    });
  }

  /* ------------------------------------------------------------------------
     Кнопка «Наверх». Это ссылка на шапку: она переносит и прокрутку,
     и фокус, поэтому следующий Tab продолжает работу сверху страницы.
     ------------------------------------------------------------------------ */

  var toTop = document.querySelector('.to-top');
  if (toTop) {
    var syncToTop = function () {
      toTop.hidden = window.pageYOffset < 600;
    };
    syncToTop();
    window.addEventListener('scroll', syncToTop, { passive: true });
  }

}());

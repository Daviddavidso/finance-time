/* ==========================================================================
   Рисует карточки, сводку и таблицу сравнения из data.js.

   Грузится ДО app.js: тот меряет ширину таблицы и рисует звёзды уже
   по готовой разметке.

   В index.html те же блоки лежат статикой — это запасной вариант.
   Если PHP на хостинге выключат или data.js не загрузится, посетитель
   всё равно увидит нормальную страницу, просто без правок из панели.
   ========================================================================== */

(function () {
  'use strict';

  /* Каталог объявлен в data.php/data.js глобальными const, а const мимо
     window не переприсвоить — поэтому работаем с локальными переменными.
     На адресе с ?draft=1 в них ложится черновик из панели. */
  var site   = typeof SITE       !== 'undefined' ? SITE       : null;
  var offers = typeof OFFERS     !== 'undefined' ? OFFERS     : null;
  var cats   = typeof CATEGORIES !== 'undefined' ? CATEGORIES : [];

  if (/[?&]draft/.test(location.search)) {
    try {
      var draftFile = localStorage.getItem('financetime_admin_draft:file');
      if (draftFile) {
        var d = new Function(draftFile + '\n;return { SITE: SITE, CATEGORIES: CATEGORIES, OFFERS: OFFERS };')();
        site = d.SITE || site; cats = d.CATEGORIES || cats; offers = d.OFFERS || offers;
      }
    } catch (e) { /* битый черновик — показываем боевой каталог */ }
  }

  if (!offers || !offers.length) return;   // нет данных — остаётся статика

  var live = offers.filter(function (o) { return !o.hidden; });
  if (!live.length) return;

  var CTA = (cats[0] && cats[0].cta) || 'Оформить';

  /* ---------------------------------------------------------------- утилиты */

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function text(v) { return String(v == null ? '' : v).trim(); }
  function set(sel, value) {
    var n = document.querySelector(sel);
    if (n && text(value)) n.textContent = value;
  }
  function initials(name) {
    var parts = text(name).split(/\s+/).filter(Boolean);
    var s = parts.length > 1 ? parts[0][0] + parts[1][0] : text(name).slice(0, 2);
    return s.toUpperCase();
  }

  /* Логотип на белой подложке. Без файла — буквы банка в его цвете:
     подложка тогда красится, а не остаётся белым пятном. */
  function plate(o, cls) {
    if (text(o.logo)) {
      /* Размер задаём высотой: у ВТБ логотип широкий, у ОТП квадратный —
         по ширине они получались бы разного веса. */
      return '<span class="plate ' + cls + '"><img class="plate__img" src="' + esc(o.logo) +
             '" alt="" loading="lazy" decoding="async"></span>';
    }
    var tone = o.tone || {};
    return '<span class="plate ' + cls + ' plate--letters" style="background:' + esc(tone.bg || '#1B3A8C') +
           ';color:' + esc(tone.ink || '#FFFFFF') + '">' + esc(initials(o.partner)) + '</span>';
  }

  /* Пояснение к кнопке для скринридера: одинаковых «Оформить» на странице
     несколько, и без него их не различить в списке ссылок. */
  function ctaName(o) {
    return ' — ' + text(o.partner) + ', ' + text(o.title) + ' (откроется в новой вкладке)';
  }
  function ctaLink(o, cls) {
    if (!text(o.url)) return '';
    return '<a class="btn ' + cls + '" href="' + esc(o.url) + '" target="_blank" ' +
           'rel="nofollow sponsored noopener" referrerpolicy="strict-origin-when-cross-origin">' +
           esc(CTA) + '<span class="vh">' + esc(ctaName(o)) + '</span></a>';
  }

  /* Галочку ставим только там, где условие и правда бесплатное. Смысл всё
     равно несёт текст рядом — цветом и значком ничего не сообщается. */
  function yes(value) {
    return /^\s*(0\s*₽|бесплатн|да\b)/i.test(String(value || ''));
  }

  /* ------------------------------------------------------------- тексты сайта */

  if (site) {
    set('.topline__text', site.topline);
    set('#hero-title', site.heroTitle);
    set('.hero__lead', site.heroLead);
    set('#offers .section__note', site.offersNote);

    if (text(site.updated)) {
      var dateNode = document.querySelector('.topline__date');
      if (dateNode) {
        dateNode.innerHTML = '<span aria-hidden="true">●</span> обновлено ' + esc(site.updated);
      }
    }
    if (text(site.brand)) {
      Array.prototype.forEach.call(document.querySelectorAll('.brand__name'), function (n) {
        n.textContent = site.brand;
      });
    }
  }

  /* ------------------------------------------------------------------ сводка */

  var board = document.querySelector('.board__list');
  if (board) {
    board.innerHTML = live.map(function (o) {
      var cells = (o.specs || []).slice(0, 2).map(function (p) {
        return '<span class="board__cell"><span class="board__label">' + esc(p[0]) +
               '</span><span class="board__value">' + esc(p[1]) + '</span></span>';
      }).join('');
      return '<li class="board__row">' + plate(o, 'plate--sm') +
        '<span class="board__bank">' + esc(o.partner) +
        '<span class="board__card">' + esc(o.title) + '</span></span>' + cells + '</li>';
    }).join('');
  }
  var count = document.querySelector('.board__count');
  if (count) {
    count.innerHTML = '<span aria-hidden="true">◍</span> ' + live.length + ' из ' + live.length;
  }

  /* --------------------------------------------------------------- карточки */

  var cards = document.querySelector('.cards');
  if (cards) {
    cards.innerHTML = live.map(function (o, i) {
      var id = 'offer-' + (i + 1) + '-title';
      var num = (i + 1) < 10 ? '0' + (i + 1) : String(i + 1);

      var specs = (o.specs || []).map(function (p) {
        var value = text(p[1]);
        return '<li><span class="ic" aria-hidden="true"></span>' +
               esc(p[0]) + (value ? ' — ' + esc(value) : '') + '</li>';
      }).join('');

      var cta = ctaLink(o, 'btn--primary btn--block card__cta');

      return '<li><article class="card" aria-labelledby="' + id + '">' +
        '<p class="card__bar">' +
          '<span class="card__num">' + num + '</span>' +
          '<span class="card__type">' + esc(o.tag || 'Предложение') + '</span>' +
          (text(o.badge) ? '<span class="badge">' + esc(o.badge) + '</span>' : '') +
        '</p>' +
        plate(o, '') +
        '<h3 class="card__title" id="' + id + '">' + esc(o.partner) + ' — ' + esc(o.title) + '</h3>' +
        (text(o.note) ? '<p class="card__lead">' + esc(o.note) + '</p>' : '') +
        (specs ? '<ul class="card__specs" role="list">' + specs + '</ul>' : '') +
        (cta ? '<p class="card__cta-wrap">' + cta + '</p>' : '') +
        '<p class="card__fine">Актуальные условия — на сайте банка.</p>' +
        '</article></li>';
    }).join('');
  }

  /* -------------------------------------------------------- таблица сравнения
     Колонки берём из условий первой карточки: у всех предложений названия
     условий одинаковые, так задумано в панели. Если у какой-то карточки
     условия нет, в клетке стоит текст, а не прочерк. */

  var table = document.querySelector('.table');
  if (table) {
    var keys = (live[0].specs || []).slice(0, 4).map(function (p) { return text(p[0]); })
      .filter(Boolean);

    var head = table.querySelector('thead tr');
    var body = table.querySelector('tbody');
    var caption = table.querySelector('caption');

    if (head && body && keys.length) {
      head.innerHTML = '<th scope="col">Банк и карта</th>' +
        keys.map(function (k) { return '<th scope="col">' + esc(k) + '</th>'; }).join('') +
        '<th scope="col">Оформление</th>';

      body.innerHTML = live.map(function (o) {
        var map = {};
        (o.specs || []).forEach(function (p) { map[text(p[0])] = text(p[1]); });

        var cells = keys.map(function (k) {
          var v = map[k] || 'Уточняйте у банка';
          var mark = yes(v) ? '<span class="ic ic--yes" aria-hidden="true"></span>' : '';
          var cls = /^0\s*₽$/.test(v) ? ' class="nowrap"' : '';
          return '<td' + cls + '>' + mark + esc(v) + '</td>';
        }).join('');

        var cta = ctaLink(o, 'btn--sm btn--table');

        return '<tr><th scope="row"><span class="tbank">' + plate(o, 'plate--xs') +
          esc(o.partner) + ', ' + esc(o.title) + '</span></th>' + cells +
          '<td>' + (cta || 'На сайте банка') + '</td></tr>';
      }).join('');

      if (caption) {
        caption.textContent = 'Сравнение карт: ' +
          live.map(function (o) { return text(o.partner); }).join(', ') +
          '. Колонки: ' + keys.join(', ').toLowerCase() + ' и переход к оформлению.';
      }
    }
  }

}());

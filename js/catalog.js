/* ==========================================================================
   Рисует сводку, кнопки разделов, карточки и таблицу сравнения из data.js.

   Грузится ДО app.js: тот меряет ширину таблицы и рисует звёзды уже
   по готовой разметке. После каждой перерисовки шлём событие
   'ft:catalog-rendered' — app.js по нему пересчитывает, нужен ли таблице
   фокус для прокрутки с клавиатуры.

   В index.html те же блоки лежат статикой — это запасной вариант.
   Если PHP на хостинге выключат или data.js не загрузится, посетитель
   всё равно увидит нормальную страницу, просто без правок из панели.

   РАЗДЕЛЫ. Каталог разбит по категориям (дебетовые карты, кредитные,
   МФО, РКО, иные продукты). Над карточками стоит ряд кнопок-фильтров:
   нажатие меняет карточки и таблицу сравнения, сводка в первом экране
   не трогается — она про весь каталог сразу. Кнопки рисуются только
   тогда, когда заполненных разделов больше одного, и только для тех
   разделов, где есть хотя бы одно видимое предложение: пустая вкладка
   на живом сайте выглядит поломкой.
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

  /* ---------------------------------------------------------------- утилиты */

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function text(v) { return String(v == null ? '' : v).trim(); }
  /* Значение условия. Старая панель сохраняла «от 3 000 до 100 000 ₽;»
     вместе с точкой с запятой из списка клиента — на сайте она лишняя. */
  function val(v) { return text(v).replace(/[\s;,]+$/, ''); }

  /* Меняем ТОЛЬКО текст существующего узла. Перерисовать заголовок целиком
     нельзя: на его id ссылаются aria-labelledby разделов, и вместе с узлом
     пропал бы и сам ориентир в списке областей страницы. */
  function set(sel, value) {
    var n = document.querySelector(sel);
    if (n && text(value)) n.textContent = value;
  }

  /* 1 предложение / 2 предложения / 5 предложений.
     Проверки на % 100 обязательны: без них выходит «11 предложение». */
  function plural(n, one, few, many) {
    var d10 = n % 10, d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return one;
    if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
    return many;
  }
  function offersWord(n) { return n + ' ' + plural(n, 'предложение', 'предложения', 'предложений'); }

  /* Сокращения вроде «МФО» и «РКО» оставляем заглавными: синтезатор речи
     читает «мфо» словом, а «МФО» — по буквам, как и надо. Смотрим первое
     слово, а не всю строку: в «МФО и продукт» сокращение тоже первое. */
  function soft(s) {
    s = text(s);
    if (!s) return s;
    var first = s.split(/\s+/)[0];
    if (first.length > 1 && first === first.toUpperCase()) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  function initials(name) {
    var parts = text(name).split(/\s+/).filter(Boolean);
    var s = parts.length > 1 ? parts[0][0] + parts[1][0] : text(name).slice(0, 2);
    return s.toUpperCase();
  }

  /* Логотип на белой подложке. Без файла — буквы партнёра в его цвете:
     подложка тогда красится, а не остаётся белым пятном. Буквы скрыты
     от скринридера: рядом и так стоит полное название, а в строке таблицы
     заголовок читается перед каждой ячейкой — «ВТ ВТБ» звучало бы дважды. */
  function plate(o, cls) {
    if (text(o.logo)) {
      /* Размер задаём высотой: у ВТБ логотип широкий, у ОТП квадратный —
         по ширине они получались бы разного веса. */
      return '<span class="plate ' + cls + '"><img class="plate__img" src="' + esc(o.logo) +
             '" alt="" loading="lazy" decoding="async"></span>';
    }
    var tone = o.tone || {};
    return '<span class="plate ' + cls + ' plate--letters" aria-hidden="true" style="background:' +
           esc(tone.bg || '#1B3A8C') + ';color:' + esc(tone.ink || '#FFFFFF') + '">' +
           esc(initials(o.partner)) + '</span>';
  }

  /* Название предложения: у займа или счёта своего «названия продукта»
     может не быть — тогда обходимся именем партнёра. */
  function fullName(o) {
    var a = text(o.partner), b = text(o.title);
    return a && b ? a + ' — ' + b : (a || b || 'Предложение');
  }

  /* Пояснение к кнопке для скринридера: одинаковых «Оформить» на странице
     несколько, и без него их не различить в списке ссылок. */
  function ctaLink(o, cls, cta) {
    if (!text(o.url)) return '';
    return '<a class="btn ' + cls + '" href="' + esc(o.url) + '" target="_blank" ' +
           'rel="nofollow sponsored noopener" referrerpolicy="strict-origin-when-cross-origin">' +
           esc(cta) + '<span class="vh"> — ' + esc(fullName(o)) +
           ' (откроется в новой вкладке)</span></a>';
  }

  /* Галочку ставим только там, где условие и правда бесплатное. Смысл всё
     равно несёт текст рядом — цветом и значком ничего не сообщается. */
  function yes(value) {
    return /^\s*(0\s*₽|бесплатн|да\b)/i.test(String(value || ''));
  }

  /* ------------------------------------------------------------- разделы */

  /* Раскладываем предложения по разделам в том порядке, в каком разделы
     идут в панели. Предложение с неизвестным разделом не теряем — оно
     уходит в первый. Пустые разделы отбрасываем. */
  function buildGroups() {
    var known = {}, out = [];
    (cats.length ? cats : [{ id: 'cards', label: 'Предложения' }]).forEach(function (c) {
      var g = { cat: c, items: [] };
      known[c.id] = g;
      out.push(g);
    });

    live.forEach(function (o) {
      var g = known[o.cat] || out[0];
      g.items.push(o);
    });

    return out.filter(function (g) { return g.items.length > 0; });
  }

  var groups = buildGroups();
  if (!groups.length) return;
  var activeIndex = 0;
  var sayTimer = 0;

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

  /* ------------------------------------------------------------------ цифры */

  var partners = {};
  live.forEach(function (o) { if (text(o.partner)) partners[text(o.partner)] = 1; });
  set('#stat-partners', String(Object.keys(partners).length || live.length));
  set('#stat-offers', String(live.length));

  /* ------------------------------------------------------------------ сводка
     Сводку в первом экране кнопки разделов не трогают: она подписана
     «Сводка предложений» и говорит про весь каталог. Строк показываем
     не больше четырёх — иначе первый экран уезжает вниз. */

  var BOARD_MAX = 4;
  var board = document.querySelector('.board__list');
  if (board) {
    board.innerHTML = live.slice(0, BOARD_MAX).map(function (o) {
      var cells = (o.specs || []).filter(function (p) { return val(p[1]); }).slice(0, 2).map(function (p) {
        return '<span class="board__cell"><span class="board__label">' + esc(p[0]) +
               '</span><span class="board__value">' + esc(val(p[1])) + '</span></span>';
      }).join('');
      return '<li class="board__row">' + plate(o, 'plate--sm') +
        '<span class="board__bank">' + esc(text(o.partner) || text(o.title)) +
        '<span class="board__card">' + esc(text(o.partner) ? o.title : '') + '</span></span>' +
        cells + '</li>';
    }).join('');
  }
  var count = document.querySelector('.board__count');
  if (count) {
    /* «3 из 3» само по себе ничего не сообщает: что считаем — было видно
       только зрячему по соседнему списку. */
    count.innerHTML = '<span aria-hidden="true">◍</span><span class="vh">Показано предложений: </span>' +
      Math.min(BOARD_MAX, live.length) + ' из ' + live.length;
  }

  /* --------------------------------------------------------- кнопки разделов
     Это фильтр, а не вкладки: один набор кнопок меняет сразу две области
     страницы, и ни одна из них не может быть «панелью» ровно одной вкладки.
     Поэтому обычные кнопки с aria-pressed, по одному табстопу на каждую.

     Разметку кнопок рисует скрипт, а не index.html: без JS фильтровать
     нечем, и статические кнопки остались бы вечно нажатыми. Живая область
     #offers-status, наоборот, лежит в разметке — объявляется только то,
     что было на странице до изменения. */

  /* Рядов кнопок два, и они синхронны: над карточками и над таблицей
     сравнения. Клиент просил сравнивать не только дебетовые карты, а таблица
     и так переключалась — но только кнопками из блока «Предложения», и из
     раздела «Сравнение» до них было не добраться. Нажатие в любом ряду меняет
     раздел на всей странице: карточки, заголовок и таблицу. */
  function makeRow(labelId, labelText) {
    var wrap = document.createElement('div');
    wrap.className = 'chip-row';
    wrap.innerHTML = '<p class="chip-row__label" id="' + labelId + '">' + esc(labelText) + '</p>' +
      '<div class="chip-row__group" role="group" aria-labelledby="' + labelId + '">' +
      groups.map(function (g, i) {
        return '<button class="chip" type="button" data-i="' + i + '" aria-pressed="' +
          (i === activeIndex ? 'true' : 'false') + '">' +
          '<span class="chip__mark" aria-hidden="true"></span>' +
          '<span class="chip__name">' + esc(text(g.cat.label) || 'Раздел') + '</span> ' +
          '<span class="chip__n">' + g.items.length + '</span></button>';
      }).join('') + '</div>';
    wrap.addEventListener('click', onChip);
    return wrap;
  }

  function buildChooser() {
    if (groups.length < 2) return;

    var status = document.getElementById('offers-status');
    if (status && status.parentNode) {
      status.parentNode.insertBefore(makeRow('chip-row-label', 'Раздел каталога'), status);
    }

    /* Над таблицей, под заголовком «Сравнение условий». */
    var scroller = document.querySelector('#compare .table-scroll');
    if (scroller && scroller.parentNode) {
      scroller.parentNode.insertBefore(makeRow('chip-row-label-compare', 'Что сравнить'), scroller);
    }
  }

  function onChip(e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    /* Фокус ставим сами и от кнопки из события: в Safari и Firefox
       на macOS щелчок по кнопке не всегда делает её activeElement,
       и следующий Tab уехал бы в начало страницы. preventScroll
       обязателен — иначе страница дёрнется. */
    btn.focus({ preventScroll: true });
    var i = parseInt(btn.getAttribute('data-i'), 10);
    if (isNaN(i) || i === activeIndex) return;     // повторное нажатие молчит
    activeIndex = i;
    /* Нажатое состояние — в обоих рядах сразу. */
    Array.prototype.forEach.call(document.querySelectorAll('.chip-row .chip'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-i') === String(i) ? 'true' : 'false');
    });

    /* Высота блока над нажатой кнопкой меняется: заголовок раздела
       бывает в две строки и в три, а у кнопок над таблицей сверху
       целиком перерисовываются карточки. Без поправки нажатая кнопка
       уезжала бы — вплоть до того, что пряталась под липкой шапкой.
       Ловим сдвиг и возвращаем кнопку на то же место. scroll-behavior
       на время правки переключаем на auto: иначе плавная прокрутка
       из стилей превращает поправку в заметный рывок. */
    var top = btn.getBoundingClientRect().top;
    /* Над таблицей первым говорим про таблицу — она рядом с кнопкой. */
    show(i, btn.closest('#compare') ? 'table' : 'cards');
    var delta = btn.getBoundingClientRect().top - top;
    if (delta) {
      var root = document.documentElement;
      var prev = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollBy(0, delta);
      root.style.scrollBehavior = prev;
    }
  }

  /* Живую область сначала чистим, текст ставим следующей задачей: иначе
     два одинаковых сообщения подряд (два раздела с равным числом
     предложений) диктор посчитает повтором и промолчит. */
  function say(message) {
    var node = document.getElementById('offers-status');
    if (!node) return;
    node.textContent = '';
    window.clearTimeout(sayTimer);
    sayTimer = window.setTimeout(function () { node.textContent = message; }, 150);
  }

  /* ------------------------------------------------------------- карточки */

  function renderCards(g) {
    var box = document.querySelector('.cards');
    if (!box) return;
    var cta = text(g.cat.cta) || 'Оформить';

    box.innerHTML = g.items.map(function (o, i) {
      /* id привязан к разделу: одинаковые «offer-1-title» в двух разделах
         дали бы карточке чужое имя — aria-labelledby берёт первый
         совпавший id в документе. */
      var id = 'offer-' + esc(g.cat.id || 'x') + '-' + (i + 1) + '-title';
      var num = (i + 1) < 10 ? '0' + (i + 1) : String(i + 1);

      var specs = (o.specs || []).map(function (p) {
        var value = val(p[1]);
        return '<li><span class="ic" aria-hidden="true"></span>' +
               esc(p[0]) + (value ? ' — ' + esc(value) : '') + '</li>';
      }).join('');

      var link = ctaLink(o, 'btn--primary btn--block card__cta', cta);

      return '<li><article class="card" aria-labelledby="' + id + '">' +
        '<p class="card__bar">' +
          '<span class="card__num">' + num + '</span>' +
          '<span class="card__type">' + esc(o.tag || text(g.cat.label) || 'Предложение') + '</span>' +
          (text(o.badge) ? '<span class="badge">' + esc(o.badge) + '</span>' : '') +
        '</p>' +
        plate(o, '') +
        '<h3 class="card__title" id="' + id + '">' + esc(fullName(o)) + '</h3>' +
        (text(o.note) ? '<p class="card__lead">' + esc(o.note) + '</p>' : '') +
        (specs ? '<ul class="card__specs" role="list">' + specs + '</ul>' : '') +
        (link ? '<p class="card__cta-wrap">' + link + '</p>' : '') +
        '<p class="card__fine">Актуальные условия — на сайте партнёра.</p>' +
        '</article></li>';
    }).join('');
  }

  /* -------------------------------------------------------- таблица сравнения

     Колонки собираем по всему разделу и ставим в порядке, в каком условия
     встречаются чаще. Брать их у первой карточки, как было раньше, нельзя:
     стоило клиенту скрыть её или добавить оффер с другим набором условий,
     и данные, видные в карточке, молча пропадали из таблицы.

     Саму таблицу не пересоздаём: на <caption id="cards-cap"> ссылается
     aria-labelledby контейнера, а область без имени вообще не попадает
     в список областей страницы. Меняем только строки и текст подписи. */

  function columnsOf(items) {
    var order = [], hits = {};
    items.forEach(function (o) {
      (o.specs || []).forEach(function (p) {
        var k = text(p[0]);
        /* Строка без значения («Без залога») — пометка для карточки,
           а не колонка: в таблице у всех стояло бы «Не указано». */
        if (!k || !val(p[1])) return;
        if (hits[k] == null) { hits[k] = 0; order.push(k); }
        hits[k]++;
      });
    });
    var seen = {};
    order.forEach(function (k, i) { seen[k] = i; });
    return order.slice().sort(function (a, b) {
      return (hits[b] - hits[a]) || (seen[a] - seen[b]);
    }).slice(0, 4);
  }

  function renderTable(g) {
    var table = document.querySelector('.table');
    if (!table) return;
    var head = table.querySelector('thead tr');
    var body = table.querySelector('tbody');
    var caption = table.querySelector('caption');
    if (!head || !body) return;

    var items = g.items;
    var cols = columnsOf(items);
    var rowHead = text(g.cat.rowHeader) || 'Партнёр и продукт';
    var empty = text(g.cat.emptyCell) || 'Не указано';
    var cta = text(g.cat.cta) || 'Оформить';

    /* Ширина таблицы по числу колонок: фиксированные 900 px заставляли
       прокручивать вбок даже раздел из трёх колонок. */
    table.style.setProperty('--cols', String(cols.length + 2));

    head.innerHTML = '<th scope="col">' + esc(rowHead) + '</th>' +
      cols.map(function (k) { return '<th scope="col">' + esc(k) + '</th>'; }).join('') +
      '<th scope="col">Оформление</th>';

    body.innerHTML = items.map(function (o) {
      var map = {};
      (o.specs || []).forEach(function (p) { map[text(p[0])] = val(p[1]); });

      var cells = cols.map(function (k) {
        var v = map[k] || empty;
        var mark = yes(v) ? '<span class="ic ic--yes" aria-hidden="true"></span>' : '';
        var cls = /^0\s*₽$/.test(v) ? ' class="nowrap"' : '';
        return '<td' + cls + '>' + mark + esc(v) + '</td>';
      }).join('');

      var link = ctaLink(o, 'btn--sm btn--table', cta);

      return '<tr><th scope="row"><span class="tbank">' + plate(o, 'plate--xs') +
        esc(fullName(o)) + '</span></th>' + cells +
        '<td>' + (link || 'На сайте партнёра') + '</td></tr>';
    }).join('');

    if (caption) {
      caption.textContent = 'Раздел «' + text(g.cat.label) + '». Всего предложений: ' +
        items.length + '. Колонки: ' +
        [rowHead].concat(cols).concat(['оформление']).map(soft).join(', ') + '.';
    }
  }

  /* ------------------------------------------------------------- переключение */

  function show(i, speak) {
    var g = groups[i];
    if (!g) return;

    /* Заголовок меняем до содержимого и в той же задаче: иначе диктор
       успел бы прочитать область, у которой имя и начинка расходятся. */
    set('#offers-title', text(g.cat.h2) || text(g.cat.label));
    set('#compare-sub', 'Раздел «' + text(g.cat.label) + '». Всего предложений: ' + g.items.length + '.');

    renderCards(g);
    renderTable(g);

    /* app.js пересчитает, нужен ли таблице фокус для прокрутки: от смены
       раздела не срабатывают ни resize, ни load. */
    document.dispatchEvent(new CustomEvent('ft:catalog-rendered'));

    /* Имя раздела в сообщение не кладём: кнопка и так прочитала своё имя
       и состояние. Живая область говорит то, чего кнопка сказать не может, —
       что стало с остальной страницей. */
    if (speak === 'table') {
      say('Таблица сравнения обновлена. Показано ' + offersWord(g.items.length) + '.');
    } else if (speak) {
      say('Показано ' + offersWord(g.items.length) + '. Таблица сравнения обновлена.');
    }
  }

  buildChooser();
  show(0, false);

}());

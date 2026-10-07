/* ═══════════════════════════════════════════════════════════════════════
   МОНОЛИТ — поведение главной: каталог из data.js (правится в
   panel.html), плитки разделов, фильтр и поиск, карточки с
   мини-картами банков, лента партнёров, веер карт на камнях в первом экране.

   Раздел, добавленный в панели, появляется на сайте сам: плитки, кнопки
   фильтра и секции строятся из CATEGORIES, карточки — из OFFERS.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Каталог объявлен глобальными const (data.php или data.js), а const мимо
     window не переприсвоить — работаем с локальными копиями. На адресе
     index.html?draft=1 подставляется черновик из панели («Предпросмотр»). */
  var site   = typeof SITE       !== 'undefined' ? SITE       : {};
  var cats   = typeof CATEGORIES !== 'undefined' ? CATEGORIES : [];
  var offers = typeof OFFERS     !== 'undefined' ? OFFERS     : [];
  if (/[?&]draft/.test(location.search)) {
    try {
      var draftFile = localStorage.getItem('monolit_admin_draft:file');
      if (draftFile) {
        var d = new Function(draftFile + '\n;return { SITE: SITE, CATEGORIES: CATEGORIES, OFFERS: OFFERS };')();
        site = d.SITE || site; cats = d.CATEGORIES || cats; offers = d.OFFERS || offers;
      }
    } catch (e) { /* битый черновик — показываем боевой каталог */ }
  }
  offers = offers.filter(function (o) { return o && !o.hidden; });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; }
  function offersWord(n) { return plural(n, 'предложение', 'предложения', 'предложений'); }
  function okLink(u) { return /^https?:\/\//i.test(u || ''); }
  function erid(u) { var m = /[?&]erid=([^&#]+)/i.exec(u || ''); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return m[1]; } }
  var ARROW = '<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-arrow"/></svg>';
  var NFC = '<svg class="mini__nfc" viewBox="0 0 40 60" aria-hidden="true" focusable="false"><use href="#i-nfc"/></svg>';

  /* ── цвета брендов ────────────────────────────────────────────────── */
  function hex6(h) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim());
    if (!m) return null;
    var s = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return '#' + s.toUpperCase();
  }
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(h, to, k) {
    var a = rgb(h), b = rgb(to);
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * k); }).join(',') + ')';
  }
  function lum(h) {
    return rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); })
      .reduce(function (s, v, i) { return s + v * [.2126, .7152, .0722][i]; }, 0);
  }
  /* Фирменный цвет: tone.bg из панели; если там нейтральный чёрный по
     умолчанию — берём известный цвет логотипа из js/brands.js. */
  var BRAND = window.BRAND_COLORS || {};
  function brandOf(o) {
    /* у «Black» карта и правда чёрная — жёлтая выглядела бы чужой */
    if (/\bblack\b/i.test(o.title || '')) return '#1C1C1E';
    var t = hex6(o.tone && o.tone.bg);
    var file = String(o.logo || '').split(/[?#]/)[0].split('/').pop();
    var known = hex6(BRAND[file]);
    if (t && t !== '#0B0B0C' && t !== '#000000') return t;
    return known || t || '#6B7280';
  }

  /* ── тексты сайта из панели ───────────────────────────────────────── */
  var brand = String(site.brand == null ? '' : site.brand).trim();
  if (brand) {
    var latin = /^[\x20-\x7E]+$/.test(brand);
    $$('[data-brand]').forEach(function (n) { n.textContent = brand; if (latin) n.setAttribute('lang', 'en'); else n.removeAttribute('lang'); });
    $$('[data-brand-text]').forEach(function (n) { n.textContent = brand; });
    document.title = brand + ' — дебетовые и кредитные карты, займы МФО онлайн';
  }

  var byCat = {};
  cats.forEach(function (c) { byCat[c.id] = offers.filter(function (o) { return o.cat === c.id; }); });
  var nonEmpty = cats.filter(function (c) { return byCat[c.id].length; });
  var live = offers.filter(function (o) { return byCat[o.cat]; });

  /* Плашка над заголовком: «Обновлено 3 октября · 50 предложений». Дату
     даёт сервер (Last-Modified каталога); нет сервера — строка из панели. */
  var pill = $('#pill');
  var tagline = String(site.tagline || '').trim();
  if (pill) pill.textContent = tagline || (live.length + ' ' + offersWord(live.length) + ' банков и МФО');
  /* на GitHub Pages нет PHP — дату не спрашиваем, чтобы не сыпать 404 */
  if (pill && window.fetch && location.protocol !== 'file:' && !/github\.io$/.test(location.hostname)) {
    fetch('data.php', { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      var lm = r.ok && r.headers.get('Last-Modified');
      var dt = lm ? new Date(lm) : null;
      if (dt && !isNaN(dt)) {
        pill.textContent = 'Обновлено ' + dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) +
          ' · ' + live.length + ' ' + offersWord(live.length);
      }
    }).catch(function () { /* остаётся строка из панели */ });
  }

  var facts = $('#facts');
  if (facts) {
    var firms = {};
    live.forEach(function (o) { firms[String(o.partner || '').trim().toLowerCase()] = 1; });
    var nf = Object.keys(firms).length;
    facts.innerHTML =
      '<li><b>' + live.length + '</b><span>' + offersWord(live.length) + '</span></li>' +
      '<li><b>' + nf + '</b><span>' + plural(nf, 'компания', 'компании', 'компаний') + '</span></li>' +
      '<li><b>' + nonEmpty.length + '</b><span>' + plural(nonEmpty.length, 'раздел', 'раздела', 'разделов') + '</span></li>';
  }

  /* ── плитки разделов ──────────────────────────────────────────────── */
  var CAT_NOTE = { debit: 'Кешбэк и оформление онлайн', credit: 'Льготный период и кешбэк', mfo: 'Деньги на карту онлайн' };
  var bento = $('#bento');
  if (bento) {
    bento.innerHTML = nonEmpty.map(function (c) {
      var n = byCat[c.id].length, seen = {}, logos = '';
      byCat[c.id].forEach(function (o) {
        if (!o.logo || seen[o.logo] || Object.keys(seen).length >= 4) return;
        seen[o.logo] = 1;
        logos += '<img src="' + esc(o.logo) + '" alt="" width="28" height="28" loading="lazy">';
      });
      return '<li><a class="tile" href="#cat-' + esc(c.id) + '" data-f="' + esc(c.id) + '">' +
        /* крупная цифра — украшение: то же число есть в тексте «17 вариантов» */
        '<span class="tile__num" aria-hidden="true">' + n + '</span>' +
        '<span class="tile__arrow" aria-hidden="true">' + ARROW + '</span>' +
        '<span class="tile__txt"><b>' + esc(c.label) + '<span class="vh">,</span></b><span>' + n + ' ' + plural(n, 'вариант', 'варианта', 'вариантов') +
          (CAT_NOTE[c.id] ? '<span class="tile__note"><span aria-hidden="true"> · </span><span class="vh">, </span>' + CAT_NOTE[c.id] + '</span>' : '') + '</span>' +
          (logos ? '<span class="tile__logos" aria-hidden="true">' + logos + '</span>' : '') +
        '</span></a></li>';
    }).join('');
  }
  /* разделов, которых нет в каталоге, в меню и подвале быть не должно */
  $$('a[href^="#cat-"]').forEach(function (a) {
    if (!byCat[a.getAttribute('href').slice(5)] || !byCat[a.getAttribute('href').slice(5)].length) (a.closest('.hdr li') || a).hidden = true;
  });

  /* ── поиск: синонимы, которые люди реально набирают ───────────────── */
  var ALIASES = {
    'т-банк': 'тинькофф тинькоф tinkoff tbank т банк тбанк', 'т-мобайл': 'тинькофф tinkoff mobile т мобайл тмобайл симка',
    'альфа-банк': 'alfa альфабанк', 'ozon банк': 'озон озонбанк', 'втб': 'vtb', 'сбербанк': 'сбер sber sberbank',
    'совкомбанк': 'совком sovcombank халва', 'отп банк': 'otp', 'псб': 'промсвязьбанк psb', 'ак барс банк': 'акбарс ak bars',
    'уралсиб': 'uralsib', 'убрир': 'ubrir уральский', 'фора-банк': 'фора fora', 'банк зенит': 'зенит zenit',
    'кредит европа банк': 'credit europe кредитевропа', 'займер': 'zaymer zaimer', 'moneyman': 'манимен мани мэн манимэн',
    'а деньги': 'аденьги adengi', 'max.credit': 'макс кредит maxcredit макскредит', 'умные наличные': 'smartcash смарткэш',
    'свои люди': 'svoi ludi', 'joymoney': 'джоймани джой мани', 'мигкредит': 'migcredit миг кредит', 'platiza': 'платиза',
    'лайм-займ': 'lime лайм limezaim', 'webbankir': 'веббанкир вэббанкир вебанкир', 'до зарплаты': 'dozarplati',
    'деньги сразу': 'dengisrazu', 'деньги на дом': 'denginadom', 'rocketman': 'рокетмэн рокетмен', 'быстроденьги': 'bistrodengi быстро деньги',
    'смс финанс': 'sms finance smsfinance', 'срочно деньги': 'srochnodengi', 'zaymigo': 'займиго', 'турбозайм': 'turbozaim турбо',
    'oneclickmoney': 'ванкликмани ван клик мани one click', 'надо денег': 'nadodeneg', 'центрофинанс': 'centrofinans центро',
    'привет, сосед': 'привет сосед privet sosed'
  };
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim(); }
  live.forEach(function (o) {
    o._hay = ' ' + norm([o.partner, o.title, o.tag, o.headline, ALIASES[String(o.partner || '').toLowerCase()] || ''].join(' ')) + ' ';
  });
  function matches(o, q) { return !q || q.split(' ').every(function (w) { return o._hay.indexOf(w) !== -1; }); }

  /* ── карточка ─────────────────────────────────────────────────────── */
  /* «номер» мини-карты: стабильный для оффера, у соседних карточек разный */
  function last4(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return String((h >>> 0) % 10000).padStart(4, '0'); }
  function chips(o, c) {
    var t = (o.headline + ' ' + o.note + ' ' + o.title).toLowerCase(), list = [];
    if (c.id === 'mfo') { list.push(['hot', 'Быстро'], ['online', 'Онлайн']); }
    else {
      if (/кешб|кэшб/.test(t)) list.push(['cash', 'Кешбэк']);
      if (/дней без процент|без %/.test(t)) list.push(['hot', 'Без %']);
      else if (/беспроцентн|льготн/.test(t)) list.push(['free', 'Льготный период']);
      if (/иностран|нерезидент/.test(t)) list.push(['free', 'Для иностранцев']);
      list.push(['online', 'Онлайн']);
    }
    return '<ul class="badges" role="list" aria-label="Метки">' + list.slice(0, 3).map(function (b) {
      return '<li class="chip chip--' + b[0] + '"><i aria-hidden="true"></i>' + esc(b[1]) + '</li>';
    }).join('') + '</ul>';
  }
  function media(o, c, color, light) {
    var lg = o.logo ? 'src="' + esc(o.logo) + '" alt="" loading="lazy" decoding="async"' : '';
    var asCard = (c.id === 'debit' || c.id === 'credit') && !/сим/i.test(o.tag || '');
    if (asCard) {
      return '<div class="mini' + (light ? ' is-light' : '') + '"><div class="mini__top">' +
        (lg ? '<img class="mini__logo" ' + lg + ' width="22" height="22">' : '') + '<span>' + esc(o.partner || o.title) + '</span>' + NFC + '</div>' +
        '<div class="mini__row"><span class="mini__chip"></span><span class="mini__num">•••• ' + last4(o.partner + o.title) + '</span></div></div>';
    }
    if (lg) return '<img class="card__logo" ' + lg + ' width="76" height="76">';
    var ink = (lum(color) + .05) / .05 >= 1.05 / (lum(color) + .05) ? '#000000' : '#FFFFFF';
    return '<span class="card__logo card__logo--mono" style="background:' + color + ';color:' + ink + '">' + esc(String(o.partner || '?').trim().charAt(0)) + '</span>';
  }
  function card(o, c, i) {
    var cta = c.cta || 'Оформить';
    var color = brandOf(o);
    var light = lum(color) > .45;
    var ad = erid(o.url);
    var name = esc(o.title) + (o.partner ? ', ' + esc(o.partner) : '');
    /* Без ссылки кнопка всё равно есть: нажатие честно говорит, что ссылку
       скоро добавят. Видимое слово — первым в имени (голосовое управление). */
    var btn = okLink(o.url)
      ? '<a class="cta" href="' + esc(o.url) + '" target="_blank" rel="sponsored noopener">' + esc(cta) + ARROW + '<span class="vh"> — ' + name + ' (откроется в новой вкладке)</span></a>'
      : '<button class="cta" type="button" data-empty>' + esc(cta) + ARROW + '<span class="vh"> — ' + name + '</span></button>';
    /* подложка — цвет бренда, утопленный в чёрный (16%); светлые цвета
       (жёлтый Т-Банка) — всего 7%, иначе выходит грязно-оливковый */
    var style = '--brand:' + color + ';--brand-hi:' + mix(color, '#FFFFFF', .22) + ';--brand-lo:' + mix(color, '#000000', .3) + ';--tint:' + mix(color, '#121212', lum(color) > .4 ? .93 : .84);
    return '<li class="card" id="ofr-' + esc(c.id) + '-' + i + '" style="' + style + '">' +
      '<div class="card__body">' +
        '<div class="card__titles"><h4>' + esc(o.title) + '</h4>' + (o.partner ? '<span class="card__brand">' + esc(o.partner) + '</span>' : '') + '</div>' +
        chips(o, c) +
        (o.headline ? '<p class="card__cond">' + esc(o.headline) + '</p>' : '') +
        (o.note ? '<p class="card__desc">' + esc(o.note.charAt(0).toUpperCase() + o.note.slice(1)) + '.</p>' : '') +
        ((o.specs || []).filter(function (p) { return p && (p[0] || p[1]); }).length
          ? '<dl class="specs">' + o.specs.filter(function (p) { return p && (p[0] || p[1]); }).map(function (p) {
              return '<div><dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
        '<div class="card__foot">' + btn + '<span class="ad">Реклама' + (ad ? '<br>erid ' + esc(ad) : '') + '</span></div>' +
        '<p class="card__note"></p>' +
      '</div>' +
      '<div class="card__media" aria-hidden="true"><span class="card__idx">' + String(i + 1).padStart(2, '0') + '</span>' + media(o, c, color, light) + '</div>' +
    '</li>';
  }

  /* ── каталог: фильтр + поиск ──────────────────────────────────────── */
  var filtersBox = $('#filters'), sectionsBox = $('#sections'), input = $('#q');
  var empty = $('#empty'), emptyText = $('#empty-text');
  var countSt = $('#count-status'), ctaSt = $('#cta-status');
  var active = 'all', query = '', countT = 0, ctaT = 0, ctaClearT = 0;

  function cnt(n, word) { return '<span>' + n + '<span class="vh"> ' + (word || offersWord)(n) + '</span></span>'; }
  function hitWord(n) { return plural(n, 'совпадение', 'совпадения', 'совпадений'); }

  if (filtersBox && sectionsBox) {
    filtersBox.innerHTML = '<button class="fbtn" type="button" data-f="all" data-name="Все разделы" aria-pressed="true">Все ' + cnt(live.length) + '</button>' +
      nonEmpty.map(function (c) {
        return '<button class="fbtn" type="button" data-f="' + esc(c.id) + '" data-name="' + esc(c.label) + '" aria-pressed="false">' + esc(c.label) + ' ' + cnt(byCat[c.id].length) + '</button>';
      }).join('');
    sectionsBox.innerHTML = nonEmpty.map(function (c) {
      return '<section class="cat" id="cat-' + esc(c.id) + '" data-cat="' + esc(c.id) + '" aria-labelledby="h-' + esc(c.id) + '">' +
        '<div class="cat__head"><h3 id="h-' + esc(c.id) + '">' + esc(c.label) + '</h3>' + cnt(byCat[c.id].length) + '</div>' +
        '<ul class="grid" role="list">' + byCat[c.id].map(function (o, i) { return card(o, c, i); }).join('') + '</ul></section>';
    }).join('') || '<p class="state">Предложений пока нет — загляните позже.</p>';
    /* связываем DOM-карточки с офферами, чтобы поиск не перерисовывал сетку */
    nonEmpty.forEach(function (c) {
      $$('#cat-' + c.id + ' .card').forEach(function (el, i) { el._o = byCat[c.id][i]; });
    });
  }

  function found(id) { return (byCat[id] || []).filter(function (o) { return matches(o, query); }).length; }
  function apply() {
    var shown = 0;
    $$('.fbtn', filtersBox).forEach(function (b) {
      var f = b.getAttribute('data-f');
      b.setAttribute('aria-pressed', String(f === active));
      var n = f === 'all' ? nonEmpty.reduce(function (s, c) { return s + (query ? found(c.id) : byCat[c.id].length); }, 0)
                          : (query ? found(f) : byCat[f].length);
      var box = b.lastElementChild;
      box.firstChild.nodeValue = String(n);
      box.lastElementChild.textContent = ' ' + (query ? hitWord(n) : offersWord(n));
    });
    $$('.cat', sectionsBox).forEach(function (s) {
      var on = active === 'all' || s.getAttribute('data-cat') === active, k = 0;
      $$('.card', s).forEach(function (el) { var m = on && matches(el._o, query); el.hidden = !m; if (m) k++; });
      s.hidden = !on || !k;
      var head = s.querySelector('.cat__head > span');
      if (head) { head.firstChild.nodeValue = String(query ? k : byCat[s.getAttribute('data-cat')].length); head.lastElementChild.textContent = ' ' + (query ? hitWord(k) : offersWord(k)); }
      shown += k;
    });
    if (empty) {
      empty.hidden = !!shown;
      if (!shown) {
        var label = active === 'all' ? 'во всех разделах' : 'в разделе «' + ($('.fbtn[data-f="' + active + '"]', filtersBox) || {}).getAttribute('data-name') + '»';
        var elsewhere = active !== 'all' && nonEmpty.some(function (c) { return found(c.id); });
        emptyText.textContent = query
          ? 'По запросу «' + input.value.trim() + '» ' + label + ' ничего нет.' + (elsewhere ? ' Есть совпадения в других разделах — нажмите «Все» в фильтре.' : '')
          : 'В этом разделе пока нет предложений.';
      }
    }
    return shown;
  }
  function status(text, now) {
    clearTimeout(countT);
    if (now) { countSt.textContent = ''; countT = setTimeout(function () { countSt.textContent = text(); }, 120); }
    else countT = setTimeout(function () { countSt.textContent = text(); }, 600);
  }
  function statusText() {
    var shown = $$('.card:not([hidden])', sectionsBox).length;
    var name = ($('.fbtn[data-f="' + active + '"]', filtersBox) || { getAttribute: function () { return ''; } }).getAttribute('data-name');
    var t = (query ? 'Найдено: ' : '') + (name ? name + ': ' : '') + shown + ' ' + offersWord(shown);
    /* подсказку из пустого состояния дублируем в live-регион — иначе её не услышать */
    if (!shown && query && active !== 'all' && nonEmpty.some(function (c) { return found(c.id); }))
      t += '. Есть совпадения в других разделах — нажмите «Все» в фильтре.';
    return t;
  }
  function setFilter(f, announce) {
    active = f; apply();
    if (announce) status(statusText, true);
    else { clearTimeout(countT); countSt.textContent = ''; }   /* старый текст статуса врал бы о том, что показано */
  }

  /* переход к разделу. only — из плитки или кнопки первого экрана: показываем
     только его; из меню — все разделы. Фокус — на заголовок раздела. */
  function goToCat(f, only) {
    var sec = document.getElementById('cat-' + f), h = sec && sec.querySelector('h3');
    if (!h) return false;
    if (query) { input.value = ''; query = ''; }
    if (only) setFilter(f, false); else if (sec.hidden || active !== 'all') setFilter('all', false);
    sec.scrollIntoView({ block: 'start', behavior: reduceMq.matches ? 'auto' : 'smooth' });
    h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
    h.addEventListener('blur', function () { h.removeAttribute('tabindex'); }, { once: true });
    try { history.replaceState(null, '', '#cat-' + f); } catch (e) { /* file:// */ }
    if (only) status(function () {
      return 'Раздел «' + h.textContent + '»: ' + sec.querySelectorAll('.card:not([hidden])').length + ' ' + offersWord(sec.querySelectorAll('.card:not([hidden])').length) + '. Остальные скрыты, показать все — кнопка «Все» в фильтре.';
    }, true);
    return true;
  }

  document.addEventListener('click', function (e) {
    var fb = e.target.closest('.fbtn');
    if (fb) {
      setFilter(fb.getAttribute('data-f'), true);
      var s = $('.cat:not([hidden])') || empty, bars = hdr.offsetHeight + $('.filters').offsetHeight;
      if (s && s.getBoundingClientRect().top < bars) s.scrollIntoView({ block: 'start' });
      return;
    }
    var emptyBtn = e.target.closest('[data-empty]');
    if (emptyBtn) {
      var cardEl = emptyBtn.closest('.card');
      cardEl.querySelector('.card__note').textContent = 'Ссылку на оформление скоро добавим.';
      clearTimeout(ctaT); clearTimeout(ctaClearT); ctaSt.textContent = '';
      ctaT = setTimeout(function () { ctaSt.textContent = 'Ссылку на «' + cardEl.querySelector('h4').textContent + '» скоро добавим.'; }, 100);
      ctaClearT = setTimeout(function () { ctaSt.textContent = ''; }, 5000);
      return;
    }
    /* кликабельны только картинка и название: текст условий можно выделять
       двойным кликом (копировать, озвучивать), не улетая на сайт партнёра */
    var c = e.target.closest('.card__media, .card__titles');
    if (c && !e.target.closest('a, button') && !String(window.getSelection ? getSelection() : '')) { var go = c.closest('.card').querySelector('.cta'); if (go) go.click(); return; }
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    if (a.getAttribute('data-f')) { if (goToCat(a.getAttribute('data-f'), true)) e.preventDefault(); return; }
    var m = /^#cat-(.+)$/.exec(a.getAttribute('href'));
    if (m) { if (goToCat(m[1], false)) e.preventDefault(); return; }
    if (a.getAttribute('href') === '#catalog' && (active !== 'all' || query)) { input.value = ''; query = ''; setFilter('all', true); }
  });

  /* активная кнопка фильтра не уезжает за край ленты */
  document.addEventListener('focusin', function (e) {
    var b = e.target.closest && e.target.closest('.fbtn');
    if (!b) return;
    var box = b.parentElement, l = b.offsetLeft - 16, r = b.offsetLeft + b.offsetWidth + 16 - box.clientWidth;
    if (box.scrollLeft > l) box.scrollLeft = l; else if (box.scrollLeft < r) box.scrollLeft = r;
  });

  if (input) {
    input.addEventListener('input', function () { query = norm(input.value); apply(); status(statusText, false); });
    $('#find-form').addEventListener('submit', function (e) { e.preventDefault(); status(statusText, true); });
    $('#reset').addEventListener('click', function () { input.value = ''; query = ''; setFilter('all', true); input.focus(); });
  }

  /* ── лента партнёров ──────────────────────────────────────────────── */
  var mqList = $('#marquee-list'), mqTrack = $('#marquee-track'), mqBox = $('#marquee'), mqBtn = $('#mq-toggle');
  if (mqList && mqTrack) {
    var seenLogo = {}, items = '';
    live.forEach(function (o) {
      var key = o.logo || o.partner;
      if (!o.partner || seenLogo[key]) return;
      seenLogo[key] = 1;
      /* название стоит текстом рядом — картинке подпись не нужна */
      items += '<li>' + (o.logo ? '<img src="' + esc(o.logo) + '" alt="" width="30" height="30" loading="lazy">' : '') + esc(o.partner) + '</li>';
    });
    if (!items) $('.partners').hidden = true;
    else {
      mqList.innerHTML = items;
      var clone = mqList.cloneNode(true);
      clone.removeAttribute('id'); clone.removeAttribute('aria-label');
      clone.setAttribute('aria-hidden', 'true'); clone.setAttribute('inert', '');
      mqTrack.appendChild(clone);
      mqTrack.style.setProperty('--mq-dur', Math.max(30, Math.round((mqList.scrollWidth || 3000) / 40)) + 's');
      if (!reduceMq.matches) mqTrack.classList.add('is-running');
      if (mqBtn) mqBtn.addEventListener('click', function () {
        var paused = mqBox.classList.toggle('is-paused');
        $('.mq-toggle__t', mqBtn).textContent = paused ? 'Продолжить' : 'Пауза';
        $('use', mqBtn).setAttribute('href', paused ? '#i-play' : '#i-pause');
      });
    }
  }

  /* ── шапка: линия при прокрутке и реальная высота липких полос ────── */
  var hdr = $('#hdr');
  var onScroll = function () { hdr.classList.toggle('is-stuck', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var measureBars = function () {
    var r = document.documentElement.style;
    r.setProperty('--hdr', hdr.offsetHeight + 'px');
    var f = $('.filters'); if (f) r.setProperty('--flt', f.offsetHeight + 'px');
  };
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(measureBars); ro.observe(hdr); if ($('.filters')) ro.observe($('.filters')); }
  measureBars();

  /* тонкая полоска прокрутки под шапкой — украшение, aria-hidden */
  var prog = $('#progress');
  if (prog) {
    var progRaf = 0;
    var setProg = function () {
      progRaf = 0;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ')';
    };
    window.addEventListener('scroll', function () { if (!progRaf) progRaf = requestAnimationFrame(setProg); }, { passive: true });
    window.addEventListener('resize', setProg);
    setProg();
  }

  /* мягкий свет за курсором на плитках и карточках — только мышь и без
     «уменьшить движение»; фокус-кольцо он не заменяет */
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest('.tile, .card');
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--x', Math.round(e.clientX - r.left) + 'px');
      el.style.setProperty('--y', Math.round(e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ── веер карт: одна карта раскрывается в пять ────────────────────── */
  var fan = $('#fan'), stage = $('#fan-stage');
  if (fan && stage) {
    var banks = $$('.bank', fan);
    var open = function () {
      if (fan.classList.contains('is-open')) return;
      /* при первом раскрытии карты расходятся по очереди от центра */
      banks.forEach(function (b) { b.style.setProperty('--delay', Math.abs(+b.getAttribute('data-slot') - 2) * 70 + 'ms'); });
      fan.classList.add('is-open');
      setTimeout(function () { banks.forEach(function (b) { b.style.removeProperty('--delay'); }); }, 1100);
    };
    var drop = function () { banks.forEach(function (b) { b.classList.remove('is-picked'); }); };
    fan.addEventListener('click', function (e) {
      var b = e.target.closest('.bank');
      if (!b) return;
      if (!fan.classList.contains('is-open')) { open(); return; }
      var was = b.classList.contains('is-picked');
      drop(); if (!was) b.classList.add('is-picked');
    });
    document.addEventListener('click', function (e) { if (!fan.contains(e.target)) drop(); });
    fan.addEventListener('touchstart', function () {}, { passive: true }); /* iOS: без этого нет :active */

    /* прокрутка: вниз — веер складывается в одну карту, вверх — раскрывается */
    var lastP = -1;
    var fold = function () {
      var vh = window.innerHeight, r = fan.getBoundingClientRect();
      var center = r.top + r.height / 2, home = Math.min(center + window.scrollY, vh * .45);
      var p = reduceMq.matches ? 1 : Math.max(0, Math.min(1, 1 - (home - center) / Math.max(vh * .3, 180)));
      var q = Math.round(p * 1000) / 1000;
      if (q !== lastP) { lastP = q; fan.style.setProperty('--p', q); if (q < .6) drop(); }
    };
    window.addEventListener('scroll', fold, { passive: true });
    window.addEventListener('resize', fold);
    fold();

    if (reduceMq.matches) open();
    else {
      /* таймер, а не только IntersectionObserver: во вкладке на фоне он может
         не сработать, и веер так и остался бы стопкой */
      var fallback = setTimeout(open, 1600);
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) {
          if (en.some(function (x) { return x.isIntersecting; })) { io.disconnect(); clearTimeout(fallback); setTimeout(open, 380); }
        }, { threshold: .45 });
        io.observe(fan);
      }
      /* за курсором: камни расходятся по глубине (задние — меньше, передние —
         больше), над самим веером он ещё и чуть наклоняется. Только мышь. */
      var heroBox = $('#hero') || fan;
      if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
        var raf = 0, px = 0, py = 0;
        var tilt = function () {
          raf = 0;
          if (reduceMq.matches) return;
          var r = fan.getBoundingClientRect(), hr = heroBox.getBoundingClientRect();
          var mx = Math.max(-1, Math.min(1, (px - (r.left + r.width / 2)) / (hr.width / 2)));
          var my = Math.max(-1, Math.min(1, (py - (r.top + r.height / 2)) / (hr.height / 2)));
          fan.style.setProperty('--mx', mx.toFixed(3));
          fan.style.setProperty('--my', my.toFixed(3));
          var inside = px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
          if (inside) {
            var dx = Math.max(-1, Math.min(1, (px - (r.left + r.width / 2)) / (r.width / 2)));
            var dy = Math.max(-1, Math.min(1, (py - (r.top + r.height / 2)) / (r.height / 2)));
            stage.style.setProperty('--ry', (8 + dx * 7).toFixed(2) + 'deg');
            stage.style.setProperty('--rx', (12 - dy * 5).toFixed(2) + 'deg');
          } else { stage.style.removeProperty('--ry'); stage.style.removeProperty('--rx'); }
        };
        heroBox.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(tilt); });
        heroBox.addEventListener('pointerleave', function () {
          cancelAnimationFrame(raf); raf = 0;
          ['--mx', '--my'].forEach(function (k) { fan.style.removeProperty(k); });
          stage.style.removeProperty('--ry'); stage.style.removeProperty('--rx');
        });
      }
    }
  }

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* пришли по ссылке на раздел (#cat-mfo) — показываем его */
  var hm = /^#cat-(.+)$/.exec(location.hash);
  if (hm && byCat[hm[1]]) setTimeout(function () { goToCat(hm[1], false); }, 0);
})();

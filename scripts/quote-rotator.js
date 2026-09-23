/* ==========================================================================
   感触句栏：逐句「出现 → 停留（阅读时间）→ 消失 → 留白 → 下一句」
   - 阅读时间按字数计算，保证短句有下限、长句有上限
   - 悬停 / 键盘聚焦时暂停，移开后恢复
   - 上一条 / 下一条手动翻页（按钮由本脚本生成，没脚本时页面上没有它们）
   - prefers-reduced-motion: reduce 时不轮播，改为静态铺开全部句子
   ========================================================================== */
(function () {
  'use strict';

  var host = document.querySelector('[data-quote-rotator]');
  var config = window.SITE_DATA && window.SITE_DATA.quotes;
  if (!host || !config || !Array.isArray(config.items)) return;

  var quotes = config.items.filter(function (item) {
    return item && typeof item.text === 'string' && item.text.trim();
  });
  if (!quotes.length) return;

  /* 清空 HTML 里的「无脚本兜底句」：否则它带着 is-visible 永远可见，
     轮播句会叠在它上面，出现两句同时显示的重影。
     没有 JS 时这里不会执行，兜底句仍照常显示。 */
  host.textContent = '';

  var nodes = quotes.map(function (quote) {
    var block = document.createElement('blockquote');
    block.className = 'quote-rotator__item';

    var text = document.createElement('p');
    text.className = 'quote-rotator__text';
    text.textContent = quote.text;            /* textContent：杜绝 HTML 注入 */
    block.appendChild(text);

    if (quote.source) {
      var cite = document.createElement('cite');
      cite.className = 'quote-rotator__source';
      cite.textContent = quote.source;
      block.appendChild(cite);
    }

    host.appendChild(block);
    return block;
  });

  /* —— 上一条 / 下一条 ——
     按钮由脚本生成，而不是写在 HTML 里：没有 JS 时轮播本身就不存在，
     页面上留两个按不动的按钮只会让人白点。容器是 HTML 里的空
     [data-quote-nav]，脚本不跑它就是一块零高度的空气。 */
  var navHost = document.querySelector('[data-quote-nav]');
  var status = null;
  /* 只有一句时没有「下一条」可翻，按钮连同容器一起不出现 */
  var canStep = nodes.length > 1;

  if (navHost && canStep) {
    navHost.setAttribute('role', 'group');
    navHost.setAttribute('aria-label', '翻看其他句子');

    [['上一条', -1], ['下一条', 1]].forEach(function (spec) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'quote-nav__btn';
      button.textContent = spec[0];
      button.addEventListener('click', function () { step(spec[1]); });
      navHost.appendChild(button);
    });

    /* 手动翻到哪一句，只对读屏说一声。自动轮播不更新它 ——
       否则每一句都会打断一次你正在听的东西。 */
    status = document.createElement('p');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    navHost.appendChild(status);
  }

  function setNavHidden(hidden) {
    if (navHost) navHost.hidden = !!hidden || !canStep;
  }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function showAllStatic() {
    nodes.forEach(function (node) { node.classList.add('is-visible'); });
  }

  if (reduced.matches) {
    showAllStatic();
    /* 全部句子都摊在页面上，「上一条 / 下一条」就没有「下一条」可说了 */
    setNavHidden(true);
    return;
  }

  var reading = Object.assign({ perChar: 260, min: 4500, max: 14000 }, config.reading || {});
  var fade = Number(config.fade) || 700;
  var gap  = Number(config.gap)  || 600;

  var index = -1;         /* 当前这句：屏幕上那句，或正在淡出的那句 */
  var pending = null;     /* 自动轮播排着的下一步 */
  var stepping = null;    /* 手动翻页排着的淡出计时，跟自动流程各走各的 */
  var resume = null;      /* 暂停时记下「恢复后该做什么」 */
  var paused = false;

  function dwell(text) {
    var chars = Array.from(String(text)).length;
    return Math.min(reading.max, Math.max(reading.min, chars * reading.perChar));
  }

  /* 取模兜到 [0, 句数)：往回翻到头要能绕到最后一句 */
  function wrap(value) {
    return ((value % nodes.length) + nodes.length) % nodes.length;
  }

  /* 记录「下一步该做什么」，暂停时不真正计时，恢复后再续上 */
  function later(ms, fn) {
    resume = fn;
    clearTimeout(pending);
    if (paused) return;
    pending = setTimeout(fn, ms);
  }

  function reveal(value) {
    index = wrap(value);
    var node = nodes[index];
    node.classList.add('is-visible');
    later(dwell(node.textContent), conceal);
  }

  function conceal() {
    var from = index;
    nodes[from].classList.remove('is-visible');
    later(fade + gap, function () { reveal(from + 1); });
  }

  /* —— 手动翻页 ——
     两句叠在同一个格子里（grid-area: 1/1），直接对切会有半秒的重影，
     所以先把整栏收干净，退到看不见了再让目标句进场；上一次还没退完
     （中途又按了一下）就直接进，别让人按了没反应。

     这一跳不走 later()：鼠标正停在按钮上时整栏是暂停的，而暂停该拦的是
     自动轮播，不该拦用户自己按的键 —— 按了不动是最糟的反馈。
     翻完之后的停留时间照旧走 later()，所以移开鼠标照常往下轮。 */
  function step(delta) {
    clearTimeout(pending);
    clearTimeout(stepping);
    resume = null;

    var onScreen = index >= 0 && nodes[index].classList.contains('is-visible');
    nodes.forEach(function (node) { node.classList.remove('is-visible'); });

    index = wrap(index + delta);
    var target = index;

    if (status) status.textContent = '第 ' + (target + 1) + ' 句，共 ' + nodes.length + ' 句';

    if (!onScreen) { reveal(target); return; }

    stepping = setTimeout(function () {
      stepping = null;
      reveal(target);
    }, fade);
  }

  reveal(0);

  function setPaused(value) {
    if (value === paused) return;
    paused = value;
    if (paused) {
      clearTimeout(pending);
      pending = null;
    } else if (resume) {
      /* 恢复时把停下的那一步续上。resume 为空说明有一步正排在别处
         （比如手动翻页的淡出），那颗计时不该被这里清掉。 */
      clearTimeout(pending);
      pending = setTimeout(resume, 800);
    }
  }

  /* 暂停区取「句子 + 按钮」的共同父元素：绑在整栏上，鼠标在两者之间
     移动就不会来回触发暂停 / 恢复（各自绑的话，移出按钮先恢复、
     移入句子又暂停，中间会插进一个多余的计时）。找不到共同父元素就退回只绑句子。 */
  var pauseZone = (navHost && host.parentNode && navHost.parentNode === host.parentNode)
    ? host.parentNode
    : host;

  pauseZone.addEventListener('mouseenter', function () { setPaused(true); });
  pauseZone.addEventListener('mouseleave', function () { setPaused(false); });
  /* focusin / focusout 会冒泡，所以按 Tab 落到「下一条」上也照样暂停 */
  pauseZone.addEventListener('focusin',    function () { setPaused(true); });
  pauseZone.addEventListener('focusout',   function () { setPaused(false); });

  /* 用户中途切换「减少动态效果」时同步切换方案 */
  var onPreferenceChange = function (event) {
    if (event.matches) {
      clearTimeout(pending);
      clearTimeout(stepping);
      showAllStatic();
      setNavHidden(true);
    } else {
      nodes.forEach(function (node) { node.classList.remove('is-visible'); });
      setNavHidden(false);
      index = -1;
      paused = false;
      resume = null;
      reveal(0);
    }
  };
  if (reduced.addEventListener) reduced.addEventListener('change', onPreferenceChange);
  else if (reduced.addListener) reduced.addListener(onPreferenceChange);
}());

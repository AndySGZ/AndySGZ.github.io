/* ==========================================================================
   感触句栏：逐句「出现 → 停留（阅读时间）→ 消失 → 留白 → 下一句」
   - 阅读时间按字数计算，保证短句有下限、长句有上限
   - 悬停 / 键盘聚焦时暂停，移开后恢复
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

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function showAllStatic() {
    nodes.forEach(function (node) { node.classList.add('is-visible'); });
  }

  if (reduced.matches) { showAllStatic(); return; }

  var reading = Object.assign({ perChar: 260, min: 4500, max: 14000 }, config.reading || {});
  var fade = Number(config.fade) || 700;
  var gap  = Number(config.gap)  || 600;

  var index = -1;
  var pending = null;
  var resume = null;
  var paused = false;

  function dwell(text) {
    var chars = Array.from(String(text)).length;
    return Math.min(reading.max, Math.max(reading.min, chars * reading.perChar));
  }

  /* 记录「下一步该做什么」，暂停时不真正计时，恢复后再续上 */
  function later(ms, fn) {
    resume = fn;
    clearTimeout(pending);
    if (paused) return;
    pending = setTimeout(fn, ms);
  }

  function reveal() {
    index = (index + 1) % nodes.length;
    var node = nodes[index];
    node.classList.add('is-visible');
    later(dwell(node.textContent), conceal);
  }

  function conceal() {
    nodes[index].classList.remove('is-visible');
    later(fade + gap, reveal);
  }

  reveal();

  function setPaused(value) {
    if (value === paused) return;
    paused = value;
    clearTimeout(pending);
    if (!paused && resume) pending = setTimeout(resume, 800);
  }

  host.addEventListener('mouseenter', function () { setPaused(true); });
  host.addEventListener('mouseleave', function () { setPaused(false); });
  host.addEventListener('focusin',    function () { setPaused(true); });
  host.addEventListener('focusout',   function () { setPaused(false); });

  /* 用户中途切换「减少动态效果」时同步切换方案 */
  var onPreferenceChange = function (event) {
    if (event.matches) {
      clearTimeout(pending);
      showAllStatic();
    } else {
      nodes.forEach(function (node) { node.classList.remove('is-visible'); });
      index = -1;
      paused = false;
      reveal();
    }
  };
  if (reduced.addEventListener) reduced.addEventListener('change', onPreferenceChange);
  else if (reduced.addListener) reduced.addListener(onPreferenceChange);
}());

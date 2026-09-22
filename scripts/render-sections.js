/* ==========================================================================
   把 scripts/site-data.js 的内容渲染进各页面。
   - 容器上加 data-limit="3" 就只显示前 3 条（首页用），不加则显示全部（子页面用）。
   - 全部使用 textContent，任何数据都不会被当作 HTML 执行。
   ========================================================================== */
(function () {
  'use strict';

  var data = window.SITE_DATA || {};

  function el(tag, className, textContent) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (textContent !== undefined) node.textContent = textContent;
    return node;
  }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value || '');
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  }

  function take(host, list) {
    var limit = parseInt(host.getAttribute('data-limit'), 10);
    return isNaN(limit) ? list : list.slice(0, limit);
  }

  /* —— 杂谈条目 —— */
  function essayNode(entry) {
    var item = el('li', 'entry');
    var body;
    var href = (entry.url || '').trim();

    if (href) {
      body = el('a', 'entry__body');
      body.href = href;
    } else {
      /* 没有链接就渲染成普通块，避免给出一个点了没反应的死链接 */
      body = el('div', 'entry__body');
      item.className = 'entry entry--pending';
    }

    var meta = el('div', 'entry__meta');
    meta.appendChild(el('span', null, formatDate(entry.date)));
    if (entry.tag) meta.appendChild(el('span', null, entry.tag));
    if (!href) meta.appendChild(el('span', 'entry__pending', '尚未发布'));
    body.appendChild(meta);

    body.appendChild(el('h3', 'entry__title', entry.title || '未命名'));
    if (entry.excerpt) body.appendChild(el('p', 'entry__excerpt', entry.excerpt));

    item.appendChild(body);
    return item;
  }

  /* —— 作品卡片 —— */
  function workNode(entry) {
    var card;
    var href = (entry.url || '').trim();

    if (href) {
      card = el('a', 'card');
      card.href = href;
    } else {
      card = el('div', 'card card--pending');
    }

    card.appendChild(el('h3', 'card__title', entry.title || '未命名'));
    card.appendChild(el('p', 'card__text', entry.text || ''));
    if (entry.meta) card.appendChild(el('span', 'card__meta', entry.meta));

    return card;
  }

  /* —— 杂谈列表 —— */
  var essaysHost = document.querySelector('[data-essays-list]');
  var essayNodes = [];

  if (essaysHost && Array.isArray(data.essays)) {
    var essays = take(essaysHost, data.essays);
    if (!essays.length) {
      essaysHost.appendChild(el('li', 'entry__empty', '还没有内容。'));
    }
    essays.forEach(function (entry) {
      var node = essayNode(entry);
      /* 把分类挂到节点上，筛选时不必回头再查数据 */
      node.setAttribute('data-tag', String(entry.tag || '').trim());
      essayNodes.push(node);
      essaysHost.appendChild(node);
    });
  }

  /* —— 杂谈分类筛选 ——
     只在带 [data-essay-filter] 的页面生效（杂谈页），首页的预览列表不受影响。
     分类直接从条目的 tag 推导：site-data.js 里出现新 tag，按钮自动多一个，
     不维护任何写死的分类清单。 */
  (function () {
    var host = document.querySelector('[data-essay-filter]');
    if (!host || !essayNodes.length) return;

    /* 按数据里首次出现的顺序收集分类 */
    var tags = [];
    essayNodes.forEach(function (node) {
      var tag = node.getAttribute('data-tag');
      if (tag && tags.indexOf(tag) === -1) tags.push(tag);
    });
    if (tags.length < 2) return;   /* 只有一个分类时筛选没意义，不显示整条筛选栏 */

    var statusEl = document.querySelector('[data-essay-status]');
    var chips = [];

    function apply(value, syncUrl) {
      var shown = 0;

      essayNodes.forEach(function (node) {
        var visible = !value || node.getAttribute('data-tag') === value;
        node.hidden = !visible;
        if (visible) shown++;
      });

      chips.forEach(function (chip) {
        chip.node.setAttribute('aria-pressed', String(chip.value === value));
      });

      if (statusEl) {
        statusEl.textContent = value
          ? '「' + value + '」共 ' + shown + ' 篇'
          : '共 ' + shown + ' 篇';
      }

      /* 把分类写进地址栏：刷新、分享、前进后退都能停在同一个分类。
         file:// 下 replaceState 会抛 SecurityError，所以先判协议再兜异常。 */
      if (syncUrl && location.protocol.indexOf('http') === 0 &&
          window.history && window.history.replaceState) {
        try {
          window.history.replaceState(null, '',
            location.pathname + (value ? '?tag=' + encodeURIComponent(value) : ''));
        } catch (error) { /* 地址栏同步失败不影响筛选本身 */ }
      }
    }

    function makeChip(label, value) {
      var chip = el('button', 'filter-chip', label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', function () { apply(value, true); });
      host.appendChild(chip);
      chips.push({ node: chip, value: value });
    }

    makeChip('全部', '');
    tags.forEach(function (tag) { makeChip(tag, tag); });

    /* 首次进入读取 ?tag=，值不合法（或分类已被删掉）就落回「全部」 */
    var initial = '';
    try {
      initial = new URLSearchParams(location.search).get('tag') || '';
    } catch (error) { initial = ''; }
    if (tags.indexOf(initial) === -1) initial = '';

    apply(initial, false);
  }());

  /* —— 作品网格 —— */
  var worksHost = document.querySelector('[data-works-grid]');
  if (worksHost && Array.isArray(data.works)) {
    take(worksHost, data.works).forEach(function (entry) {
      worksHost.appendChild(workNode(entry));
    });
  }

  /* —— 联系方式 —— */
  var contactHost = document.querySelector('[data-contact-list]');
  if (contactHost && Array.isArray(data.contact)) {
    data.contact.forEach(function (entry) {
      var item = el('div', 'contact-item');
      item.appendChild(el('span', 'contact-item__label', entry.label || ''));

      var value = el('span', 'contact-item__value');
      if (entry.url && entry.value) {
        var link = el('a', null, entry.value);
        link.href = entry.url;
        link.rel = 'noopener noreferrer';
        if (/^https?:/i.test(entry.url)) link.target = '_blank';
        value.appendChild(link);
      } else {
        value.textContent = entry.value || '待填写';
      }

      item.appendChild(value);
      contactHost.appendChild(item);
    });
  }
}());

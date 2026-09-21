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
  if (essaysHost && Array.isArray(data.essays)) {
    var essays = take(essaysHost, data.essays);
    if (!essays.length) {
      essaysHost.appendChild(el('li', 'entry__empty', '还没有内容。'));
    }
    essays.forEach(function (entry) { essaysHost.appendChild(essayNode(entry)); });
  }

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

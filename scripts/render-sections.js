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

  /* —— 作品网格 —— */
  var worksHost = document.querySelector('[data-works-grid]');
  var workNodes = [];

  if (worksHost && Array.isArray(data.works)) {
    take(worksHost, data.works).forEach(function (entry) {
      var node = workNode(entry);
      /* 同样把分类挂到节点上，筛选时不必回头再查数据 */
      node.setAttribute('data-tag', String(entry.tag || '').trim());
      workNodes.push(node);
      worksHost.appendChild(node);
    });
  }

  /* —— 分类筛选：杂谈页与作品页共用同一套 ——
     分类清单由数据显式给出（essayTags / workTags），不再从条目的 tag 上推导：

       · 清单是空的 —— 整栏不渲染，页面看上去就跟没有分类一样。杂谈页现在
         就是这个状态；以后往清单里写进分类名，筛选栏会自己长出来。
       · 清单里先摆着还没有内容的分类也没关系，它会显示 0 篇 / 0 件，
         等文章或作品补上就自动对上号。

     条目靠节点上的 data-tag 归类；tag 不在清单里的条目只在「全部」下露面。
     切换分类顺手把分类写进地址栏（?tag=），刷新、分享、前进后退都停在同一个分类。 */
  function setupFilter(config) {
    var host = document.querySelector(config.hostSelector);
    var items = config.items || [];
    /* 去空白、去重，保持清单里的原始顺序 —— 按钮顺序就是清单顺序 */
    var tags = (Array.isArray(config.tags) ? config.tags : [])
      .map(function (tag) { return String(tag).trim(); })
      .filter(function (tag, index, all) { return tag && all.indexOf(tag) === index; });

    if (!host || !items.length || !tags.length) return;

    var statusEl = document.querySelector(config.statusSelector);
    var unit = config.unit || '条';
    /* 卡片阴影默认按 :nth-child 循环取色，筛过之后剩下的卡片还按原始位置
       取色就会撞成一排同色，所以给了 tones 的列表按「当前可见的第几张」重排。 */
    var tones = config.tones;
    var chips = [];

    function apply(value, syncUrl) {
      var shown = 0;

      items.forEach(function (item) {
        var visible = !value || item.getAttribute('data-tag') === value;
        item.hidden = !visible;
        if (!visible) return;
        if (tones) item.style.setProperty('--card-shadow', tones[shown % tones.length]);
        shown++;
      });

      chips.forEach(function (chip) {
        chip.node.setAttribute('aria-pressed', String(chip.value === value));
      });

      if (statusEl) {
        statusEl.textContent = value
          ? '「' + value + '」共 ' + shown + ' ' + unit
          : '共 ' + shown + ' ' + unit;
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

    /* 首次进入读取 ?tag=，值不合法（或分类已被改掉）就落回「全部」 */
    var initial = '';
    try {
      initial = new URLSearchParams(location.search).get('tag') || '';
    } catch (error) { initial = ''; }
    if (tags.indexOf(initial) === -1) initial = '';

    apply(initial, false);
  }

  /* 杂谈：清单在 site-data.js 里是空的，所以这条现在什么都不画 */
  setupFilter({
    hostSelector: '[data-essay-filter]',
    statusSelector: '[data-essay-status]',
    items: essayNodes,
    tags: data.essayTags,
    unit: '篇'
  });

  /* 作品：声音 / 图像 / 学习 / 科研 / 其他，顺序与颜色都跟着清单走 */
  setupFilter({
    hostSelector: '[data-works-filter]',
    statusSelector: '[data-works-status]',
    items: workNodes,
    tags: data.workTags,
    unit: '件',
    tones: ['var(--red)', 'var(--pine)', 'var(--clay)']
  });

  /* —— 练琴：可切换的标签页 ——
     栏目顺序与标题都来自数据，加一项就多一个标签，页面不用改。
     用标准 tablist / tab / tabpanel 语义：左右方向键切换、Home / End 跳首尾，
     漫游 tabindex 让 Tab 键只落在当前标签上，不必逐个跳过。 */
  var practice = data.practice;
  var practiceHost = document.querySelector('[data-practice-board]');

  if (practiceHost && practice && Array.isArray(practice.stages)) {
    var tabList = el('div', 'practice-tabs');
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', '练琴分类');

    var panels = el('div', 'practice-panels');
    var tabs = [];

    function select(index, moveFocus) {
      tabs.forEach(function (tab, i) {
        var active = i === index;
        tab.button.setAttribute('aria-selected', String(active));
        tab.button.tabIndex = active ? 0 : -1;
        tab.panel.hidden = !active;
      });
      if (moveFocus) tabs[index].button.focus();
    }

    practice.stages.forEach(function (column, index) {
      var items = Array.isArray(column.items) ? column.items : [];
      var panelId = 'practice-panel-' + index;

      var button = el('button', 'practice-tab', column.stage || '未命名');
      button.type = 'button';
      button.id = 'practice-tab-' + index;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panelId);
      button.addEventListener('click', function () { select(index, false); });
      button.addEventListener('keydown', function (event) {
        var step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (step) {
          event.preventDefault();
          select((index + step + tabs.length) % tabs.length, true);
        } else if (event.key === 'Home') {
          event.preventDefault();
          select(0, true);
        } else if (event.key === 'End') {
          event.preventDefault();
          select(tabs.length - 1, true);
        }
      });

      var panel = el('div', 'practice-panel');
      panel.id = panelId;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      panel.tabIndex = 0;   /* 面板内没有可聚焦元素，自身可聚焦才便于键盘滚动阅读 */

      if (!items.length) {
        panel.appendChild(el('p', 'practice-empty', '还没有记录。'));
      } else {
        var list = el('ul', 'practice-list');
        items.forEach(function (piece) {
          var li = el('li', 'piece');

          var text = el('div', 'piece__text');
          text.appendChild(el('p', 'piece__title', piece.title || '未命名'));
          if (piece.composer) text.appendChild(el('p', 'piece__meta', piece.composer));
          if (piece.note) text.appendChild(el('p', 'piece__note', piece.note));

          /* 最近在听：一串外链。没写 url 的项退成纯文字，不留死链接。 */
          var tracks = Array.isArray(piece.listening) ? piece.listening : [];
          if (tracks.length) {
            var listening = el('p', 'piece__listening');
            listening.appendChild(el('span', 'piece__listening-label', '最近在听：'));
            tracks.forEach(function (track, i) {
              var href = String(track.url || '').trim();
              if (i) listening.appendChild(document.createTextNode('、'));
              if (!href) {
                listening.appendChild(document.createTextNode(track.label || ''));
                return;
              }
              var link = el('a', null, track.label || href);
              link.href = href;
              link.rel = 'noopener noreferrer';
              if (/^https?:/i.test(href)) link.target = '_blank';
              if (track.title) link.title = track.title;
              listening.appendChild(link);
            });
            text.appendChild(listening);
          }

          li.appendChild(text);

          /* 横向图位：没给 image 就留一个空框，先让人看清版式 */
          var figure = el('div', 'piece__figure');
          if (piece.image) {
            var img = el('img');
            img.src = piece.image;
            img.alt = piece.alt || piece.title || '';
            img.loading = 'lazy';
            /* 图还没放或路径写错时退回空占位框，不在页面上留裂图图标；
               同时在控制台报一句，方便定位是哪个路径不对。 */
            img.addEventListener('error', function () {
              if (img.parentNode) img.parentNode.removeChild(img);
              console.warn('[practice] 图片加载失败：' + piece.image);
            });
            figure.appendChild(img);
          }
          li.appendChild(figure);

          list.appendChild(li);
        });
        panel.appendChild(list);
      }

      tabList.appendChild(button);
      panels.appendChild(panel);
      tabs.push({ button: button, panel: panel });
    });

    practiceHost.appendChild(tabList);
    practiceHost.appendChild(panels);
    select(0, false);
  }

  /* —— 练琴页头右侧的方形配图 —— 没填 image 时保留空框，位置不塌 */
  var introHost = document.querySelector('[data-practice-intro]');
  if (introHost && practice && practice.intro && practice.intro.image) {
    var introImg = el('img');
    introImg.src = practice.intro.image;
    introImg.alt = practice.intro.alt || '';
    introImg.addEventListener('error', function () {
      if (introImg.parentNode) introImg.parentNode.removeChild(introImg);
      console.warn('[practice] 页头配图加载失败：' + practice.intro.image);
    });
    introHost.appendChild(introImg);
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

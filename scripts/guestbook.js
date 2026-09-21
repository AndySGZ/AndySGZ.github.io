/* ==========================================================================
   留言墙 —— 前端界面 + 可插拔后端
   后端在 index.html 顶部的 window.GUESTBOOK_CONFIG 里配置：
     provider: 'supabase'  → 走 Supabase REST，访客无需登录，你在后台审核
     provider: 'local'     → 未接入后端时的本地演示（数据只存在本机浏览器）
   安全：所有留言一律用 textContent 渲染，杜绝 XSS。
   ========================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('[data-guestbook-form]');
  var list = document.querySelector('[data-guestbook-list]');
  if (!form || !list) return;

  var status = form.querySelector('[data-guestbook-status]');
  var notice = document.querySelector('[data-guestbook-notice]');
  var counter = form.querySelector('[data-guestbook-counter]');
  var bodyField = form.elements.body;
  var nameField = form.elements.name;
  var honeypot = form.elements.website;
  var submitBtn = form.querySelector('button[type="submit"]');

  var config = Object.assign(
    { provider: 'local', supabaseUrl: '', supabaseAnonKey: '', table: 'messages', limit: 50 },
    window.GUESTBOOK_CONFIG || {}
  );
  var live = config.provider === 'supabase' && config.supabaseUrl && config.supabaseAnonKey;
  var LOCAL_KEY = 'guestbook.messages.v1';
  var COOLDOWN_KEY = 'guestbook.lastPostAt';
  var MAX_NAME = 20;
  var MAX_BODY = 200;
  var COOLDOWN_MS = 30000;

  function say(message, tone) {
    if (!status) return;
    status.textContent = message;
    if (tone) status.setAttribute('data-tone', tone);
    else status.removeAttribute('data-tone');
  }

  function headers(extra) {
    return Object.assign({
      apikey: config.supabaseAnonKey,
      Authorization: 'Bearer ' + config.supabaseAnonKey,
      'Content-Type': 'application/json'
    }, extra || {});
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
    catch (error) { return []; }
  }

  function writeLocal(rows) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows)); } catch (error) { /* 隐私模式 */ }
  }

  /* —— 读取已通过审核的留言 —— */
  function load() {
    if (!live) return Promise.resolve(readLocal());
    var query = '?select=name,body,created_at&approved=eq.true&order=created_at.desc&limit=' + config.limit;
    return fetch(config.supabaseUrl + '/rest/v1/' + config.table + query, { headers: headers() })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      });
  }

  /* —— 提交新留言（进入待审核状态） —— */
  function send(entry) {
    if (!live) {
      var rows = readLocal();
      rows.unshift(Object.assign({ created_at: new Date().toISOString(), approved: true }, entry));
      writeLocal(rows.slice(0, config.limit));
      return Promise.resolve();
    }
    return fetch(config.supabaseUrl + '/rest/v1/' + config.table, {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ name: entry.name, body: entry.body })
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
    });
  }

  function stamp(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(date);
  }

  function render(rows) {
    list.textContent = '';
    if (!rows || !rows.length) {
      var empty = document.createElement('li');
      empty.className = 'wall__empty';
      empty.textContent = '还没有留言，来做第一个吧。';
      list.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      var item = document.createElement('li');
      item.className = 'wall__item';

      var head = document.createElement('div');
      head.className = 'wall__head';

      var name = document.createElement('span');
      name.className = 'wall__name';
      name.textContent = row.name || '匿名';        /* textContent：防注入 */

      var time = document.createElement('span');
      time.className = 'wall__time';
      time.textContent = stamp(row.created_at);

      var text = document.createElement('p');
      text.className = 'wall__text';
      text.textContent = row.body || '';

      head.appendChild(name);
      head.appendChild(time);
      item.appendChild(head);
      item.appendChild(text);
      list.appendChild(item);
    });
  }

  function refresh() {
    load().then(render).catch(function () {
      list.textContent = '';
      var failed = document.createElement('li');
      failed.className = 'wall__empty';
      failed.textContent = '留言暂时读不出来，请稍后再试。';
      list.appendChild(failed);
    });
  }

  if (counter && bodyField) {
    var updateCounter = function () {
      counter.textContent = bodyField.value.length + ' / ' + MAX_BODY;
    };
    bodyField.addEventListener('input', updateCounter);
    updateCounter();
  }

  if (!live && notice) notice.hidden = false;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submitBtn && submitBtn.disabled) return;

    var name = (nameField && nameField.value || '').trim();
    var body = (bodyField && bodyField.value || '').trim();

    if (honeypot && honeypot.value) return;                       /* 机器人陷阱 */
    if (name.length < 1 || name.length > MAX_NAME) { say('昵称请控制在 1–' + MAX_NAME + ' 个字之间。', 'warn'); return; }
    if (body.length < 1 || body.length > MAX_BODY) { say('留言请控制在 1–' + MAX_BODY + ' 个字之间。', 'warn'); return; }

    var last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) {
      say('刚刚已经留过言了，稍等一会儿再发吧。', 'warn');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    say('正在提交…');

    send({ name: name, body: body }).then(function () {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      form.reset();
      if (counter) counter.textContent = '0 / ' + MAX_BODY;
      say(live ? '已提交，等我审核通过后就会出现在墙上。' : '已保存到本机（当前为未接入后端的演示模式）。', 'ok');
      refresh();
    }).catch(function () {
      say('提交失败，请检查网络后重试。', 'warn');
    }).then(function () {
      if (submitBtn) submitBtn.disabled = false;
    });
  });

  refresh();
}());

/* ==========================================================================
   明暗主题：盯住「首屏不闪」和「按钮说的是下一步」这两件事。
   --------------------------------------------------------------------------
   脚本本身放进 vm 里、配一个最小的假 DOM 真跑一遍 —— 主题有没有落到
   <html> 上、点一下翻不翻面、手动选过的选择会不会被系统偏好盖掉，
   这些都是行为，光在源码里找字符串证明不了。
   ========================================================================== */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

const PAGES = ['index.html', 'about.html', 'essays.html', 'works.html', 'practice.html'];
const STORAGE_KEY = 'andy-theme';

/* ---------- 够用的假 DOM：只实现 theme.js 真正碰过的那几样 ---------- */

function fakeDom(options = {}) {
  const store = new Map();
  if (options.stored) store.set(STORAGE_KEY, options.stored);

  const html = {
    attributes: {},
    getAttribute(name) { return this.attributes[name] ?? null; },
    setAttribute(name, value) { this.attributes[name] = value; },
  };

  const meta = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };

  const labels = { zh: { textContent: '' }, en: { textContent: '' } };
  const button = {
    attributes: {},
    listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    querySelectorAll(selector) {
      const language = selector.match(/data-theme-label-(\w+)/);
      return language && labels[language[1]] ? [labels[language[1]]] : [];
    },
  };

  const media = {
    matches: options.system === 'dark',
    listeners: [],
    addEventListener(type, handler) { this.listeners.push(handler); },
  };

  const documentRef = {
    documentElement: html,
    listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; },
    querySelector: (selector) => (selector.indexOf('theme-color') > 0 ? meta : null),
    querySelectorAll: (selector) => (selector.indexOf('data-theme-toggle') >= 0 ? [button] : []),
  };

  const windowRef = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
    },
    matchMedia: () => media,
  };

  return { html, meta, button, labels, media, documentRef, windowRef, store };
}

async function loadTheme(dom) {
  const source = await read('scripts/theme.js');
  vm.runInContext(source, vm.createContext({ window: dom.windowRef, document: dom.documentRef }));
  return dom;
}

/* ---------- 行为 ---------- */

test('the theme is written onto <html> the moment the script runs', async () => {
  const dark = await loadTheme(fakeDom({ system: 'dark' }));
  assert.equal(dark.html.attributes['data-theme'], 'dark', '系统是夜间模式就该直接落暗色');

  const light = await loadTheme(fakeDom({ system: 'light' }));
  assert.equal(light.html.attributes['data-theme'], 'light');

  /* 地址栏颜色跟着主题走，否则手机上会留一条对不上的色带 */
  assert.equal(dark.meta.attributes.content, '#191817');
  assert.equal(light.meta.attributes.content, '#f5f0eb');
});

test('a hand-picked theme outranks the system preference', async () => {
  const saved = await loadTheme(fakeDom({ system: 'dark', stored: 'light' }));
  assert.equal(saved.html.attributes['data-theme'], 'light');

  const other = await loadTheme(fakeDom({ system: 'light', stored: 'dark' }));
  assert.equal(other.html.attributes['data-theme'], 'dark');
});

test('the toggle flips the theme, remembers it, and relabels itself', async () => {
  const dom = await loadTheme(fakeDom({ system: 'light' }));
  dom.documentRef.listeners.DOMContentLoaded();

  /* 按钮写的是「按下去会变成什么」，所以浅色下写着暗色 */
  assert.equal(dom.labels.zh.textContent, '暗色');
  assert.equal(dom.labels.en.textContent, 'Dark');
  assert.equal(dom.button.attributes['aria-pressed'], 'false');
  assert.match(dom.button.attributes['aria-label'], /暗色/);

  dom.button.listeners.click();

  assert.equal(dom.html.attributes['data-theme'], 'dark');
  assert.equal(dom.store.get(STORAGE_KEY), 'dark', '选过的主题要记下来');
  assert.equal(dom.labels.zh.textContent, '亮色');
  assert.equal(dom.labels.en.textContent, 'Light');
  assert.equal(dom.button.attributes['aria-pressed'], 'true');
  assert.match(dom.button.attributes['aria-label'], /亮色/);

  dom.button.listeners.click();

  assert.equal(dom.html.attributes['data-theme'], 'light');
  assert.equal(dom.store.get(STORAGE_KEY), 'light');
  assert.equal(dom.labels.zh.textContent, '暗色');
});

test('the system preference only wins while nothing was picked by hand', async () => {
  const fresh = await loadTheme(fakeDom({ system: 'light' }));
  fresh.media.matches = true;                       /* 系统入夜 */
  fresh.media.listeners.forEach((handler) => handler());
  assert.equal(fresh.html.attributes['data-theme'], 'dark', '没手动选过就该跟着系统走');

  const picked = await loadTheme(fakeDom({ system: 'light' }));
  picked.documentRef.listeners.DOMContentLoaded();
  picked.button.listeners.click();                  /* 手动切成暗色 */
  picked.media.matches = false;                     /* 系统回到白天 */
  picked.media.listeners.forEach((handler) => handler());
  assert.equal(picked.html.attributes['data-theme'], 'dark', '手动选过之后系统不该再插手');
});

/* ---------- 页面接线 ---------- */

test('every page loads the theme script synchronously, high in <head>', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    const tag = html.match(/<script[^>]*src="scripts\/theme\.js"[^>]*>/);

    assert.ok(tag, `${page} 没有加载 scripts/theme.js`);
    assert.doesNotMatch(tag[0], /defer|async|type="module"/,
      `${page} 的明暗脚本必须同步跑，否则首屏会先闪一下浅色`);

    const head = html.slice(0, html.indexOf('</head>'));
    const at = head.indexOf(tag[0]);
    assert.ok(at > 0, `${page} 的明暗脚本应放在 <head> 里`);

    const meta = head.indexOf('name="theme-color"');
    assert.ok(meta > 0 && meta < at, `${page} 的 theme-color 要排在脚本前面，脚本才读得到`);
  }
});

test('the toggle is a real button carrying both languages', async () => {
  for (const page of PAGES) {
    const html = await read(page);

    assert.match(html, /<button[^>]*type="button"[^>]*data-theme-toggle[^>]*>/,
      `${page} 的明暗开关必须是 button，不能是链接或提交按钮`);
    assert.match(html, /data-theme-label-zh>/, `${page} 的明暗开关缺中文`);
    assert.match(html, /data-theme-label-en>/, `${page} 的明暗开关缺英文`);
    assert.match(html, /class="nav-zh" data-theme-label-zh/,
      `${page} 的明暗开关要沿用导航的中英排版`);

    /* 开关属于站名那一组，不混进导航链接，免得被当成第七个导航项 */
    const nav = html.match(/<nav class="site-nav__links"[\s\S]*?<\/nav>/);
    assert.ok(nav, `${page} 找不到主导航`);
    assert.doesNotMatch(nav[0], /data-theme-toggle/);
  }
});

test('the label written into the HTML agrees with what the script would write', async () => {
  /* 没脚本的人看到写死的那份，有脚本的人看到脚本算的那份。
     两边必须一致，否则按钮文案会在首屏跳一下。 */
  const dom = await loadTheme(fakeDom({ system: 'light' }));

  for (const [language, expected] of [['zh', '暗色'], ['en', 'Dark']]) {
    assert.equal(dom.labels[language].textContent, expected,
      `${language} 文案与浅色默认对不上，多半是取错了主题`);

    for (const page of PAGES) {
      const html = await read(page);
      assert.match(html, new RegExp(`data-theme-label-${language}>${expected}<`),
        `${page} 里写死的 ${language} 文案和脚本算出来的不一致`);
    }
  }
});

/* ---------- 样式表 ---------- */

/* 不靠正则配对花括号：从头部往后数嵌套深度，媒体查询套着规则也取得准 */
function block(css, header) {
  const start = css.indexOf(header);
  if (start < 0) return null;

  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return { at: start, body: css.slice(open + 1, index) };
    }
  }
  return null;
}

function tokens(body) {
  const map = new Map();
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1], match[2].trim());
  }
  return map;
}

function required(css, header) {
  const found = block(css, header);
  assert.ok(found, `样式表里找不到 ${header}`);
  return found;
}

function channels(color) {
  const value = color.trim();
  if (value[0] === '#') {
    const hex = value.slice(1);
    return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  }
  return value.match(/[\d.]+/g).map(Number);      /* rgb() / rgba() */
}

/* 半透明色得先压到底色上，才是眼睛真正看到的那一层 */
function over(color, base) {
  const [red, green, blue, alpha = 1] = channels(color);
  if (alpha >= 1) return [red, green, blue];
  return [red, green, blue].map((channel, index) => (
    Math.round(channel * alpha + base[index] * (1 - alpha))
  ));
}

function luminance(rgb) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/* 底色可能自己就是半透明的，所以还要知道它叠在什么上面（一般是 --bg） */
function contrast(foreground, background, page) {
  const canvas = page ? over(page, [255, 255, 255]) : [255, 255, 255];
  const back = over(background, canvas);
  const front = over(foreground, back);
  const values = [luminance(front), luminance(back)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('dark mode is spelled out twice: the manual switch and the system fallback', async () => {
  const css = await read('assets/style.css');
  const light = tokens(required(css, ':root {').body);

  const manual = tokens(required(css, 'html[data-theme="dark"]').body);
  const media = required(css, '@media (prefers-color-scheme: dark)');
  const fallback = tokens(required(media.body, 'html:not([data-theme])').body);

  assert.deepEqual([...fallback.keys()].sort(), [...manual.keys()].sort(),
    '手动切换和跟随系统必须定义同一组 token，否则关掉 JS 就换了副面孔');

  for (const [name, value] of manual) {
    assert.equal(fallback.get(name), value, `${name} 在两处取值不一致`);
  }

  /* 该翻的要翻：底色和正文色必须真的换掉，只调个边框不算暗色 */
  assert.notEqual(manual.get('--bg'), light.get('--bg'));
  assert.notEqual(manual.get('--charcoal'), light.get('--charcoal'));
});

test('body text keeps WCAG AA contrast in both themes', async () => {
  const css = await read('assets/style.css');
  const themes = {
    light: tokens(required(css, ':root {').body),
    dark: tokens(required(css, 'html[data-theme="dark"]').body),
  };

  /* 正文对底色、辅色对底色、选中标签自己那一对，都得读得清 */
  const pairs = [
    ['--charcoal', '--bg'],
    ['--wood-text', '--bg'],
    ['--selected-fg', '--selected-bg'],
  ];

  for (const [theme, set] of Object.entries(themes)) {
    for (const [foreground, background] of pairs) {
      const ratio = contrast(set.get(foreground), set.get(background), set.get('--bg'));
      assert.ok(ratio >= 4.5,
        `${theme} 下 ${foreground} 对 ${background} 只有 ${ratio.toFixed(2)}:1，够不上 WCAG AA`);
    }
  }
});

test('every component color has a token, so dark mode cannot miss one', async () => {
  const css = await read('assets/style.css');

  /* 这几处原先直接写在组件里，暗色会漏掉；现在只许作为 token 定义出现一次 */
  for (const literal of [
    '#4a4a4a', 'rgba(255, 255, 255, 0.85)', '#8a6d3b',
    'rgba(90, 122, 107, 0.4)', 'rgba(90, 122, 107, 0.3)',
  ]) {
    const count = css.split(literal).length - 1;
    assert.equal(count, 1, `${literal} 出现了 ${count} 次，应只作为 token 定义存在`);
  }

  /* 用字符串比对而不是拼正则：模板串里的 \s 会被吃成字母 s，正则就悄悄变了意思 */
  for (const name of [
    '--surface-hover', '--btn-hover', '--warn', '--focus-ring', '--focus-ring-soft',
    '--selected-bg', '--selected-fg',
  ]) {
    assert.ok(css.includes(`${name}:`), `缺少 ${name}`);
  }
});

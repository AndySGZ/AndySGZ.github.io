import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const escape = (token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('homepage exposes the Scandinavian shell and main navigation', async () => {
  const html = await read('index.html');

  assert.match(html, /<html[^>]+lang="zh-CN"/);
  assert.match(html, /<link rel="stylesheet" href="assets\/style\.css">/);
  assert.match(html, /class="site-nav"/);
  assert.match(html, /aria-label="主导航"/);
  assert.match(html, /class="skip-link"/);
});

test('homepage carries every requested content section', async () => {
  const html = await read('index.html');

  for (const token of [
    'class="hero"',        // 首屏：左侧竖向图 + 右侧较宽的语句区
    'hero__figure',        // 竖向图
    'data-quote-rotator',  // 感触句轮播
    'id="who"',            // 我是谁
    'id="essays"',         // 最近发布（杂谈预览）
    'id="works"',          // 精选作品
    'id="guestbook"',      // 留言墙
    'id="contact"',        // 联系方式
  ]) {
    assert.match(html, new RegExp(escape(token)));
  }

  assert.match(html, /href="about\.html"/);
});

test('hero lays out a portrait image beside the quotes, not a full-width banner', async () => {
  const [html, css] = await Promise.all([read('index.html'), read('assets/style.css')]);

  assert.match(css, /\.hero__figure\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/s);
  assert.match(css, /\.hero__figure\s*\{[^}]*max-width:\s*16rem/s);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*2fr\)/);
  assert.match(css, /object-fit:\s*cover/);
  assert.match(html, /width="900" height="1200"/);
});

test('the JBR journal entry point is preserved', async () => {
  const html = await read('index.html');

  /* 站内一律用相对链接（本地 file:// 直接打开也能跳），所以两种写法都算数 */
  assert.match(html, /href="(?:\.\/|\/)?Jary\/index\.html"/, '主页应当保留通往《Jary行为研究》的入口');
});

test('quote rotator has a reading pause and a reduced-motion fallback', async () => {
  const [html, script] = await Promise.all([read('index.html'), read('scripts/quote-rotator.js')]);

  assert.match(html, /data-quote-rotator/);
  assert.match(script, /perChar/);
  assert.match(script, /prefers-reduced-motion:\s*reduce/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML/);
});

test('rotator clears the no-JS fallback so quotes never stack on each other', async () => {
  const [html, script] = await Promise.all([read('index.html'), read('scripts/quote-rotator.js')]);

  // 兜底句必须存在（无脚本时可见）……
  assert.match(html, /quote-rotator__item is-visible/);
  // ……但脚本启动时必须先清空容器，否则它会永远可见并被轮播句叠住
  assert.match(script, /host\.textContent\s*=\s*['"]['"]/);
});

test('guestbook form is labelled, moderated and injection-safe', async () => {
  const [html, script] = await Promise.all([read('index.html'), read('scripts/guestbook.js')]);

  assert.match(html, /data-guestbook-form/);
  assert.match(html, /for="gb-name"/);
  assert.match(html, /for="gb-body"/);
  assert.match(html, /role="status"/);
  assert.match(html, /window\.GUESTBOOK_CONFIG/);

  assert.match(script, /approved=eq\.true/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML/);
});

test('stylesheet stays inside the Scandinavian token set', async () => {
  const css = await read('assets/style.css');

  assert.match(css, /#f5f0eb/);   // 桦木白背景
  assert.match(css, /#3d3d3d/);   // 炭灰正文
  assert.match(css, /#a89279/);   // 木质色
  assert.match(css, /#d4cdc5/);   // 羊毛灰
  assert.match(css, /font-weight:\s*300/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);

  // 全站字号总开关：改 --text-scale 一处即可整体缩放
  assert.match(css, /--text-scale:\s*[\d.]+%/);
  assert.match(css, /html\s*\{[^}]*font-size:\s*var\(--text-scale\)/s);

  for (const forbidden of [
    'bg-black', 'bg-gray-900', 'bg-slate-900',
    'font-black', 'font-extrabold', 'font-bold',
    'border-4', 'border-[3px]', 'rounded-full', 'rounded-3xl',
  ]) {
    assert.doesNotMatch(css, new RegExp(escape(forbidden)));
  }
});

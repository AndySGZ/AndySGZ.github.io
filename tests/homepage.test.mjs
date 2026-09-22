import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const escape = (token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('homepage exposes the brutalist shell and main navigation', async () => {
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

test('reduced motion lays the quotes out flat instead of stacking them', async () => {
  const [css, script] = await Promise.all([read('assets/style.css'), read('scripts/quote-rotator.js')]);

  /* 脚本在不轮播时会给每一句都加 is-visible（"静态铺开全部句子"）。
     但默认布局把这些句子叠在同一格做交叉淡入，全亮就成了糊字。
     样式表必须在这个分支里把叠放拆掉——两者缺一，读屏用户看到的就是一坨。 */
  assert.match(script, /showAllStatic/);

  /* 把这条媒体查询到文件末尾整段切出来查。
     [^}] 跨不过右花括号，所以每条断言只可能命中某个规则自己的规则体，
     不会一路匹配到别的规则上去。 */
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

  assert.match(block, /\.quote-rotator\s*\{[^}]*display:\s*block[^}]*min-height:\s*0/s,
    '不轮播时句子应当依次往下排，而不是继续叠在同一格里');
  assert.match(block, /\.quote-rotator__item\s*\{[^}]*grid-area:\s*auto/s,
    '不轮播时要把 grid-area: 1/1 拆掉，否则几句会压在一起');
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

test('stylesheet stays inside the Neo-Brutalist Playful token set', async () => {
  const css = await read('assets/style.css');
  /* 注释里会大方地提到被禁的东西（「无圆角」之类），所以先剥掉注释再查，
     否则规矩一写进注释就自己把自己判违规了。 */
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // 五种强调色，一个都不能少
  for (const accent of ['#ff6b6b', '#4ecdc4', '#ffe66d', '#f38181', '#95e1d3']) {
    assert.ok(css.includes(accent), `缺少强调色 ${accent}`);
  }
  assert.match(code, /font-weight:\s*900/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);

  // 全站字号总开关：改 --text-scale 一处即可整体缩放
  assert.match(css, /--text-scale:\s*[\d.]+%/);
  assert.match(css, /html\s*\{[^}]*font-size:\s*var\(--text-scale\)/s);

  // 绝对禁止：圆角、模糊、渐变、柔和的灰
  for (const forbidden of [
    'border-radius', 'linear-gradient', 'radial-gradient',
    'filter: blur', 'backdrop-filter',
    'font-weight: 300', 'font-weight: 400', 'text-gray-300', 'text-gray-400', 'text-gray-500',
  ]) {
    assert.doesNotMatch(code, new RegExp(escape(forbidden)), `风格禁止出现 ${forbidden}`);
  }

  // 倾斜必须收在 3 度以内，否则整页会散架
  for (const tilt of code.matchAll(/rotate:\s*(-?[\d.]+)deg/g)) {
    assert.ok(Math.abs(Number(tilt[1])) <= 3, `倾斜 ${tilt[1]}deg 超过了 3 度`);
  }

  // 硬边阴影：偏移之后必须是 0 模糊半径，出现模糊半径就不是野兽派了
  for (const shadow of code.matchAll(/box-shadow:\s*([^;}]+)/g)) {
    for (const layer of shadow[1].split(/,(?![^(]*\))/)) {
      const parts = layer.trim().split(/\s+/);
      if (parts.length < 4 || parts[0].startsWith('inset')) continue;
      assert.ok(parts[2] === '0' || parts[2] === '0px',
        `阴影 ${layer.trim()} 的模糊半径不是 0，硬边阴影不许发虚`);
    }
  }
});

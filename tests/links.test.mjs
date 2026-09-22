import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const PAGES = ['index.html', 'about.html', 'essays.html', 'works.html', 'practice.html'];

/* 期刊子页同样纳入检查：导航里的「游戏」与游戏页里的锚点都指向真实文件 */
const JARY_PAGES = ['Jary/index.html', 'Jary/games.html', 'Jary/escape-nailong.html'];

const isExternal = (href) => /^(https?:|mailto:|tel:|data:|\/\/)/i.test(href);

/* 去掉 #fragment 与 ?query，只留文件部分 */
const filePart = (href) => href.split('#')[0].split('?')[0];

async function assertResolves(page, href) {
  await assert.doesNotReject(
    access(new URL(href, new URL(page, root))),
    `${page} 里的链接指向不存在的文件：${href}`
  );
}

test('every internal link on every page resolves to a real file', async () => {
  for (const page of [...PAGES, ...JARY_PAGES]) {
    const html = await readFile(new URL(page, root), 'utf8');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    for (const href of hrefs) {
      if (isExternal(href)) continue;
      const file = filePart(href);
      if (!file) continue;                       // 纯 #anchor
      await assertResolves(page, file);
    }
  }
});

test('every internal url in site-data.js resolves to a real file', async () => {
  const source = await readFile(new URL('scripts/site-data.js', root), 'utf8');
  const urls = [...source.matchAll(/url:\s*'([^']*)'/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);

  assert.ok(urls.length > 0, 'site-data.js 里应该有链接');

  const internal = urls.filter((href) => !isExternal(href));
  assert.ok(internal.length > 0, '应该至少有一个站内链接');

  for (const href of internal) {
    await assertResolves('index.html', filePart(href));
  }
});

test('cross-page anchors point at ids that actually exist', async () => {
  for (const page of [...PAGES, ...JARY_PAGES]) {
    const html = await readFile(new URL(page, root), 'utf8');

    for (const match of html.matchAll(/href="([^"]*#[^"]+)"/g)) {
      const [file, fragment] = match[1].split('#');
      if (!file || !fragment) continue;          // 页内锚点不跨文件
      const target = await readFile(new URL(file, new URL(page, root)), 'utf8');
      assert.match(
        target,
        new RegExp(`id="${fragment}"`),
        `${page} 的 ${match[1]} 指向 ${file} 中不存在的锚点`
      );
    }
  }
});

test('the Jary journal links back to the main site', async () => {
  const html = await readFile(new URL('Jary/index.html', root), 'utf8');

  const match = html.match(/<a class="back-home" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(match, 'Jary/index.html 里应该有返回主页的按钮');

  const [, href, inner] = match;
  assert.equal(href, '../index.html', '返回按钮应指向 ../index.html');
  assert.ok(!href.startsWith('/'), '不能用 / 开头的绝对路径，否则本地直接打开会失效');
  await assertResolves('Jary/index.html', href);

  /* 按钮跟着期刊的双语机制走，切换语言时文案要一起变 */
  assert.match(inner, /data-lang="zh"/, '返回按钮应有中文文案');
  assert.match(inner, /data-lang="en"/, '返回按钮应有英文文案');

  /* 排在站内导航最前，和 #top / #current 这类页内锚点区分开 */
  const navStart = html.indexOf('<nav class="primary-nav"');
  const backHome = html.indexOf('class="back-home"');
  const firstAnchor = html.indexOf('<a href="#top"', navStart);
  assert.ok(navStart > -1, 'Jary 页应有 primary-nav');
  assert.ok(backHome > navStart, '返回按钮应在主导航内');
  assert.ok(backHome < firstAnchor, '返回按钮应排在站内导航第一位');

  const css = await readFile(new URL('Jary/styles.css', root), 'utf8');
  assert.match(css, /\.primary-nav a\.back-home\s*\{/, '返回按钮应有自己的样式规则');
});

test('entries without a url render as plain blocks, so no dead links', async () => {
  const script = await readFile(new URL('scripts/render-sections.js', root), 'utf8');

  assert.match(script, /if \(href\) \{\s*body = el\('a'/);
  assert.match(script, /if \(href\) \{\s*card = el\('a'/);
});

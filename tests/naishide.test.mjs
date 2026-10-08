/* ==========================================================================
   作品「奶士德」：作品列表里的那一条 + 点进去只有一张图的那一页。
   要盯住的事：
     · 条目落在「图像」分类下、链接指得到真文件、并且排在首页看得见的位置；
     · 页面复用主站导航与样式，停在「作品」上，图是站内相对路径、带 alt 与宽高；
     · 这一页不引任何外部资源，图是压过的 WebP，页脚能回到作品页。
   ========================================================================== */

import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
const exists = (href) => access(new URL(href, root));

/* site-data.js 是普通脚本，数据挂在 window 上，造个假 window 取出来 */
function loadSiteData(source) {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.SITE_DATA;
}

const WORK_TITLE = '奶士德';
const PAGE = 'naishide/index.html';
const IMAGE = 'assets/naishide.webp';

test('作品列表里有「奶士德」，标签「图像」、状态「已完成」', async () => {
  const data = loadSiteData(await read('scripts/site-data.js'));
  const works = Array.from(data.works);
  const work = works.find((item) => item.title === WORK_TITLE);

  assert.ok(work, `作品列表里应该有《${WORK_TITLE}》`);
  assert.equal(work.tag, '图像', '这一件要落在「图像」分类下');
  assert.ok(Array.from(data.workTags).includes(work.tag), `「${work.tag}」不在 workTags 清单里`);
  assert.equal(work.meta, '已完成');
  assert.equal(work.url, PAGE);
  await assert.doesNotReject(exists(work.url), `作品链接指向不存在的文件：${work.url}`);
});

test('新作品排在列表最前，首页「精选内容」就看得见它', async () => {
  const [data, index] = [loadSiteData(await read('scripts/site-data.js')), await read('index.html')];

  assert.equal(Array.from(data.works)[0].title, WORK_TITLE,
    '首页只取前 3 件作品，新的要放在最前面才露得出来');
  assert.match(index, /data-works-grid[^>]*data-limit="3"/,
    '首页作品区少了 data-limit，这条守卫就名不副实了');
});

test('图片页复用主站导航与样式，导航停在「作品」上', async () => {
  const html = await read(PAGE);

  assert.match(html, /<link rel="stylesheet" href="\.\.\/assets\/style\.css">/);
  assert.match(html, /<script src="\.\.\/scripts\/theme\.js">/);
  assert.match(html, /class="page-header"/, '图片页缺少页头');
  assert.match(html, new RegExp(WORK_TITLE), '页头标题应当写明这个作品叫什么');
  assert.match(html, /href="\.\.\/works\.html" aria-current="page"/,
    '这一页属于作品，导航应停在「作品」上');
  assert.match(html, /<a class="nav-bird" href="\.\.\/xiaojudou\/index\.html"/,
    '导航栏最左端照旧是小橘豆的入口');
});

test('整页那张图走站内相对路径，指得到真文件，alt 与宽高都写全', async () => {
  const html = await read(PAGE);
  /* 只看正文里的那一张：导航栏的小橘豆图标也是 <img>，别把它当成本页的图 */
  const figure = html.match(/<figure[\s\S]*?<\/figure>/);

  assert.ok(figure, '正文里应该有一张图');
  const tag = figure[0].match(/<img[^>]*>/);
  assert.ok(tag, 'figure 里应该有 <img>');

  const src = tag[0].match(/\ssrc="([^"]+)"/)[1];
  assert.equal(src, IMAGE, '页面引的应当是压过的那张 WebP');
  assert.ok(!src.startsWith('/'), `图片路径不能以 / 开头，本地直接打开会失效：${src}`);
  await assert.doesNotReject(
    access(new URL(src, new URL(PAGE, root))),
    `图片指不到真文件：${src}`
  );

  assert.match(tag[0], /alt="[^"]+"/, '图挂了、读屏在念的时候，这张图得有个说法');
  assert.match(tag[0], /width="\d+" height="\d+"/, '宽高写死在标签上，版式才不会在图加载完时跳');
});

test('这一页不引任何外部资源，也不外链脚本或样式表', async () => {
  const html = await read(PAGE);

  assert.doesNotMatch(html, /https?:\/\//, '图片页不该引用外站资源（字体、CDN 都不行）');
  assert.doesNotMatch(html, /<script[^>]+src="https?:/, '图片页不该外链脚本');
  assert.doesNotMatch(html, /<link\b[^>]*href="https?:/, '图片页不该外链样式表');
});

test('页脚的「返回作品」指得到作品页', async () => {
  const html = await read(PAGE);
  const link = html.match(/<a href="\.\.\/works\.html">返回作品<\/a>/);

  assert.ok(link, '图片页应该有回作品页的入口');
  await assert.doesNotReject(
    access(new URL('../works.html', new URL(PAGE, root))),
    '返回链接指不到作品页'
  );
});

test('页面用的图是压过的，体积守得住 300 KB', async () => {
  const { size } = await stat(new URL(`naishide/${IMAGE}`, root));

  assert.ok(size < 300 * 1024,
    `作品页的图应控制在 300 KB 以内，现在是 ${(size / 1024).toFixed(1)} KB`);
});
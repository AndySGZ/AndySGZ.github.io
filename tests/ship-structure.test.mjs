/* ==========================================================================
   作品「船舶结构力学可视化展示」：专题页 + 第一个小项目（带板演示）。
   要盯住的事：
     · 作品列表里那一条的标签、状态、链接都对得上，且排在首页看得到的位置；
     · 专题页上的卡片由 site-data.js 驱动，子目录里的相对路径没有写歪；
     · 演示页是单文件、自带样式脚本，不引任何外部资源，并且能回到专题页。
   ========================================================================== */

import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
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

const WORK_TITLE = '船舶结构力学可视化展示';

test('作品列表里有「船舶结构力学可视化展示」，标签「学习」、状态「长期更新」', async () => {
  const data = loadSiteData(await read('scripts/site-data.js'));
  const works = Array.from(data.works);
  const work = works.find((item) => item.title === WORK_TITLE);

  assert.ok(work, `作品列表里应该有《${WORK_TITLE}》`);
  assert.equal(work.tag, '学习', '这一件要落在「学习」分类下');
  assert.ok(data.workTags.includes(work.tag), `「${work.tag}」不在 workTags 清单里`);
  assert.equal(work.meta, '长期更新');
  assert.equal(work.url, 'ship-structure/index.html');
  await assert.doesNotReject(exists(work.url), `作品链接指向不存在的文件：${work.url}`);
});

test('新作品排在列表最前，首页「精选内容」就看得见它', async () => {
  const [data, index] = [loadSiteData(await read('scripts/site-data.js')), await read('index.html')];

  assert.equal(Array.from(data.works)[0].title, WORK_TITLE,
    '首页只取前 3 件作品，新的要放在最前面才露得出来');
  assert.match(index, /data-works-grid[^>]*data-limit="3"/,
    '首页作品区少了 data-limit，这条守卫就名不副实了');
});

test('专题页复用主站导航与样式，并挂好渲染专题清单的容器', async () => {
  const html = await read('ship-structure/index.html');

  assert.match(html, /<link rel="stylesheet" href="\.\.\/assets\/style\.css">/);
  assert.match(html, /src="\.\.\/scripts\/site-data\.js"/);
  assert.match(html, /src="\.\.\/scripts\/render-sections\.js"/);
  assert.match(html, /class="page-header"/, '专题页缺少页头');
  assert.match(html, new RegExp(WORK_TITLE), '页头标题应当写明这个作品叫什么');

  /* 子目录页面：卡片容器必须交代自己离站点根目录有多远 */
  assert.match(html, /data-ship-demos/);
  assert.match(html, /data-ship-demos[^>]*data-url-prefix="\.\.\/"/);
});

test('专题清单里每一条都带着标题、说明与真实存在的文件', async () => {
  const data = loadSiteData(await read('scripts/site-data.js'));
  const demos = Array.from((data.shipStructure || {}).demos || []);

  assert.ok(demos.length > 0, '专题清单不该是空的');

  for (const demo of demos) {
    assert.ok(demo.title, '每条专题都要有标题');
    assert.ok(demo.text, `《${demo.title}》缺少一句话说明`);
    assert.ok(demo.url, `《${demo.title}》缺少 url`);
    assert.ok(!demo.url.startsWith('/'),
      `url 不能以 / 开头，本地直接打开会失效：${demo.url}`);
    await assert.doesNotReject(exists(demo.url), `《${demo.title}》指向不存在的文件：${demo.url}`);
  }

  const plate = demos.find((demo) => demo.title === '带板（附连翼板）展示');
  assert.ok(plate, '带板展示应该已经在清单里');
  assert.equal(plate.url, 'ship-structure/plate-demo.html');
});

test('渲染脚本会按 data-url-prefix 把专题卡片的链接接回根目录', async () => {
  const script = await read('scripts/render-sections.js');

  assert.match(script, /querySelector\('\[data-ship-demos\]'\)/);
  assert.match(script, /getAttribute\('data-url-prefix'\)/);
  /* 前缀只拼在站内链接上，且没写前缀的调用方（作品网格）行为不变 */
  assert.match(script, /if \(href && prefix\) href = prefix \+ href;/);
});

test('带板演示是单文件，自带样式脚本，不拉任何外部资源', async () => {
  const html = await read('ship-structure/plate-demo.html');

  assert.match(html, /<canvas/, '演示靠 canvas 画截面与梁的挠曲');
  assert.match(html, /<style>/, '样式应当内联在这一个文件里');
  assert.match(html, /<script>/, '脚本应当内联在这一个文件里');
  assert.doesNotMatch(html, /https?:\/\//, '演示页不该引用外站资源（字体、CDN 都不行）');
  assert.doesNotMatch(html, /<script[^>]+src=/, '演示页不该外链脚本');
  assert.doesNotMatch(html, /<link\b[^>]*stylesheet/, '演示页不该外链样式表');
});

test('带板演示能回到专题页，且链接指得到真文件', async () => {
  const html = await read('ship-structure/plate-demo.html');
  const link = html.match(/<a class="back" href="([^"]+)"/);

  assert.ok(link, '演示页应该有返回专题页的入口');
  assert.equal(link[1], 'index.html', '返回链接写同目录的相对路径，别用 / 开头');
  await assert.doesNotReject(
    access(new URL(link[1], new URL('ship-structure/plate-demo.html', root))),
    '返回链接指不到专题页'
  );
});

test('ship-structure/README.md 写清怎么加下一个专题', async () => {
  const readme = await read('ship-structure/README.md');

  assert.match(readme, /site-data\.js/);
  assert.match(readme, /shipStructure\.demos/);
  assert.match(readme, /data-url-prefix/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

/* site-data.js 是普通脚本，数据挂在 window 上，造个假 window 取出来 */
function loadSiteData(source) {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.SITE_DATA;
}

const PAGES = ['index.html', 'about.html', 'essays.html', 'works.html', 'practice.html'];

/* 六个真实页面，且每个都带同字号的中英对照 */
const EXPECTED_NAV = [
  ['index.html', '首页', 'Home'],
  ['about.html', '关于', 'About'],
  ['essays.html', '杂谈', 'Essays'],
  ['works.html', '作品', 'Works'],
  ['practice.html', '练琴', 'Practice'],
  ['Jary/index.html', '《Jary行为研究》', 'JARY Behavior Research'],
];

function navLinks(html) {
  const nav = html.match(/<nav class="site-nav__links"[\s\S]*?<\/nav>/);
  if (!nav) return null;
  return [...nav[0].matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => {
    const inner = match[2];
    const zh = (inner.match(/class="nav-zh">([^<]*)</) || [])[1];
    const en = (inner.match(/class="nav-en">([^<]*)</) || [])[1];
    return [match[1], zh, en];
  });
}

test('every page shares the same six-item navigation', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    assert.deepEqual(navLinks(html), EXPECTED_NAV, `${page} 的导航与其他页面不一致`);
  }
});

test('navigation is bilingual with Chinese and English at the same size', async () => {
  const css = await read('assets/style.css');

  // 找出所有选择器命中 .nav-zh / .nav-en 的规则
  const navRules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .map((match) => ({ selector: match[1].trim(), body: match[2] }))
    .filter((rule) => /\.nav-(zh|en)\b/.test(rule.selector));

  const sized = navRules.filter((rule) => /font-size\s*:/.test(rule.body));

  // 有且仅有一条规则设定字号，且它同时覆盖中英文 —— 两者因此必然等大
  assert.equal(sized.length, 1, '中英文导航字号应只由一条规则设定');
  assert.match(sized[0].selector, /\.nav-zh/);
  assert.match(sized[0].selector, /\.nav-en/);

  // 每个导航项都要同时有中文和英文
  for (const page of PAGES) {
    const html = await read(page);
    for (const [href, zh, en] of navLinks(html)) {
      assert.ok(zh && zh.trim(), `${page} 的 ${href} 缺少中文`);
      assert.ok(en && en.trim(), `${page} 的 ${href} 缺少英文`);
    }
  }
});

test('navigation links to real pages, never to in-page anchors', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    for (const [href] of navLinks(html)) {
      assert.doesNotMatch(href, /#/, `${page} 的导航仍然指向页内锚点：${href}`);
    }
  }
});

test('navigation uses relative links so local file:// opening also works', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    for (const [href] of navLinks(html)) {
      assert.doesNotMatch(href, /^\//, `${page} 的导航用了绝对路径，本地直接打开会失效：${href}`);
      assert.doesNotMatch(href, /^https?:/, `${page} 的导航不应指向外站：${href}`);
    }
  }
});

test('each page marks exactly one current navigation item', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    const marks = html.match(/aria-current="page"/g) || [];
    assert.equal(marks.length, 1, `${page} 应有且仅有一个 aria-current="page"`);
  }
});

test('homepage previews three items, subpages show the full collection', async () => {
  const index = await read('index.html');
  assert.match(index, /data-essays-list[^>]*data-limit="3"/);
  assert.match(index, /data-works-grid[^>]*data-limit="3"/);

  const essays = await read('essays.html');
  assert.match(essays, /data-essays-list/);
  assert.doesNotMatch(essays, /data-essays-list[^>]*data-limit/);

  const works = await read('works.html');
  assert.match(works, /data-works-grid/);
  assert.doesNotMatch(works, /data-works-grid[^>]*data-limit/);
});

test('list pages load the data and renderer they depend on', async () => {
  for (const page of ['essays.html', 'works.html']) {
    const html = await read(page);
    assert.match(html, /src="scripts\/site-data\.js"/, `${page} 缺少 site-data.js`);
    assert.match(html, /src="scripts\/render-sections\.js"/, `${page} 缺少 render-sections.js`);
    assert.match(html, /class="page-header"/, `${page} 缺少页头`);
    assert.match(html, /href="assets\/style\.css"/, `${page} 缺少样式表`);
  }
});

test('a pending entry renders as a non-link so there are no dead links', async () => {
  const script = await read('scripts/render-sections.js');

  assert.match(script, /entry__body/);
  assert.match(script, /card--pending/);
  assert.match(script, /尚未发布/);
});

test('分类栏只在数据里写了分类时才出现', async () => {
  const script = await read('scripts/render-sections.js');

  // 分类清单来自数据，而不是回头去扫条目的 tag —— 想分类时才分类
  assert.match(script, /tags:\s*data\.essayTags/);
  assert.match(script, /tags:\s*data\.workTags/);
  // 清单为空整栏不渲染
  assert.match(script, /if \([^)]*!tags\.length[^)]*\) return;/);

  const [essays, works] = await Promise.all([read('essays.html'), read('works.html')]);
  assert.match(essays, /data-essay-filter/);
  assert.match(essays, /data-essay-status/);
  assert.match(works, /data-works-filter/);
  assert.match(works, /data-works-status/);
});

test('作品页按五类分，每件作品都落在这五类里；杂谈先不分类', async () => {
  const data = loadSiteData(await read('scripts/site-data.js'));

  /* Array.from 是必须的：vm 里造出来的数组原型在另一个 realm，
     直接 deepStrictEqual 会因为「不是同一个 Array」而失败 */
  assert.deepEqual(Array.from(data.workTags), ['声音', '图像', '学习', '科研', '其他']);
  assert.ok(data.works.length > 0, '作品列表不该是空的');
  for (const work of data.works) {
    assert.ok(data.workTags.includes(work.tag), `《${work.title}》的 tag「${work.tag}」不在 workTags 清单里`);
  }

  assert.deepEqual(Array.from(data.essayTags), [], '杂谈暂时不分类，清单要保持为空');
});

test('about 与首页共用同一份联系方式', async () => {
  const [about, index, source] = await Promise.all([
    read('about.html'), read('index.html'), read('scripts/site-data.js'),
  ]);

  assert.match(index, /data-contact-list/);
  assert.match(about, /data-contact-list/);
  assert.match(about, /src="scripts\/site-data\.js"/);

  const { contact } = loadSiteData(source);
  assert.deepEqual(Array.from(contact, (entry) => entry.value),
    ['1434582884@qq.com', 'AndySGZ', '不便透露:)']);
  assert.equal(contact[1].url, 'https://github.com/AndySGZ');
});

test('被筛掉的条目和卡片真的从布局里消失，卡片颜色也跟着重排', async () => {
  const css = (await read('assets/style.css')).replace(/\s+/g, ' ');

  // .entry 和 .card 都自带 display，作者样式会盖过 [hidden] 自带的 none
  assert.ok(css.includes('.entry[hidden] { display: none; }'), '缺少 .entry[hidden] 兜底');
  assert.ok(css.includes('.card[hidden] { display: none; }'), '缺少 .card[hidden] 兜底');

  // 卡片阴影色号必须是变量，否则筛选后没法按当前可见顺序重排
  assert.ok(css.includes('box-shadow: 6px 6px 0 0 var(--card-shadow)'), '卡片阴影没有走 --card-shadow');
  assert.ok(css.includes('--card-shadow: var(--red)'), '缺少卡片阴影的循环换色');
});

test('the Jary journal page is left untouched and still standalone', async () => {
  const html = await read('Jary/index.html');

  assert.match(html, /JARY Behavior Research/);
  assert.match(html, /href="styles\.css"/);
  // JBR 有自己的语言切换，不并入主站导航
  assert.match(html, /data-language-option="zh"/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);

test('Jary route exposes the complete bilingual journal identity', async () => {
  const html = await readFile(new URL('Jary/index.html', projectRoot), 'utf8');

  assert.match(html, /JARY Behavior Research/);
  assert.match(html, /《JARY行为研究》/);
  /* 期刊的「单一个体」设定靠侧栏这一栏撑着，正文里不再把人称作 Subject JARY */
  assert.ok(html.includes('JARY / N=1'), '侧栏应保留研究对象与样本数');
  assert.match(html, /研究对象/);
  assert.match(html, /严谨记录，科学分析/);
  assert.match(html, /Rigorous Recording, Scientific Analysis/);

  for (const scope of [
    'Jary个体行为学机理',
    'Jary行为动态观测',
    'Jary言论与认知分析',
    'Jary与网络符号交互',
  ]) {
    assert.match(html, new RegExp(scope));
  }
});

test('language resolver honors saved preference and browser language', async () => {
  const { resolveLanguage } = await import('../Jary/language.js');

  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
  assert.equal(resolveLanguage('zh', 'en-US'), 'zh');
  assert.equal(resolveLanguage(null, 'zh-TW'), 'zh');
  assert.equal(resolveLanguage(null, 'fr-FR'), 'en');
  assert.equal(resolveLanguage('invalid', 'zh-CN'), 'zh');
});

test('language application updates the document and persists the selection', async () => {
  const { applyLanguage } = await import('../Jary/language.js');
  const state = { lang: '', dataset: {}, querySelectorAll: () => [] };
  const writes = [];
  const storage = { setItem: (key, value) => writes.push([key, value]) };

  assert.equal(applyLanguage('en', state, storage), 'en');
  assert.equal(state.lang, 'en');
  assert.equal(state.dataset.language, 'en');
  assert.deepEqual(writes, [['jary-language', 'en']]);
});

test('behavior trace is deterministic and stays inside its drawing area', async () => {
  const { buildBehaviorTrace } = await import('../Jary/observation.js');
  const first = buildBehaviorTrace(640, 480, 0.25);
  const second = buildBehaviorTrace(640, 480, 0.25);

  assert.deepEqual(first, second);
  assert.equal(first.length, 72);
  assert.ok(first.every(({ x, y }) => x >= 0 && x <= 640 && y >= 0 && y <= 480));
  assert.ok(new Set(first.map(({ y }) => Math.round(y))).size > 12);
});

test('journal styles preserve keyboard focus and reduced-motion preferences', async () => {
  const css = await readFile(new URL('Jary/styles.css', projectRoot), 'utf8');

  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
});

test('journal homepage provides an editorial current-issue reading flow', async () => {
  const html = await readFile(new URL('Jary/index.html', projectRoot), 'utf8');

  assert.match(html, /class="journal-cover"/);
  assert.match(html, /class="[^"]*\bcurrent-issue\b[^"]*"/);
  assert.match(html, /class="article-list"/);
  assert.equal((html.match(/class="article-row"/g) ?? []).length, 4);
  assert.match(html, /Volume 1[\s\S]*Issue 1[\s\S]*21 September 2026/i);
});

test('封面是那张现成的图，带 alt 和宽高，加载前后不抖', async () => {
  const html = await readFile(new URL('Jary/index.html', projectRoot), 'utf8');
  const match = html.match(/<img class="cover-image"[\s\S]*?>/);

  assert.ok(match, '首页封面应该是一张图（cover-image）');
  assert.match(match[0], /src="assets\/cover\.webp"/, '封面应指向 assets/cover.webp');
  assert.ok(!match[0].includes('src="/'), '图片路径不能用 / 开头，否则本地直接打开会失效');
  assert.match(match[0], /alt="[^"]+"/, '封面要有 alt，读屏和「图挂了」时都有说明');
  assert.match(match[0], /width="\d+"\s+height="\d+"/, '写死宽高，图没加载出来之前不抖一下');

  // 图真的在仓库里，而且刊头已经印在图上了，HTML 不用再拼一次
  await readFile(new URL('Jary/assets/cover.webp', projectRoot));
  assert.doesNotMatch(html, /class="cover-title"/, '刊头在图里，HTML 不该再排一遍');

  // 换图之后首页不再画概念轨迹，observation.js 也就不该被引入
  assert.doesNotMatch(html, /src="observation\.js"/, '首页不该再加载 observation.js');
});

test('mobile reading order puts issue editorial before its supplementary cover', async () => {
  const html = await readFile(new URL('Jary/index.html', projectRoot), 'utf8');
  const issue = html.slice(html.indexOf('<section class="current-issue'), html.indexOf('</section>', html.indexOf('<section class="current-issue')));

  assert.ok(issue.indexOf('class="issue-overview"') < issue.indexOf('class="journal-cover"'));
  assert.doesNotMatch(html, /class="institution-bar"/);
});

test('research programmes do not claim unpublished articles or identifiers', async () => {
  const html = await readFile(new URL('Jary/index.html', projectRoot), 'utf8');

  assert.equal((html.match(/class="article-row"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /OPEN PROGRAMME|ISSN PENDING|JBR-2026-001|JBR \/ (?:MEC|OBS|COG|NET)/);
});

test('observation plate remains static instead of scheduling continuous animation', async () => {
  const { createObservationPlate } = await import('../Jary/observation.js');
  const context = new Proxy({}, { get: () => () => {} });
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 360, height: 420, left: 0, top: 0 }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  let scheduledFrames = 0;
  const windowRef = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: () => {
      scheduledFrames += 1;
      return scheduledFrames;
    },
    cancelAnimationFrame: () => {},
  };

  const plate = createObservationPlate(canvas, { windowRef, reducedMotion: false });
  assert.equal(scheduledFrames, 0);
  plate.destroy();
});

test('observation plate identifies itself as conceptual rather than measured data', async () => {
  const source = await readFile(new URL('Jary/observation.js', projectRoot), 'utf8');

  assert.match(source, /CONCEPTUAL TRACE/);
  assert.doesNotMatch(source, /SIGNAL JARY-01|T\+/);
});

/* —— 导航：首页 / 游戏 / 动态 / 本期 / 往期 / 关于本刊（前面再加一个返回主页） —— */

const JARY_PAGES = [
  'Jary/index.html',
  'Jary/games.html',
  'Jary/updates.html',
  'Jary/issues.html',
  'Jary/escape-nailong.html',
];

/* 栏目名：中文、英文，以及属于这一栏目的页面（用来找 aria-current） */
const JARY_SECTIONS = [
  ['首页', 'Home', ['Jary/index.html']],
  ['游戏', 'Games', ['Jary/games.html', 'Jary/escape-nailong.html']],
  ['动态', 'Updates', ['Jary/updates.html']],
  ['本期', 'Current issue', ['Jary/index.html#current']],
  ['往期', 'Archive', ['Jary/issues.html']],
  ['关于本刊', 'About', ['Jary/index.html#about']],
];

/* 把 <nav class="primary-nav"> 里的链接拆成 { href, zh, en, current } */
function jaryNavLinks(html) {
  const nav = html.match(/<nav class="primary-nav"[\s\S]*?<\/nav>/);
  if (!nav) return null;

  return [...nav[0].matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => {
    const attrs = match[1];
    const inner = match[2];
    return {
      href: (attrs.match(/href="([^"]+)"/) || [])[1],
      zh: (inner.match(/data-lang="zh">([^<]*)</) || [])[1],
      en: (inner.match(/data-lang="en">([^<]*)</) || [])[1],
      current: /\baria-current="page"/.test(attrs),
    };
  });
}

test('每一页期刊页面共用同一套六个栏目', async () => {
  for (const page of JARY_PAGES) {
    const html = await readFile(new URL(page, projectRoot), 'utf8');
    const links = jaryNavLinks(html);
    assert.ok(links, `${page} 里找不到 primary-nav`);

    // 第一个是「返回主页」，之后六个才是栏目本身
    const [backHome, ...sections] = links;
    assert.match(backHome.href, /^\.\.\/index\.html$/, `${page} 的返回主页应指向 ../index.html`);
    assert.ok(backHome.zh && backHome.en, '返回主页应有中英两行文案');

    assert.deepEqual(
      sections.map((link) => [link.zh, link.en]),
      JARY_SECTIONS.map(([zh, en]) => [zh, en]),
      `${page} 的栏目与其他期刊页面不一致`
    );

    // 每个栏目都要有中英对照，否则切到 EN 会看到中文
    for (const link of sections) {
      assert.ok(link.zh && link.en, `${page} 的「${link.zh}」缺中英对照`);
    }
  }
});

test('每一页只标一个「当前栏目」，且标的是自己', async () => {
  for (const page of JARY_PAGES) {
    const html = await readFile(new URL(page, projectRoot), 'utf8');
    const links = jaryNavLinks(html).slice(1);
    const current = links.filter((link) => link.current);

    assert.equal(current.length, 1, `${page} 应该只有一个 aria-current="page"`);

    // 把页面里的链接按所在文件解析成 Jary/xxx.html[#frag]，再和归属表对上
    const owner = JARY_SECTIONS.find((section) => section[2].some((target) => {
      const [file, fragment] = target.split('#');
      if (file !== page) return false;
      if (!fragment) return true;
      // 页内锚点写成 #frag，跨页写成 file.html#frag
      return current[0].href === `#${fragment}` || current[0].href === target;
    }));
    assert.ok(owner, `${page} 的 aria-current 落在了没有对应内容的链接上`);
    assert.equal(current[0].zh, owner[0], `${page} 标错了当前栏目`);
  }
});

/* —— 动态 —— */

test('动态的数据形状齐全，页面才敢直接照着渲染', async () => {
  const { UPDATES } = await import('../Jary/updates-data.js');

  assert.ok(Array.isArray(UPDATES) && UPDATES.length > 0, '动态至少得有一条');

  for (const entry of UPDATES) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `日期要写 YYYY-MM-DD：${entry.date}`);
    assert.ok(entry.title, `${entry.date} 那条缺标题`);
    /* 只有一句话配几张照片也是一条动态，所以正文和图片有一样就行 */
    assert.ok(entry.text || (entry.images || []).length, `${entry.date} 那条既没正文也没图`);

    for (const image of entry.images || []) {
      // alt 是给读屏和加载失败时看的，不能省
      assert.ok(image.alt, `${image.src} 缺 alt`);
    }
  }
});

test('期刊自己发的动态是中英各一份，不是靠中文兜底', async () => {
  const { UPDATES } = await import('../Jary/updates-data.js');

  /* 渲染层允许只写一边（缺的用另一边顶上），但期刊里的文案都是双语，
     只写中文会让 EN 版出现「英文标题 + 中文正文」，所以这一条盯住自己发的动态。 */
  const both = (value) => value && typeof value === 'object' && value.zh && value.en;

  for (const entry of UPDATES) {
    assert.ok(both(entry.title), `${entry.date} 的标题缺中英之一`);
    // text 本来就可选（只放图的那条没有正文），写了就得中英都有
    if (entry.text) assert.ok(both(entry.text), `${entry.date} 的正文缺中英之一`);
    if (entry.kind) assert.ok(both(entry.kind), `${entry.date} 的标签缺中英之一`);
    if (entry.link) assert.ok(both(entry.link.label), `${entry.date} 的链接文案缺中英之一`);
    for (const image of entry.images || []) {
      if (image.caption) assert.ok(both(image.caption), `${image.src} 的图注缺中英之一`);
    }
  }
});

test('动态文案缺了英文时落回中文，不留下空白', async () => {
  const { pick } = await import('../Jary/updates.js');

  assert.equal(pick({ zh: '只有中文' }, 'en'), '只有中文');
  assert.equal(pick({ en: 'English only' }, 'zh'), 'English only');
  assert.equal(pick({ zh: '甲', en: 'B' }, 'en'), 'B');
  // 纯字符串中英共用
  assert.equal(pick('两边一样', 'en'), '两边一样');
  // 什么都没有时给空串，而不是 "undefined"
  assert.equal(pick(undefined, 'zh'), '');
  assert.equal(pick(null, 'en'), '');
});

test('动态正文按空行分段，中英各切各的，不会印出 [object Object]', async () => {
  const { splitParagraphs } = await import('../Jary/updates.js');

  const text = { zh: '甲一。\n\n甲二。', en: 'B one.\n\nB two.' };
  assert.deepEqual(splitParagraphs(text, 'zh'), ['甲一。', '甲二。']);
  assert.deepEqual(splitParagraphs(text, 'en'), ['B one.', 'B two.']);
  // 对象要当对象处理 —— 直接 String() 的话整段会变成 [object Object]
  assert.ok(!splitParagraphs(text, 'zh').some((line) => line.includes('[object')));

  // 只写了中文时，英文那侧落回中文，段数也对得上
  assert.deepEqual(splitParagraphs({ zh: '只有中文' }, 'en'), ['只有中文']);
  // 纯字符串中英共用
  assert.deepEqual(splitParagraphs('一句\n\n又一句', 'zh'), ['一句', '又一句']);
  assert.deepEqual(splitParagraphs(undefined, 'zh'), []);
});

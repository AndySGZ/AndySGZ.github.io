/* ==========================================================================
   感触句栏的「上一条 / 下一条」：盯住手动翻页这一路，
   以及它跟自动轮播、悬停暂停、减少动态效果三者的交界。

   这些全是行为，光在源码里找字符串证明不了，所以搭一个最小的假 DOM
   和一个假时钟，把 scripts/quote-rotator.js 放进 vm 里真跑一遍。
   ========================================================================== */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

/* ---------- 够用的假 DOM：只实现这个脚本真正碰过的那几样 ---------- */

/* 形状照着 DOMTokenList 来：脚本用的是 contains()，Set 上叫 has() */
class FakeClassList {
  constructor() { this.names = new Set(); }
  add(...names) { names.forEach((name) => this.names.add(name)); }
  remove(...names) { names.forEach((name) => this.names.delete(name)); }
  contains(name) { return this.names.has(name); }
}

class FakeNode {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.classList = new FakeClassList();
    this.className = '';
    this.parentNode = null;
    this.hidden = false;
    this._text = '';
  }

  /* 有子元素时读的是子元素的文字（脚本按 blockquote 的字数算停留时间），
     设值则当成「清空重写」—— host.textContent = '' 靠的就是这一条 */
  get textContent() {
    if (this.children.length) return this.children.map((child) => child.textContent).join('');
    return this._text;
  }

  set textContent(value) {
    this._text = String(value);
    this.children.length = 0;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }

  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  fire(type) {
    for (const handler of this.listeners[type] || []) handler({ type });
  }
}

/* 假时钟：脚本调 setTimeout / clearTimeout，测试自己决定走到哪一刻 */
function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();

  return {
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.set(id, { at: now + (Number(ms) || 0), fn });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },

    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = target;
    },
  };
}

const ITEMS = [
  { text: '第一句', source: '甲' },
  { text: '第二句', source: '乙' },
  { text: '第三句', source: '丙' },
];

async function boot(options = {}) {
  const host = new FakeNode('div');
  const navHost = new FakeNode('div');
  const column = new FakeNode('div');          /* 句子与按钮的共同父元素 */
  column.appendChild(host);
  column.appendChild(navHost);
  host.textContent = '';                       /* 无脚本兜底句已经清掉，这里只占位 */

  const clock = fakeClock();
  const media = {
    matches: !!options.reduced,
    listeners: [],
    addEventListener(type, handler) { if (type === 'change') this.listeners.push(handler); },
  };

  const documentRef = {
    querySelector: (selector) => (
      selector === '[data-quote-rotator]' ? host
        : selector === '[data-quote-nav]' ? navHost
          : null
    ),
    createElement: (tag) => new FakeNode(tag),
  };

  const windowRef = {
    SITE_DATA: { quotes: { reading: { perChar: 260, min: 4500, max: 14000 }, fade: 700, gap: 600, items: ITEMS } },
    matchMedia: () => media,
  };

  const source = await read('scripts/quote-rotator.js');
  vm.runInContext(source, vm.createContext({
    window: windowRef,
    document: documentRef,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  }));

  /* 整栏悬停 / 聚焦都算暂停区，所以两个节点都打一遍 —— 哪边绑着都算数 */
  const hover = (on) => {
    for (const node of [host, column]) node.fire(on ? 'mouseenter' : 'mouseleave');
  };

  const buttons = navHost.children.filter((child) => child.tagName === 'button');
  const visible = () => host.children
    .map((node, i) => (node.classList.contains('is-visible') ? i : -1))
    .filter((i) => i >= 0);
  const nowShowing = () => visible()[0] ?? -1;

  return { host, navHost, column, clock, media, hover, buttons, visible, nowShowing };
}

/* ---------- 用例 ---------- */

test('上一条 / 下一条真的生成出来了，且是正经按钮', async () => {
  const app = await boot();

  /* 按钮上只有一个画出来的三角形，没有字，所以名字必须在 aria-label 上，
     否则读屏念出来就是两个光秃秃的「按钮」 */
  assert.deepEqual(app.buttons.map((b) => b.getAttribute('aria-label')), ['上一条', '下一条']);
  assert.deepEqual(app.buttons.map((b) => b.textContent), ['', ''], '箭头是画出来的，不该再塞字形进去');
  assert.deepEqual(app.buttons.map((b) => b.className), [
    'quote-nav__btn quote-nav__btn--prev',
    'quote-nav__btn quote-nav__btn--next',
  ]);
  assert.deepEqual(app.buttons.map((b) => b.type), ['button', 'button'], '按钮必须写死 type=button，别在表单里变成提交');
  assert.equal(app.navHost.getAttribute('role'), 'group');

  /* 箭头得是 CSS 画的三角形：这站禁用「←」「→」这类符号字符，
     整条链（HTML、脚本、样式表）都不许出现它们 */
  const [html, css, script] = await Promise.all([
    read('index.html'),
    read('assets/style.css'),
    read('scripts/quote-rotator.js'),
  ]);
  assert.match(css, /\.quote-nav__btn--prev::before\s*\{[^}]*border-right:[^}]*currentColor/s);
  assert.match(css, /\.quote-nav__btn--next::before\s*\{[^}]*border-left:[^}]*currentColor/s);
  /* 注释里会大方地提到被禁的字符（「不许用 →」之类），先剥掉注释再查，
     否则规矩一写进注释就自己把自己判违规了 */
  const stripComments = (source) => source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  for (const source of [html, css, script]) {
    assert.doesNotMatch(stripComments(source), /[←→]/,
      '箭头要用几何图形画，不许用符号字符');
  }

  /* 按钮不能写在 HTML 里：没 JS 时轮播不存在，留着就是两个按不动的死按钮 */
  assert.match(html, /data-quote-nav/);
  assert.doesNotMatch(html, /<button[^>]*quote-nav/, 'HTML 里不该有硬写的翻页按钮');
});

test('下一条往前走，走到头绕回第一句；上一条往回走，走到头绕到最后一句', async () => {
  const app = await boot();
  const [prev, next] = app.buttons;

  assert.equal(app.nowShowing(), 0, '进来先显示第一句');

  next.fire('click');
  app.clock.advance(700);          /* 淡出的时间，退干净了才进场 */
  assert.equal(app.nowShowing(), 1);

  next.fire('click');
  app.clock.advance(700);
  next.fire('click');
  app.clock.advance(700);
  assert.equal(app.nowShowing(), 0, '第三句之后应该绕回第一句');

  prev.fire('click');
  app.clock.advance(700);
  assert.equal(app.nowShowing(), 2, '第一句往回退应该绕到最后一句');
});

test('翻页时永远只有一句在屏幕上，不会两句糊在一起', async () => {
  const app = await boot();
  const [prev, next] = app.buttons;

  /* 边自动轮播边手动翻，每 50ms 检查一次：任何一刻可见的都不能超过一句 */
  for (let round = 0; round < 30; round += 1) {
    if (round % 7 === 3) next.fire('click');
    if (round % 11 === 5) prev.fire('click');
    app.clock.advance(500);
    assert.ok(app.visible().length <= 1,
      `第 ${round} 轮有 ${app.visible().length} 句同时可见：${app.visible().join('、')}`);
  }
});

test('鼠标停在按钮上（整栏暂停）时，按下去照样翻页', async () => {
  const app = await boot();
  const [, next] = app.buttons;

  app.hover(true);                 /* 鼠标移进整栏：自动轮播停下 */
  app.clock.advance(20000);        /* 停着不动也证明暂停真的生效了 */
  assert.equal(app.nowShowing(), 0, '暂停期间不该自动往下轮');

  next.fire('click');
  app.clock.advance(700);
  assert.equal(app.nowShowing(), 1, '暂停不该拦住用户自己按的键');

  app.clock.advance(20000);
  assert.equal(app.nowShowing(), 1, '按完还停在按钮上，那就继续暂停着');

  app.hover(false);                /* 鼠标移开，自动轮播从这一句接着走 */
  app.clock.advance(800);          /* 恢复的 800ms 缓冲走完，这一句开始退场 */
  assert.equal(app.nowShowing(), -1, '移开之后这一句该退场，轮播得接着往下走');
  app.clock.advance(1300);         /* 淡出 700 + 留白 600 走完，下一句进场 */
  assert.equal(app.nowShowing(), 2);
});

test('连按两下不会卡住：第二下不等第一下退完', async () => {
  const app = await boot();
  const [, next] = app.buttons;

  next.fire('click');
  app.clock.advance(200);          /* 第一下还没退干净 */
  next.fire('click');              /* 第二下：该直接进第二句，而不是原地重排一次 */
  app.clock.advance(700);

  assert.equal(app.nowShowing(), 2, '连按两下应该往前走两句');
});

test('减少动态效果时没有翻页按钮，句子全部静态铺开', async () => {
  const app = await boot({ reduced: true });

  assert.equal(app.navHost.hidden, true, '全都摊开显示时，「下一条」没有意义');
  assert.deepEqual(app.visible(), [0, 1, 2], '不轮播时每一句都要看得见');
});

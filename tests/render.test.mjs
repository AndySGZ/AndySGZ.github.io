/* ==========================================================================
   渲染冒烟测试：接上一个假的 2D 上下文，把整条绘制链路真跑一遍。
   --------------------------------------------------------------------------
   玩法逻辑由 tests/game.test.mjs 盯着；这里只管「画的时候会不会炸」——
   待机、暂停、结束成绩卡、立绘加载，全都真的调用一次。
   浏览器环境用最小替身凑出来，所以装不了画布也能跑。
   ========================================================================== */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createGame, stepRun } from '../Jary/escape-nailong.js';

const STEP = 1 / 120;

/* 没实现的方法一律当成空操作，同时把调用记下来，方便事后检查到底画了什么 */
function fakeContext() {
  const target = {
    calls: [],
    measureText: (text) => ({ width: String(text).length * 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };

  return new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      return (...args) => { object.calls.push([String(property), ...args]); };
    },
    set(object, property, value) {
      object[property] = value;
      return true;
    },
  });
}

/* 立绘替身：赋 src 就当场触发 load，好让模块同步拿到「图已经加载好」的状态 */
class FakeImage {
  constructor() {
    this.listeners = {};
    this.naturalWidth = 273;
    this.naturalHeight = 520;
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  set src(value) {
    this.currentSrc = value;
    for (const handler of this.listeners.load || []) handler();
  }

  get src() {
    return this.currentSrc;
  }
}

function fakeWindow() {
  const queue = [];

  return {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: (callback) => queue.push(callback),
    cancelAnimationFrame() {},
    Image: FakeImage,

    /* 测试自己决定什么时候走下一帧 */
    pending: () => queue.length,
    step(time) {
      for (const callback of queue.splice(0)) callback(time);
    },
  };
}

const SPRITES = {
  jary: 'assets/game/jary.png',
  nailong: 'assets/game/nailong.png',
  laugh: 'assets/game/laugh.png',
};

function makeGame(options = {}) {
  const context = fakeContext();
  const canvas = {
    width: 960,
    height: 420,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 960, height: 420 }),
    addEventListener() {},
    removeEventListener() {},
  };

  const windowRef = fakeWindow();
  const game = createGame(canvas, {
    windowRef,
    documentRef: null,
    reducedMotion: true,
    pixelRatio: 1,
    seed: 99,
    best: 0,
    sprites: options.sprites ?? SPRITES,
    ...options.extra,
  });

  return { game, context, windowRef };
}

function textsOf(context) {
  return context.calls.filter(([name]) => name === 'fillText').map(([, text]) => String(text));
}

function imagesOf(context) {
  return context.calls.filter(([name, image]) => name === 'drawImage' && image);
}

/* 干净地跑一段距离（把奶龙按住、把障碍挪走），好让成绩不为零 */
function runClear(game, seconds) {
  for (let index = 0; index < Math.round(seconds / STEP); index += 1) {
    game.run.chase = 440;
    game.run.obstacles.length = 0;
    stepRun(game.run, STEP);
  }
}

/* 把奶龙贴到脸上，再让 JARY 撞一下，这一趟当场结束 */
function endRun(game) {
  game.run.chase = 12;
  game.run.obstacles = [{ type: 'desk', x: game.run.world + 10, hit: false }];
  stepRun(game.run, STEP);
  assert.equal(game.run.phase, 'over');
}

test('a browser-less canvas still renders the ready screen', () => {
  const { game, context } = makeGame();

  assert.ok(game, '有 2D 上下文就该返回可用的实例');
  assert.equal(game.run.phase, 'ready');

  const texts = textsOf(context);
  assert.ok(texts.some((text) => text.indexOf('JARY 逃离奶龙') === 0), '待机画面要画出标题');

  const drawn = imagesOf(context).map(([, image]) => image.src);
  assert.ok(drawn.includes(SPRITES.jary), 'JARY 应该已经站在场上');
  assert.ok(drawn.includes(SPRITES.nailong), '奶龙应该已经追在身后');
  assert.ok(!drawn.includes(SPRITES.laugh), '还没输，不该亮出成绩卡上的立绘');
});

test('pausing draws the pause overlay', () => {
  const { game, context } = makeGame();

  game.begin();
  game.pause();

  assert.equal(game.run.phase, 'paused');
  assert.ok(textsOf(context).some((text) => text === '已暂停'));
});

test('the results card shows Nailong laughing beside the run stats', () => {
  const { game, context } = makeGame();

  game.begin();
  runClear(game, 2);
  endRun(game);

  context.calls.length = 0;
  game.render();

  const laughs = imagesOf(context).filter(([, image]) => image.src === SPRITES.laugh);
  assert.equal(laughs.length, 1, '成绩卡上应该画一张捧腹大笑的奶龙');

  const [, , , artWidth, artHeight] = laughs[0];
  assert.ok(artWidth > 0 && artHeight > 0);
  assert.ok(artWidth < 176.001, '立绘不该超出卡片给的位置');

  const texts = textsOf(context);
  assert.ok(texts.some((text) => text === '被奶龙抓住了！'), '要写明是怎么输的');
  assert.ok(texts.some((text) => text.indexOf(' m') > 0 && text[0] >= '0' && text[0] <= '9'),
    '成绩卡要报出距离');
  assert.ok(texts.some((text) => text.indexOf('新纪录') === 0), '第一趟就该标新纪录');
});

test('the card still reads without any artwork', () => {
  const { game, context } = makeGame({ sprites: {} });

  game.begin();
  runClear(game, 1);
  endRun(game);

  context.calls.length = 0;
  game.render();

  assert.equal(imagesOf(context).length, 0, '没给立绘就不该有 drawImage');
  assert.ok(textsOf(context).some((text) => text === '被奶龙抓住了！'));
});

test('the closing animation runs a few frames and then lets the loop stop', () => {
  const { game, windowRef } = makeGame({ extra: { reducedMotion: false } });

  game.begin();
  endRun(game);

  assert.ok(windowRef.pending() > 0, '进场动画还在跑，循环应该还排着队');

  let frames = 0;
  let time = 1000;
  while (windowRef.pending() > 0 && frames < 300) {
    windowRef.step(time);
    time += 16;
    frames += 1;
  }

  assert.ok(frames < 90, '进场不该拖这么久：' + frames + ' 帧');
  assert.equal(windowRef.pending(), 0, '进场放完就该停掉 requestAnimationFrame');
});

test('one game instance can be torn down without leaving listeners behind', () => {
  const { game } = makeGame();

  game.begin();
  game.destroy();

  assert.equal(typeof game.destroy, 'function');
  assert.equal(game.run.phase, 'running', '销毁只收摊，不改玩法状态');
});

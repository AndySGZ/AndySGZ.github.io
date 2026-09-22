import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameAudio, resolveMuted } from '../Jary/game-audio.js';

/* 这些用例都在 Node 里跑，所以要自己造出假的 window 与音频对象 */
const silentWindow = {};

function fakeStorage(stored, writes = []) {
  return {
    getItem: () => stored,
    setItem: (key, value) => writes.push([key, value]),
  };
}

class FakeAudio {
  constructor(calls) {
    this.calls = calls;
    this.src = '';
    this.loop = false;
    this.volume = 1;
    this.preload = 'none';
  }

  addEventListener() {}

  play() {
    this.calls.push('play');
    return Promise.resolve();
  }

  pause() {
    this.calls.push('pause');
  }
}

function makeAudio(stored, calls) {
  return createGameAudio({
    windowRef: silentWindow,
    storage: fakeStorage(stored),
    AudioCtor: function () { return new FakeAudio(calls); },
    AudioContextCtor: null,
  });
}

test('声音默认是开的，只有明确关过才是静音', () => {
  assert.equal(resolveMuted(null), false);
  assert.equal(resolveMuted(undefined), false);
  assert.equal(resolveMuted('on'), false);
  assert.equal(resolveMuted('off'), true);
  assert.equal(resolveMuted('0'), false);
});

test('静音开关会记进 localStorage，下次打开照旧', () => {
  const writes = [];
  const audio = createGameAudio({
    windowRef: silentWindow,
    storage: fakeStorage('off', writes),
    AudioCtor: null,
    AudioContextCtor: null,
  });

  assert.equal(audio.isMuted(), true, '上次静音过，这次打开就该是静音');

  assert.equal(audio.toggle(), false);
  assert.deepEqual(writes, [['jary-nailong-sound', 'on']]);

  assert.equal(audio.toggle(), true);
  assert.deepEqual(writes[1], ['jary-nailong-sound', 'off']);
});

test('静音状态下不会发出任何播放请求', () => {
  const calls = [];
  const audio = makeAudio('off', calls);

  audio.playTheme();
  audio.playLaugh();
  audio.playPickup();

  assert.deepEqual(calls, []);
});

test('开跑时播配乐，被抓住换成笑声并停掉配乐', () => {
  const calls = [];
  const audio = makeAudio('on', calls);

  audio.playTheme();
  assert.deepEqual(calls, ['play'], '配乐应该在用户手势后就开始播放');

  audio.pauseTheme();
  audio.playLaugh();
  assert.deepEqual(calls, ['play', 'pause', 'play'], '笑声要接在停掉配乐之后');

  audio.stopLaugh();
  assert.equal(calls[calls.length - 1], 'pause');
});

test('没有 AudioContext 时提示音安静地跳过，不影响游戏', () => {
  const calls = [];
  const audio = makeAudio('on', calls);

  audio.playPickup();

  assert.deepEqual(calls, [], '合成提示音不该顺手去碰配乐元素');
});

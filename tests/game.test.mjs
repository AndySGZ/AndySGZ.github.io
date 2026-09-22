import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIEW,
  beginRun,
  createRun,
  distanceOf,
  obstacleBox,
  pickObstacle,
  playerBox,
  requestJump,
  requestSlide,
  stepRun,
} from '../Jary/escape-nailong.js';

/* 和模块内部保持一致的固定步长；这些测试不碰画布，只验证玩法逻辑 */
const STEP = 1 / 120;

function runFor(run, seconds, hold = {}) {
  const steps = Math.round(seconds / STEP);
  const events = [];

  for (let index = 0; index < steps; index += 1) {
    events.push(...stepRun(run, STEP, hold));
  }

  return events;
}

function overlaps(box, target) {
  return box.right > target.left && box.left < target.right
    && box.bottom > target.top && box.top < target.bottom;
}

test('a fresh run waits for the player before anything moves', () => {
  const run = createRun({ seed: 7 });

  assert.equal(run.phase, 'ready');
  assert.deepEqual(stepRun(run, STEP), []);
  assert.equal(run.world, 0);
  assert.equal(distanceOf(run), 0);

  beginRun(run);
  assert.equal(run.phase, 'running');
});

test('the same seed lays out the same campus', () => {
  const first = beginRun(createRun({ seed: 2026 }));
  const second = beginRun(createRun({ seed: 2026 }));

  runFor(first, 6);
  runFor(second, 6);

  const shape = (run) => run.obstacles.map(({ type, x }) => [type, Math.round(x)]);
  assert.deepEqual(shape(first), shape(second));
  assert.ok(first.obstacles.length > 0, '应该已经生成障碍');
});

test('a jump lifts JARY and gravity brings him back down', () => {
  const run = beginRun(createRun({ seed: 3 }));
  assert.equal(requestJump(run), true, '第一次起跳应该成功');

  let peak = 0;
  for (let index = 0; index < 240; index += 1) {
    stepRun(run, STEP);
    peak = Math.min(peak, run.player.offsetY);
  }

  assert.ok(peak < -120, '跳跃高度应该超过 120px，实际 ' + peak.toFixed(1));
  assert.equal(run.player.offsetY, 0, '两秒后应该已经落地');
  assert.equal(run.player.jumps, 0, '落地后重新获得起跳次数');
});

test('only one extra jump is granted in mid-air', () => {
  const run = beginRun(createRun({ seed: 5 }));

  assert.equal(requestJump(run), true);
  stepRun(run, STEP);
  assert.equal(requestJump(run), true, '二段跳应该可用');
  assert.equal(requestJump(run), false, '第三次起跳应该被拒绝');
});

test('sliding is the only way under a paper plane', () => {
  const run = beginRun(createRun({ seed: 11 }));
  const plane = obstacleBox({ type: 'plane', x: run.world });

  assert.equal(overlaps(playerBox(run), plane), true, '站着会撞上纸飞机');

  run.player.slide = 0.4;
  assert.equal(overlaps(playerBox(run), plane), false, '滑铲可以钻过去');
});

test('hitting campus furniture costs ground against Nailong', () => {
  const run = beginRun(createRun({ seed: 17 }));
  run.chase = 300;
  run.obstacles = [{ type: 'books', x: run.world + 12, hit: false }];

  stepRun(run, STEP);

  assert.equal(run.hits, 1);
  assert.ok(run.chase < 300, '撞上之后距离应该变小，实际 ' + run.chase.toFixed(1));
  assert.equal(run.obstacles[0].hit, true, '同一个障碍不该重复扣分');
});

test('a red flower buys back some distance', () => {
  const run = beginRun(createRun({ seed: 19 }));
  const box = playerBox(run);
  run.chase = 100;
  run.obstacles = [];
  run.flowers = [{ x: run.world, y: (box.top + box.bottom) / 2, taken: false }];

  stepRun(run, STEP);

  assert.ok(run.chase > 100, '吃到小红花应该拉开距离，实际 ' + run.chase.toFixed(1));
});

test('the run ends the moment Nailong closes the gap', () => {
  const run = beginRun(createRun({ seed: 13 }));

  /* 先干净地跑两秒，分数才有意义 */
  run.chase = 440;
  runFor(run, 2);
  assert.equal(run.phase, 'running');
  assert.ok(distanceOf(run) > 0, '应该已经跑出一段距离');

  /* 把奶龙摆到贴脸的位置，再让 JARY 撞上课桌 */
  run.chase = 12;
  run.obstacles = [{ type: 'desk', x: run.world + 10, hit: false }];
  const events = runFor(run, 0.2);

  assert.equal(run.phase, 'over');
  assert.equal(run.chase, 0);
  assert.ok(events.some((event) => event.type === 'caught'));
});

test('sliding lasts a moment rather than forever', () => {
  const run = beginRun(createRun({ seed: 23 }));

  assert.equal(requestSlide(run), true);
  assert.ok(run.player.slide > 0);

  runFor(run, 1);
  assert.equal(run.player.slide, 0);
});

test('the playfield keeps its 960 × 420 logical size', () => {
  assert.deepEqual(VIEW, { width: 960, height: 420 });
});

/* ---------- 难度 ----------
   这几条盯的是「难度只许往上走」：速度得爬到接近上限、障碍之间的间隔
   得挤到一秒以内、连着撞三下必须被抓住。以后调平衡时如果越调越松，这里会红。 */

test('the pace climbs and the obstacles crowd in', () => {
  const run = beginRun(createRun({ seed: 31 }));
  const spawnTimes = [];
  const seen = new Set();

  for (let index = 0; index < Math.round(60 / STEP); index += 1) {
    run.chase = 440;             /* 测试里没有玩家，把奶龙按住才跑得完整段 */
    stepRun(run, STEP);
    for (const obstacle of run.obstacles) {
      if (seen.has(obstacle)) continue;
      seen.add(obstacle);
      spawnTimes.push(run.elapsed);
    }
    /* 全部挪走：撞上会僵直，僵直会拖慢世界，量出来的间隔就不是生成间隔了 */
    run.obstacles.length = 0;
  }

  assert.ok(run.speed > 880, '速度应该爬到接近上限，实际 ' + run.speed.toFixed(0));

  const gaps = spawnTimes.slice(1).map((time, index) => time - spawnTimes[index]);
  assert.ok(gaps.length > 30, '样本要够多，实际 ' + gaps.length);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  assert.ok(median < 1, '障碍之间平均不到一秒，实际中位数 ' + median.toFixed(2) + 's');
});

test('paper planes and benches crowd in as the run heats up', () => {
  const cold = createRun({ seed: 5 });
  const hot = createRun({ seed: 5 });
  hot.elapsed = 60;

  const planeShare = (run) => {
    let planes = 0;
    for (let index = 0; index < 4000; index += 1) {
      if (pickObstacle(run) === 'plane') planes += 1;
    }
    return planes / 4000;
  };

  const before = planeShare(cold);
  const after = planeShare(hot);

  assert.ok(after > before + 0.05,
    '纸飞机后半程应该更多：' + before.toFixed(3) + ' → ' + after.toFixed(3));
});

test('three stumbles in a row are enough for Nailong', () => {
  const run = beginRun(createRun({ seed: 41 }));
  let stumbles = 0;

  while (run.phase === 'running' && stumbles < 4) {
    run.obstacles = [{ type: 'books', x: run.world + 12, hit: false }];
    stepRun(run, STEP);
    stumbles += 1;
    run.player.stun = 0;         /* 抖掉僵直，让下一次判定立刻生效 */
    run.world += 40;             /* 往前挪一点，别让同一个障碍反复判 */
  }

  assert.equal(run.phase, 'over', '第三下就该被抓住');
  assert.equal(stumbles, 3);
});

test('beating the old best is flagged on the results card', () => {
  const run = beginRun(createRun({ seed: 43, best: 0 }));
  runFor(run, 3);

  run.chase = 12;
  run.obstacles = [{ type: 'desk', x: run.world + 10, hit: false }];
  stepRun(run, STEP);

  const meters = distanceOf(run);
  assert.equal(run.phase, 'over');
  assert.ok(meters > 0);
  assert.equal(run.record, true, '第一趟零纪录，跑出距离就该标新纪录');
  assert.equal(run.best, meters);

  /* 纪录高得多时就不该再喊新纪录 */
  const behind = beginRun(createRun({ seed: 43, best: 9999 }));
  behind.chase = 12;
  behind.obstacles = [{ type: 'desk', x: behind.world + 10, hit: false }];
  stepRun(behind, STEP);

  assert.equal(behind.phase, 'over');
  assert.equal(behind.record, false);
  assert.equal(behind.best, 9999);
});

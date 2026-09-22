/* ==========================================================================
   JARY 逃离奶龙 —— 2D 横版跑酷小游戏
   --------------------------------------------------------------------------
   设计要点：
   - 「逃离奶龙」的核心不是分数，而是距离：奶龙一直跟在 JARY 身后，
     撞到障碍会被拖慢、奶龙逼近；吃到小红花则重新拉开。奶龙追上 = 结束。
   - 模拟与绘制分离：stepRun() 是纯推进函数，没有浏览器也能单独验证
     （见 tests/game.test.mjs）；createGame() 只负责循环、输入与画布。
   - 所有图形用 Canvas 2D 现画（卡通校园风），默认不需要任何图片文件。
     想换成自己的立绘：把图放进 assets/game/，在 escape-nailong.html 里给
     <canvas> 写上 data-jary-sprite / data-nailong-sprite，页面会自动传给本模块。
   ========================================================================== */

/* ---------- 逻辑坐标系：960 × 420，绘制时整体缩放到画布 ---------- */
export const VIEW = { width: 960, height: 420 };

const GROUND_Y = 338;            /* 地面线（角色脚底的 y） */
const GRAVITY = 2500;            /* px/s² */
const JUMP_SPEED = 880;          /* 起跳初速度，跳跃高度约 155px */
const MAX_JUMPS = 2;             /* 允许二段跳 */
const SLIDE_TIME = 0.52;         /* 一次滑铲持续多久 */
const PLAYER_SCREEN_X = 268;     /* JARY 固定在画面上的横坐标 */
const PLAYER_WIDTH = 34;
const PLAYER_HEIGHT = 72;
const SLIDE_HEIGHT = 34;

const CHASE_START = 280;         /* 开局奶龙落后多少 px */
const CHASE_MAX = 440;
const HIT_PENALTY = 98;          /* 撞一次被追近多少：连着撞三下就被抓住 */
const FLOWER_BONUS = 52;         /* 吃到小红花拉开多少 */
const CHASE_REGEN = 8;           /* 无失误时每秒自然拉开多少 */

const BASE_SPEED = 360;          /* 起始速度 px/s */
const MAX_SPEED = 900;
const SPEED_GAIN = 15;           /* 每秒提速，约 36 秒到顶 */

const OVER_ENTER = 0.42;         /* 结束卡片进场动画用多久（秒） */

const STEP = 1 / 120;            /* 固定步长，保证物理稳定 */
const METERS_PER_PIXEL = 1 / 24;

/* 障碍：校园里随处可见的东西。lift 是离地高度，>0 表示要从下面滑过去 */
const OBSTACLE_TYPES = {
  desk: { name: '课桌', width: 68, height: 50, lift: 0 },
  books: { name: '书堆', width: 50, height: 58, lift: 0 },
  bin: { name: '垃圾桶', width: 48, height: 62, lift: 0 },
  cone: { name: '路障', width: 40, height: 44, lift: 0 },
  bench: { name: '长凳', width: 96, height: 40, lift: 0 },
  plane: { name: '纸飞机', width: 64, height: 32, lift: 46 },
};
const OBSTACLE_ORDER = ['desk', 'books', 'bin', 'cone', 'bench', 'plane'];

/* 越跑越热：纸飞机与长凳变多，最好躲的路障变少 */
const OBSTACLE_WEIGHTS = { desk: 1.15, books: 1, bin: 1, cone: 0.8, bench: 0.9, plane: 0.55 };
const OBSTACLE_HEAT = 0.6;       /* 45 秒内纸飞机的权重涨这么多 */

/* 画面上的文字跟着期刊的双语开关走（读取 <html> 的当前语言） */
const LABELS = {
  zh: {
    title: 'JARY 逃离奶龙',
    subtitle: '2D 横版跑酷 · 卡通校园',
    ready: '点「开始」或按空格起跑',
    keys: '空格 / ↑ 起跳（可二段跳）· ↓ 滑铲 · P 暂停',
    paused: '已暂停',
    over: '被奶龙抓住了！',
    record: '新纪录！',
    again: '按 R 或点「重新开始」再来一次',
    distance: '距离',
    best: '最好',
    chase: '与奶龙的距离',
  },
  en: {
    title: 'JARY Escapes Nailong',
    subtitle: '2D side-scrolling runner / cartoon campus',
    ready: 'Press Start or hit Space',
    keys: 'Space / Up jump (double jump) · Down slide · P pause',
    paused: 'Paused',
    over: 'Nailong caught JARY!',
    record: 'NEW BEST!',
    again: 'Press R or Restart to run again',
    distance: 'Distance',
    best: 'Best',
    chase: 'Gap to Nailong',
  },
};

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/* ---------- 可复现的随机数（mulberry32），便于测试与复现 ---------- */
export function createRng(seed = 1) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(options = {}) {
  return {
    random: createRng(options.seed ?? 20260921),
    phase: 'ready',              /* ready | running | paused | over */
    elapsed: 0,
    world: 0,                    /* JARY 跑过的总距离（世界坐标 px） */
    speed: BASE_SPEED,
    camera: 0,                   /* 画面左边缘对应的世界坐标 */
    player: { offsetY: 0, velocityY: 0, jumps: 0, slide: 0, stun: 0, runPhase: 0 },
    chase: CHASE_START,
    obstacles: [],
    flowers: [],
    nextSpawn: 780,
    nextFlower: 900,
    shake: 0,
    hits: 0,
    record: false,               /* 这一趟是否刷新了纪录（结束时才知道） */
    best: Math.max(0, Math.floor(Number(options.best) || 0)),
  };
}

export function resetRun(run, options = {}) {
  const best = run.best;
  const seed = options.seed ?? Math.floor(Math.random() * 0x7fffffff);
  Object.assign(run, createRun({ seed, best }));
  return run;
}

export function beginRun(run) {
  if (run.phase === 'over') resetRun(run);
  if (run.phase !== 'running') run.phase = 'running';
  return run;
}

export function distanceOf(run) {
  return Math.floor(run.world * METERS_PER_PIXEL);
}

export function playerBox(run) {
  const height = run.player.slide > 0 ? SLIDE_HEIGHT : PLAYER_HEIGHT;
  return {
    left: run.world - PLAYER_WIDTH / 2,
    right: run.world + PLAYER_WIDTH / 2,
    top: GROUND_Y + run.player.offsetY - height,
    bottom: GROUND_Y + run.player.offsetY,
  };
}

export function obstacleBox(obstacle) {
  const spec = OBSTACLE_TYPES[obstacle.type] ?? OBSTACLE_TYPES.desk;
  const bottom = GROUND_Y - spec.lift;
  return {
    left: obstacle.x - spec.width / 2,
    right: obstacle.x + spec.width / 2,
    top: bottom - spec.height,
    bottom,
  };
}

export function requestJump(run) {
  if (run.phase !== 'running') return false;

  const player = run.player;
  if (player.jumps >= MAX_JUMPS) return false;

  player.jumps += 1;
  player.velocityY = -JUMP_SPEED * (player.jumps > 1 ? 0.86 : 1);
  player.slide = 0;
  return true;
}

export function requestSlide(run) {
  if (run.phase !== 'running') return false;

  const player = run.player;
  player.slide = SLIDE_TIME;
  /* 空中按下滑铲：顺势砸向地面，落地更干脆 */
  if (player.offsetY < 0) player.velocityY = Math.max(player.velocityY, 620);
  return true;
}

/* 按权重抽障碍：权重随已跑时间漂移，越到后面越不客气。
   整个抽取只消耗一个随机数，换难度也不会打乱随机序列的长度。 */
export function pickObstacle(run) {
  const heat = clamp(run.elapsed / 45, 0, 1);
  let total = 0;

  const weights = OBSTACLE_ORDER.map((type) => {
    let weight = OBSTACLE_WEIGHTS[type];
    if (type === 'plane') weight += heat * OBSTACLE_HEAT;
    else if (type === 'bench') weight += heat * OBSTACLE_HEAT * 0.6;
    else if (type === 'cone') weight -= heat * OBSTACLE_HEAT * 0.5;
    total += Math.max(0.08, weight);
    return Math.max(0.08, weight);
  });

  let roll = run.random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return OBSTACLE_ORDER[index];
  }
  return OBSTACLE_ORDER[OBSTACLE_ORDER.length - 1];
}

function spawnObstacle(run) {
  run.obstacles.push({ type: pickObstacle(run), x: run.nextSpawn, hit: false });

  /* 间距必须留得下「跳一次再落地」：速度越快，间距越远。
     但换算成时间就固定了——0.66~1.08 秒来一个，比早期版本挤了两成。 */
  const factor = 0.66 + run.random() * 0.42;
  run.nextSpawn += Math.max(220, run.speed * factor);
}

function spawnFlower(run) {
  const lifted = run.random() < 0.55;
  const height = lifted ? 96 + run.random() * 46 : 22;

  /* 小红花不能长在障碍物身上，撞上了会误判成失误 */
  let x = run.nextFlower;
  for (const obstacle of run.obstacles) {
    const spec = OBSTACLE_TYPES[obstacle.type];
    if (Math.abs(obstacle.x - x) < spec.width / 2 + 60) x = obstacle.x + spec.width / 2 + 74;
  }

  run.flowers.push({ x, y: GROUND_Y - 22 - height, taken: false });
  run.nextFlower = x + 640 + run.random() * 660;
}

/* ---------- 推进一步（按固定步长调用，输入只有「是否按住滑铲」） ---------- */
export function stepRun(run, dt, hold = {}) {
  if (run.phase !== 'running') return [];

  const events = [];
  const player = run.player;

  run.elapsed += dt;
  run.speed = Math.min(MAX_SPEED, BASE_SPEED + run.elapsed * SPEED_GAIN);

  const stunned = player.stun > 0;
  if (stunned) player.stun = Math.max(0, player.stun - dt);
  if (hold.slide) requestSlide(run);
  player.slide = Math.max(0, player.slide - dt);

  /* 竖直方向：重力 + 落地 */
  player.velocityY += GRAVITY * dt;
  player.offsetY = Math.min(0, player.offsetY + player.velocityY * dt);
  if (player.offsetY >= 0) {
    player.offsetY = 0;
    player.velocityY = 0;
    player.jumps = 0;
  }

  /* 水平方向：被撞到会明显掉速，这正是奶龙逼近的原因 */
  const advance = run.speed * (stunned ? 0.42 : 1) * dt;
  run.world += advance;
  run.camera = run.world - PLAYER_SCREEN_X;
  player.runPhase += dt * (stunned ? 4 : 11);

  /* 跑得干净时奶龙会被慢慢拉开 */
  if (!stunned) run.chase = Math.min(CHASE_MAX, run.chase + CHASE_REGEN * dt);

  while (run.nextSpawn < run.camera + VIEW.width + 420) spawnObstacle(run);
  while (run.nextFlower < run.camera + VIEW.width + 420) spawnFlower(run);

  /* 碰撞判定 */
  const box = playerBox(run);

  for (const obstacle of run.obstacles) {
    if (obstacle.hit) continue;
    const target = obstacleBox(obstacle);
    const overlap = box.right > target.left && box.left < target.right
      && box.bottom > target.top && box.top < target.bottom;
    if (!overlap) continue;

    obstacle.hit = true;
    run.hits += 1;
    player.stun = 0.42;
    run.chase -= HIT_PENALTY;
    run.shake = 14;
    events.push({ type: 'hit' });
  }

  for (const flower of run.flowers) {
    if (flower.taken) continue;
    const dx = clamp(flower.x, box.left, box.right) - flower.x;
    const dy = clamp(flower.y, box.top, box.bottom) - flower.y;
    if (dx * dx + dy * dy > 20 * 20) continue;

    flower.taken = true;
    run.chase = Math.min(CHASE_MAX, run.chase + FLOWER_BONUS);
    events.push({ type: 'flower' });
  }

  run.obstacles = run.obstacles.filter((obstacle) => obstacle.x > run.camera - 240);
  run.flowers = run.flowers.filter((flower) => !flower.taken && flower.x > run.camera - 240);
  run.shake = Math.max(0, run.shake - dt * 46);

  run.chase = clamp(run.chase, 0, CHASE_MAX);
  if (run.chase <= 0) {
    const meters = distanceOf(run);
    run.record = meters > run.best;
    run.best = Math.max(run.best, meters);
    run.phase = 'over';
    events.push({ type: 'caught' });
  }

  return events;
}

/* ==========================================================================
   绘制：校园场景分四层视差，越远动得越慢
   ========================================================================== */

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function limb(ctx, x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawCloud(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.arc(26, 7, 20, 0, Math.PI * 2);
  ctx.arc(-27, 8, 18, 0, Math.PI * 2);
  ctx.arc(4, -14, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSky(ctx, run, reducedMotion) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, '#a8dbff');
  gradient.addColorStop(0.62, '#dcf1ff');
  gradient.addColorStop(1, '#f4fbff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  /* 太阳 */
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.arc(838, 70, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 198, 78, 0.5)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(838, 70, 48, 0, Math.PI * 2);
  ctx.stroke();

  /* 云是视差最慢的一层，横向循环铺满 */
  const drift = reducedMotion ? 0 : run.camera * 0.06;
  const span = VIEW.width + 340;
  const seeds = [[120, 66, 1], [470, 42, 0.78], [770, 104, 0.9]];
  for (const seed of seeds) {
    const x = ((seed[0] - drift) % span + span) % span - 170;
    drawCloud(ctx, x, seed[1], seed[2]);
  }
}

function drawSchoolBuilding(ctx, x, baseY) {
  const width = 300;
  const height = 150;
  const top = baseY - height;

  ctx.fillStyle = '#fff3e2';
  ctx.strokeStyle = '#e2bd94';
  ctx.lineWidth = 2;
  roundRect(ctx, x, top, width, height, 10);
  ctx.fill();
  ctx.stroke();

  /* 红屋顶 */
  ctx.fillStyle = '#d05a45';
  ctx.beginPath();
  ctx.moveTo(x - 14, top + 8);
  ctx.lineTo(x + width / 2, top - 42);
  ctx.lineTo(x + width + 14, top + 8);
  ctx.closePath();
  ctx.fill();

  /* 窗户 */
  ctx.fillStyle = '#a9d9f2';
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      roundRect(ctx, x + 22 + col * 54, top + 30 + row * 34, 36, 22, 5);
      ctx.fill();
    }
  }

  /* 大门 */
  ctx.fillStyle = '#a9714a';
  roundRect(ctx, x + width / 2 - 24, baseY - 50, 48, 50, 8);
  ctx.fill();

  /* 升旗台与红旗 */
  ctx.strokeStyle = '#cfd6dd';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + width + 52, baseY);
  ctx.lineTo(x + width + 52, baseY - 136);
  ctx.stroke();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(x + width + 52, baseY - 136);
  ctx.lineTo(x + width + 108, baseY - 124);
  ctx.lineTo(x + width + 52, baseY - 110);
  ctx.closePath();
  ctx.fill();
}

function drawTree(ctx, x, baseY, scale) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#b3814f';
  roundRect(ctx, -6, -46, 12, 46, 4);
  ctx.fill();

  ctx.fillStyle = '#8ed07a';
  ctx.beginPath();
  ctx.arc(0, -62, 30, 0, Math.PI * 2);
  ctx.arc(-22, -48, 19, 0, Math.PI * 2);
  ctx.arc(22, -48, 19, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.arc(-8, -70, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCampus(ctx, run) {
  const shift = run.camera * 0.24;
  const period = 560;
  const first = Math.floor((shift - period) / period);
  const last = Math.ceil((shift + VIEW.width + period) / period);

  for (let index = first; index <= last; index += 1) {
    const x = index * period - shift;
    drawSchoolBuilding(ctx, x, GROUND_Y + 8);
    drawTree(ctx, x + 330, GROUND_Y + 8, 0.92 + ((index % 3) * 0.08));
  }
}

function drawFence(ctx, x, baseY, width) {
  ctx.strokeStyle = '#ccd6e0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, baseY - 76);
  ctx.lineTo(x + width, baseY - 76);
  ctx.moveTo(x, baseY - 42);
  ctx.lineTo(x + width, baseY - 42);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let bar = x; bar <= x + width; bar += 20) {
    ctx.moveTo(bar, baseY - 78);
    ctx.lineTo(bar, baseY);
  }
  ctx.stroke();
}

function drawHoop(ctx, x, baseY) {
  ctx.strokeStyle = '#9aa7b4';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - 152);
  ctx.stroke();

  ctx.fillStyle = '#fbfbf9';
  ctx.strokeStyle = '#c9d2da';
  ctx.lineWidth = 3;
  roundRect(ctx, x - 34, baseY - 192, 62, 44, 6);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#e2673f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 22, baseY - 148);
  ctx.lineTo(x + 18, baseY - 148);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 20, baseY - 144);
  ctx.lineTo(x + 16, baseY - 144);
  ctx.lineTo(x - 2, baseY - 118);
  ctx.closePath();
  ctx.stroke();
}

function drawBush(ctx, x, baseY, scale) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#79c169';
  ctx.beginPath();
  ctx.arc(0, -14, 20, 0, Math.PI * 2);
  ctx.arc(-20, -8, 15, 0, Math.PI * 2);
  ctx.arc(20, -8, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* 中景：围墙、篮球架、灌木丛 —— 比教学楼快，比跑道慢 */
function drawPlayground(ctx, run) {
  const shift = run.camera * 0.55;
  const period = 380;
  const first = Math.floor((shift - period) / period);
  const last = Math.ceil((shift + VIEW.width + period) / period);

  for (let index = first; index <= last; index += 1) {
    const x = index * period - shift;
    drawFence(ctx, x, GROUND_Y + 8, period - 24);
    if (index % 2 === 0) drawHoop(ctx, x + 128, GROUND_Y + 8);
    drawBush(ctx, x + 272, GROUND_Y + 8, 0.9 + ((index % 3) * 0.12));
  }
}

function drawGrassTuft(ctx, x, baseY) {
  ctx.strokeStyle = '#5aa74f';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x - 7, baseY - 13);
  ctx.moveTo(x, baseY);
  ctx.lineTo(x + 1, baseY - 17);
  ctx.moveTo(x, baseY);
  ctx.lineTo(x + 8, baseY - 12);
  ctx.stroke();
}

/* 近景：塑胶跑道（视差 1，和角色同速） */
function drawGround(ctx, run) {
  ctx.fillStyle = '#7cc46e';
  ctx.fillRect(0, GROUND_Y, VIEW.width, 15);
  ctx.fillStyle = '#d9755c';
  ctx.fillRect(0, GROUND_Y + 15, VIEW.width, VIEW.height - GROUND_Y - 15);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 22]);
  ctx.lineDashOffset = run.camera % 48;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 46);
  ctx.lineTo(VIEW.width, GROUND_Y + 46);
  ctx.stroke();
  ctx.setLineDash([]);

  const shift = run.camera % 160;
  for (let x = -shift; x < VIEW.width + 160; x += 160) {
    drawGrassTuft(ctx, x, GROUND_Y);
  }
}

function drawFlower(ctx, flower, run) {
  const bob = Math.sin(run.elapsed * 4 + flower.x * 0.02) * 3;
  ctx.save();
  ctx.translate(flower.x - run.camera, flower.y + bob);

  ctx.fillStyle = 'rgba(255, 214, 102, 0.4)';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ee5a6f';
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = (petal / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 8, Math.sin(angle) * 8, 6.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawObstacle(ctx, obstacle, camera) {
  const spec = OBSTACLE_TYPES[obstacle.type];
  const x = obstacle.x - camera;
  if (x < -160 || x > VIEW.width + 160) return;

  const left = x - spec.width / 2;
  const bottom = GROUND_Y - spec.lift;
  const top = bottom - spec.height;
  const width = spec.width;

  ctx.save();
  if (obstacle.hit) ctx.globalAlpha = 0.75;

  if (obstacle.type === 'desk') {
    ctx.fillStyle = '#c9855a';
    roundRect(ctx, left, top, width, 13, 5);
    ctx.fill();
    ctx.fillStyle = '#e8b98f';
    roundRect(ctx, left + 16, top + 15, width - 32, 11, 4);
    ctx.fill();
    ctx.fillStyle = '#a86a44';
    roundRect(ctx, left + 5, top + 15, 9, spec.height - 15, 3);
    ctx.fill();
    roundRect(ctx, left + width - 14, top + 15, 9, spec.height - 15, 3);
    ctx.fill();
  } else if (obstacle.type === 'books') {
    const colors = ['#e05c5c', '#4c8df5', '#f2b544'];
    let y = bottom;
    for (let index = 0; index < colors.length; index += 1) {
      const height = 20 - index * 2;
      y -= height;
      ctx.fillStyle = colors[index];
      roundRect(ctx, left + index * 4, y, width - index * 8, height - 3, 4);
      ctx.fill();
    }
  } else if (obstacle.type === 'bin') {
    ctx.fillStyle = '#8fa3b0';
    roundRect(ctx, left + 4, top + 11, width - 8, spec.height - 11, 8);
    ctx.fill();
    ctx.fillStyle = '#6f8593';
    roundRect(ctx, left, top, width, 13, 6);
    ctx.fill();
    ctx.strokeStyle = '#6f8593';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(left + width / 2, top + 3, 8, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(left + 14, bottom - 30);
    ctx.lineTo(left + width - 14, bottom - 30);
    ctx.moveTo(left + 17, bottom - 20);
    ctx.lineTo(left + width - 17, bottom - 20);
    ctx.stroke();
  } else if (obstacle.type === 'cone') {
    ctx.fillStyle = '#f2762f';
    ctx.beginPath();
    ctx.moveTo(left + width / 2, top);
    ctx.lineTo(left + width, bottom - 7);
    ctx.lineTo(left, bottom - 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fdf6ee';
    ctx.beginPath();
    ctx.moveTo(left + 12, bottom - 26);
    ctx.lineTo(left + width - 12, bottom - 26);
    ctx.lineTo(left + width - 8, bottom - 17);
    ctx.lineTo(left + 8, bottom - 17);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0651f';
    roundRect(ctx, left - 3, bottom - 9, width + 6, 9, 4);
    ctx.fill();
  } else if (obstacle.type === 'bench') {
    ctx.fillStyle = '#c58b52';
    roundRect(ctx, left, top, width, 13, 5);
    ctx.fill();
    ctx.fillStyle = '#a86f3c';
    roundRect(ctx, left + 6, top + 15, width - 12, 9, 4);
    ctx.fill();
    ctx.fillStyle = '#8a5a30';
    roundRect(ctx, left + 9, bottom - 20, 10, 20, 3);
    ctx.fill();
    roundRect(ctx, left + width - 19, bottom - 20, 10, 20, 3);
    ctx.fill();
  } else {
    /* 纸飞机：贴着地面飞过来，只能滑铲躲开 */
    const cy = bottom - spec.height / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#a9c3d6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, cy);
    ctx.lineTo(left + width, top);
    ctx.lineTo(left + width - 30, cy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(left, cy);
    ctx.lineTo(left + width - 30, cy + 3);
    ctx.lineTo(left + width - 34, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(left + width + 6, cy + 4);
    ctx.lineTo(left + width + 44, cy + 12);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/* ---------- 角色 ---------- */

function drawJaryRunning(ctx, player, reducedMotion) {
  const airborne = player.offsetY < -1;
  const swing = airborne ? 0.6 : Math.sin(player.runPhase * 1.6);
  const bounce = airborne || reducedMotion ? 0 : Math.abs(Math.sin(player.runPhase * 1.6)) * 2;

  ctx.save();
  ctx.translate(0, -bounce);

  /* 腿 */
  limb(ctx, -2, -28, swing * 13, 0, 9, '#3b4a66');
  limb(ctx, 2, -28, -swing * 13, 0, 9, '#2c3950');

  /* 书包 */
  ctx.fillStyle = '#3f7bd6';
  roundRect(ctx, -21, -50, 13, 22, 5);
  ctx.fill();

  /* 校服上衣 */
  ctx.fillStyle = '#fdfdff';
  ctx.strokeStyle = '#cdd7e4';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -11, -52, 23, 26, 9);
  ctx.fill();
  ctx.stroke();

  /* 红领巾（呼应期刊的深红） */
  ctx.fillStyle = '#a6192e';
  ctx.beginPath();
  ctx.moveTo(-8, -50);
  ctx.lineTo(9, -50);
  ctx.lineTo(0, -37);
  ctx.closePath();
  ctx.fill();

  /* 手臂 */
  limb(ctx, 1, -47, -swing * 15, -35, 7, '#eec39f');
  limb(ctx, 1, -47, swing * 15, -33, 7, '#f6d3b4');

  /* 头与头发 */
  ctx.fillStyle = '#f6d3b4';
  ctx.beginPath();
  ctx.arc(1, -64, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f2a2b';
  ctx.beginPath();
  ctx.arc(1, -66, 12.4, Math.PI * 1.02, Math.PI * 2.05);
  ctx.fill();

  /* 眼睛；跳起来时张嘴，表情更明显 */
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(7, -64, 1.9, 0, Math.PI * 2);
  ctx.fill();
  if (airborne) {
    ctx.strokeStyle = '#b0634b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8, -57.5, 3.6, 0, Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

function drawJarySliding(ctx) {
  ctx.fillStyle = '#fdfdff';
  ctx.strokeStyle = '#cdd7e4';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -22, -32, 40, 23, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#a6192e';
  ctx.beginPath();
  ctx.moveTo(-8, -32);
  ctx.lineTo(4, -32);
  ctx.lineTo(-2, -21);
  ctx.closePath();
  ctx.fill();

  limb(ctx, -18, -14, -36, -3, 9, '#3b4a66');
  limb(ctx, -10, -14, -24, -2, 9, '#2c3950');

  ctx.fillStyle = '#f6d3b4';
  ctx.beginPath();
  ctx.arc(16, -36, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f2a2b';
  ctx.beginPath();
  ctx.arc(16, -38, 12.4, Math.PI * 1.02, Math.PI * 2.05);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(21, -36, 1.9, 0, Math.PI * 2);
  ctx.fill();
}

/* 立绘按原始长宽比缩放到目标高度：换任何图都不会被拉变形 */
function spriteBox(image, height, maxWidth) {
  const ratio = (image.naturalWidth || image.width || 1) / (image.naturalHeight || image.height || 1);
  const width = height * ratio;
  if (width <= maxWidth) return { width: width, height: height };
  return { width: maxWidth, height: maxWidth / ratio };
}

function drawRunner(ctx, run, sprite, reducedMotion) {
  const player = run.player;
  const feetY = GROUND_Y + player.offsetY;
  const sliding = player.slide > 0;

  /* 影子：离地越高越小越淡 */
  const lift = clamp(-player.offsetY / 155, 0, 1);
  ctx.fillStyle = 'rgba(58, 74, 52, ' + (0.22 * (1 - lift * 0.7)).toFixed(3) + ')';
  ctx.beginPath();
  ctx.ellipse(PLAYER_SCREEN_X, GROUND_Y + 4, 22 * (1 - lift * 0.35), 6 * (1 - lift * 0.35), 0, 0, Math.PI * 2);
  ctx.fill();

  if (sprite) {
    /* 滑铲时整体压低一截，而不是把图压扁 */
    const box = spriteBox(sprite, sliding ? 62 : 104, 170);
    const left = PLAYER_SCREEN_X - box.width / 2;
    const top = feetY - box.height;
    ctx.save();
    roundRect(ctx, left, top, box.width, box.height, 14);
    ctx.clip();
    ctx.drawImage(sprite, left, top, box.width, box.height);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(PLAYER_SCREEN_X, feetY);
  if (sliding) drawJarySliding(ctx);
  else drawJaryRunning(ctx, player, reducedMotion);
  ctx.restore();
}

function drawNailong(ctx, screenX, feetY, runPhase) {
  const swing = Math.sin(runPhase * 1.6);

  ctx.save();
  ctx.translate(screenX, feetY);

  limb(ctx, -3, -18, (-3) + swing * 12, 0, 10, '#e3aa3d');
  limb(ctx, 5, -18, 5 - swing * 12, 0, 10, '#cf9526');

  /* 尾巴 */
  ctx.fillStyle = '#efc94f';
  ctx.beginPath();
  ctx.moveTo(-24, -42);
  ctx.quadraticCurveTo(-48, -50, -46, -26);
  ctx.quadraticCurveTo(-34, -34, -22, -28);
  ctx.closePath();
  ctx.fill();

  /* 圆滚滚的身体 */
  ctx.fillStyle = '#f9dd6c';
  ctx.beginPath();
  ctx.ellipse(0, -40, 27, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fdf3c4';
  ctx.beginPath();
  ctx.ellipse(4, -34, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  /* 手臂 */
  limb(ctx, -14, -48, (-14) + swing * 10, -58, 9, '#f0c94f');
  limb(ctx, 14, -52, 14 - swing * 12, -62, 9, '#e8bd42');

  /* 头 */
  ctx.fillStyle = '#fbdf70';
  ctx.beginPath();
  ctx.ellipse(11, -66, 21, 19, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fceaa0';
  ctx.beginPath();
  ctx.ellipse(25, -60, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  /* 绿圈大眼，是奶龙最好认的特征 */
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(19, -72, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.arc(19, -72, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(20.5, -72, 3.8, 0, Math.PI * 2);
  ctx.fill();

  /* 嘴 */
  ctx.strokeStyle = '#b98a2b';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(29, -62, 6, Math.PI * 0.15, Math.PI * 0.8);
  ctx.stroke();

  ctx.restore();
}

function drawChaser(ctx, run, sprite) {
  const screenX = PLAYER_SCREEN_X - run.chase;
  const feetY = GROUND_Y;

  ctx.fillStyle = 'rgba(58, 74, 52, 0.2)';
  ctx.beginPath();
  ctx.ellipse(screenX, GROUND_Y + 4, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (sprite) {
    const box = spriteBox(sprite, 96, 190);
    const left = screenX - box.width / 2;
    const top = feetY - box.height;
    ctx.save();
    roundRect(ctx, left, top, box.width, box.height, 14);
    ctx.clip();
    ctx.drawImage(sprite, left, top, box.width, box.height);
    ctx.restore();
    return;
  }

  drawNailong(ctx, screenX, feetY, run.elapsed * 11);

  /* 快到跟前时冒出「怒气」小符号，不用盯着进度条也知道危险 */
  if (run.chase < 120) {
    ctx.fillStyle = '#d6453b';
    ctx.font = 'bold 20px "PingFang SC", Arial, sans-serif';
    ctx.fillText('!', screenX + 30, feetY - 96);
  }
}

/* ---------- 界面 ---------- */

const UI_FONT = '"PingFang SC", "Microsoft YaHei", Arial, sans-serif';
const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function drawHud(ctx, run, labels) {
  const meters = distanceOf(run);

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.strokeStyle = 'rgba(23, 23, 23, 0.14)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 18, 16, 180, 56, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#6b6b6b';
  ctx.font = '600 13px ' + UI_FONT;
  ctx.fillText(labels.distance, 34, 39);
  ctx.fillText(labels.best, 122, 39);

  ctx.fillStyle = '#171717';
  ctx.font = 'bold 22px ' + MONO_FONT;
  ctx.fillText(String(meters), 34, 63);
  ctx.fillText(String(run.best), 122, 63);

  /* 追逐条：越短说明奶龙越近 */
  const barWidth = 236;
  const barX = VIEW.width - barWidth - 26;
  const ratio = clamp(run.chase / CHASE_MAX, 0, 1);

  ctx.fillStyle = 'rgba(23, 23, 23, 0.1)';
  roundRect(ctx, barX, 26, barWidth, 12, 6);
  ctx.fill();

  ctx.fillStyle = ratio < 0.34 ? '#d6453b' : ratio < 0.66 ? '#e39a2b' : '#4aa863';
  roundRect(ctx, barX, 26, Math.max(8, barWidth * ratio), 12, 6);
  ctx.fill();

  ctx.fillStyle = '#6b6b6b';
  ctx.font = '600 12px ' + UI_FONT;
  ctx.fillText(labels.chase, barX, 56);
  ctx.restore();
}

/* 结束卡片：左边是捧腹大笑的奶龙，右边是这一趟的成绩。
   那张立绘本来就是白底，放在白卡片上不用抠图，边缘自然融进去。 */
function drawResultCard(ctx, run, labels, view) {
  const laugh = view?.laugh ?? null;
  const enter = view?.enter ?? 1;

  const cardWidth = 596;
  const cardHeight = 304;
  const cardX = (VIEW.width - cardWidth) / 2;
  const cardY = (VIEW.height - cardHeight) / 2;
  const pad = 20;

  ctx.save();
  ctx.globalAlpha = enter;
  /* 从画面中心稍微放大着弹进来 */
  const growth = 0.86 + 0.14 * enter;
  ctx.translate(VIEW.width / 2, VIEW.height / 2);
  ctx.scale(growth, growth);
  ctx.translate(-VIEW.width / 2, -VIEW.height / 2);

  ctx.shadowColor = 'rgba(15, 15, 15, 0.42)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 20);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = 'rgba(23, 23, 23, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  let textLeft = VIEW.width / 2;
  ctx.textAlign = 'center';

  if (laugh) {
    const artHeight = cardHeight - pad * 2;
    const box = spriteBox(laugh, artHeight, 176);
    const artX = cardX + pad;
    const artY = cardY + (cardHeight - box.height) / 2;
    ctx.drawImage(laugh, artX, artY, box.width, box.height);

    textLeft = artX + box.width + 24;
    ctx.textAlign = 'left';
  }

  const titleY = cardY + 86;
  ctx.fillStyle = '#a6192e';
  ctx.font = 'bold 30px ' + UI_FONT;
  ctx.fillText(labels.over, textLeft, titleY);

  const metersText = distanceOf(run) + ' m';
  const metersY = cardY + 158;
  ctx.fillStyle = '#171717';
  ctx.font = 'bold 46px ' + MONO_FONT;
  ctx.fillText(metersText, textLeft, metersY);

  /* 破了纪录就在成绩右边挂一个小红字，不另起一行 */
  if (run.record) {
    const used = ctx.measureText(metersText).width;
    ctx.fillStyle = '#d6453b';
    ctx.font = '700 15px ' + UI_FONT;
    ctx.fillText(labels.record, textLeft + used + 14, metersY);
  }

  ctx.fillStyle = '#6b6b6b';
  ctx.font = '600 17px ' + UI_FONT;
  ctx.fillText(labels.best + '：' + run.best + ' m', textLeft, cardY + 200);

  ctx.fillStyle = '#8a8a8a';
  ctx.font = '600 15px ' + UI_FONT;
  ctx.fillText(labels.again, textLeft, cardY + 242);

  ctx.restore();
}

function drawOverlay(ctx, run, labels, view) {
  if (run.phase === 'running') return;

  const enter = view?.enter ?? 1;

  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = 'rgba(23, 23, 23, 0.5)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';

  if (run.phase === 'over') {
    drawResultCard(ctx, run, labels, view);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px ' + UI_FONT;
    ctx.fillText(labels.title, VIEW.width / 2, 168);

    ctx.fillStyle = '#ffe08a';
    ctx.font = '600 18px ' + UI_FONT;
    ctx.fillText(run.phase === 'paused' ? labels.paused : labels.ready, VIEW.width / 2, 216);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.font = '600 15px ' + UI_FONT;
    ctx.fillText(labels.keys, VIEW.width / 2, 250);
    ctx.fillText(labels.subtitle, VIEW.width / 2, 280);
  }

  ctx.restore();
}

/* ==========================================================================
   createGame：把模拟接到画布、键盘与按钮上
   ========================================================================== */
export function createGame(canvas, options = {}) {
  const context = canvas?.getContext?.('2d');
  if (!context) return null;

  const windowRef = options.windowRef ?? window;
  const documentRef = options.documentRef ?? (typeof document !== 'undefined' ? document : null);
  const reducedMotion = options.reducedMotion
    ?? windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ?? false;
  const pixelRatio = Math.min(options.pixelRatio ?? windowRef.devicePixelRatio ?? 1, 2);
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : function () {};

  const run = createRun({ seed: options.seed, best: options.best });
  const sprites = { jary: null, nailong: null, laugh: null };
  const hold = { slide: false };

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let frameId = 0;
  let lastTime = 0;
  let accumulator = 0;
  let overTime = 0;                /* 结束卡片进场走了多久 */

  function currentLabels() {
    const language = options.language ?? documentRef?.documentElement?.lang ?? 'zh';
    return String(language).toLowerCase().indexOf('zh') === 0 ? LABELS.zh : LABELS.en;
  }

  function handleEvent(event) {
    onEvent({
      type: event.type,
      phase: run.phase,
      distance: distanceOf(run),
      best: run.best,
      chase: run.chase,
      hits: run.hits,
    });
  }

  /* ---------- 画面 ---------- */
  /* 结束卡片的进场进度：0 → 1；开了「减少动态效果」就直接到位 */
  function enterProgress() {
    if (reducedMotion) return 1;
    return clamp(overTime / OVER_ENTER, 0, 1);
  }

  function render() {
    const labels = currentLabels();

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(offsetX, offsetY);
    context.scale(scale, scale);

    context.save();
    context.beginPath();
    context.rect(0, 0, VIEW.width, VIEW.height);
    context.clip();
    /* 撞击抖动只作用于场景，不牵动 HUD */
    if (!reducedMotion && run.shake > 0.2) {
      context.translate(
        Math.sin(run.elapsed * 62) * run.shake * 0.4,
        Math.cos(run.elapsed * 51) * run.shake * 0.3
      );
    }

    drawSky(context, run, reducedMotion);
    drawCampus(context, run);
    drawPlayground(context, run);
    drawGround(context, run);
    for (const flower of run.flowers) drawFlower(context, flower, run);
    for (const obstacle of run.obstacles) drawObstacle(context, obstacle, run.camera);
    drawChaser(context, run, sprites.nailong);
    drawRunner(context, run, sprites.jary, reducedMotion);

    context.restore();

    drawHud(context, run, labels);
    drawOverlay(context, run, labels, { laugh: sprites.laugh, enter: enterProgress() });
    context.restore();
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const cssWidth = Math.max(320, Math.round(bounds.width || VIEW.width));
    const cssHeight = Math.max(160, Math.round(bounds.height || (cssWidth * VIEW.height / VIEW.width)));

    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);

    scale = Math.min(cssWidth / VIEW.width, cssHeight / VIEW.height);
    offsetX = (cssWidth - VIEW.width * scale) / 2;
    offsetY = (cssHeight - VIEW.height * scale) / 2;
    render();
  }

  /* ---------- 主循环：固定步长推进，帧率波动不影响物理 ---------- */
  function advance(now) {
    const delta = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : STEP;
    lastTime = now;
    accumulator = Math.min(accumulator + delta, 0.25);

    while (accumulator >= STEP) {
      const events = stepRun(run, STEP, hold);
      for (const event of events) handleEvent(event);
      accumulator -= STEP;
      if (run.phase !== 'running') break;
    }

    if (run.phase === 'over') {
      overTime = reducedMotion ? OVER_ENTER : Math.min(OVER_ENTER, overTime + delta);
    }

    render();

    /* 结束后再多跑一小会儿——只为了让结果卡片进场，放完就停 */
    const entering = run.phase === 'over' && overTime < OVER_ENTER;
    if (run.phase === 'running' || entering) {
      frameId = windowRef.requestAnimationFrame(advance);
    } else {
      frameId = 0;
    }
  }

  function startLoop() {
    if (frameId) return;
    lastTime = 0;
    accumulator = 0;
    frameId = windowRef.requestAnimationFrame(advance);
  }

  /* ---------- 立绘：给了路径就用图，没给就用内置卡通角色 ---------- */
  function loadSprites() {
    const sources = options.sprites ?? {};
    const ImageCtor = windowRef.Image ?? (typeof Image !== 'undefined' ? Image : null);
    if (!ImageCtor) return;

    Object.keys(sources).forEach(function (name) {
      const source = sources[name];
      if (!source) return;

      const image = new ImageCtor();
      image.addEventListener('load', function () {
        sprites[name] = image;
        render();
      });
      image.addEventListener('error', function () {
        console.info('[jary-game] 立绘加载失败，改用内置角色：' + source);
      });
      image.src = source;
    });
  }

  /* ---------- 输入 ---------- */
  const api = {
    run: run,
    labels: currentLabels,

    begin() {
      if (run.phase === 'running') return;
      const resuming = run.phase === 'paused';
      overTime = 0;
      beginRun(run);
      handleEvent({ type: resuming ? 'resume' : 'start' });
      render();
      startLoop();
    },

    pause() {
      if (run.phase !== 'running') return;
      run.phase = 'paused';
      handleEvent({ type: 'pause' });
      render();
    },

    toggle() {
      if (run.phase === 'running') api.pause();
      else api.begin();
    },

    restart() {
      resetRun(run);
      handleEvent({ type: 'restart' });
      api.begin();
    },

    jump() {
      return requestJump(run);
    },

    setSlide(active) {
      hold.slide = Boolean(active);
      if (hold.slide) return requestSlide(run);
      return false;
    },

    render: render,
    resize: resize,
  };

  function onKeyDown(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

    const key = event.key;
    if (key === ' ' || key === 'Spacebar') {
      /* 跑动中空格 = 起跳；其余状态 = 开始 / 继续 / 重开 */
      event.preventDefault();
      if (run.phase === 'running') api.jump();
      else api.begin();
      return;
    }
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      event.preventDefault();
      api.jump();
      return;
    }
    if (key === 'ArrowDown' || key === 's' || key === 'S') {
      event.preventDefault();
      api.setSlide(true);
      return;
    }
    if (key === 'p' || key === 'P') {
      event.preventDefault();
      api.toggle();
      return;
    }
    if (key === 'r' || key === 'R') {
      event.preventDefault();
      api.restart();
    }
  }

  function onKeyUp(event) {
    if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') api.setSlide(false);
  }

  function onBlur() {
    if (run.phase === 'running') api.pause();
  }

  function onVisibilityChange() {
    if (documentRef?.hidden && run.phase === 'running') api.pause();
  }

  /* 点画面：没开始就开始，跑动中即起跳（手机上也够用） */
  function onPointerDown(event) {
    event.preventDefault();
    if (run.phase === 'running') api.jump();
    else api.begin();
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(resize)
    : null;

  resizeObserver?.observe(canvas);
  windowRef.addEventListener?.('resize', resize, { passive: true });
  windowRef.addEventListener?.('keydown', onKeyDown);
  windowRef.addEventListener?.('keyup', onKeyUp);
  windowRef.addEventListener?.('blur', onBlur);
  documentRef?.addEventListener('visibilitychange', onVisibilityChange);
  canvas.addEventListener?.('pointerdown', onPointerDown);

  api.destroy = function destroy() {
    if (frameId) windowRef.cancelAnimationFrame?.(frameId);
    frameId = 0;
    resizeObserver?.disconnect();
    windowRef.removeEventListener?.('resize', resize);
    windowRef.removeEventListener?.('keydown', onKeyDown);
    windowRef.removeEventListener?.('keyup', onKeyUp);
    windowRef.removeEventListener?.('blur', onBlur);
    documentRef?.removeEventListener('visibilitychange', onVisibilityChange);
    canvas.removeEventListener?.('pointerdown', onPointerDown);
  };

  loadSprites();
  resize();

  return api;
}

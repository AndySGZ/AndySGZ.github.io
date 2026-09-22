/* ==========================================================================
   游戏配乐与音效
   --------------------------------------------------------------------------
   - 配乐与「奶龙大笑」各播一个音频文件；小红花的提示音用 Web Audio 现场合成，
     不额外增加体积。
   - 浏览器一律拦截「没有用户交互就出声」，所以音频元素等到第一次点「开始」
     （也就是一次用户手势）才创建——页面打开时不会偷偷下载那几 MB 的配乐。
   - 静音开关记在 localStorage 里，刷新后仍然生效。
   - 音频文件缺失或格式不被支持时只留一行控制台提示，绝不影响游戏本身。
   ========================================================================== */

const STORAGE_KEY = 'jary-nailong-sound';
const THEME_VOLUME = 0.35;
const LAUGH_VOLUME = 0.7;
const PICKUP_VOLUME = 0.18;

/* 小红花的提示音：两声上行的小铃铛，现场合成 */
const PICKUP_NOTES = [
  { frequency: 880, delay: 0, length: 0.24 },
  { frequency: 1318.5, delay: 0.07, length: 0.3 },
];

const TRACKS = {
  theme: { source: 'assets/game/theme.m4a', volume: THEME_VOLUME, loop: true },
  laugh: { source: 'assets/game/laugh.m4a', volume: LAUGH_VOLUME, loop: false },
};

/* 存的是「关掉声音」这个状态；没存过就按有声处理 */
export function resolveMuted(stored) {
  return stored === 'off';
}

export function createGameAudio(options = {}) {
  const windowRef = options.windowRef ?? window;
  const storage = options.storage ?? windowRef.localStorage ?? null;
  const AudioCtor = options.AudioCtor ?? windowRef.Audio ?? (typeof Audio !== 'undefined' ? Audio : null);
  const AudioContextCtor = options.AudioContextCtor
    ?? windowRef.AudioContext
    ?? windowRef.webkitAudioContext
    ?? null;

  let muted = resolveMuted(readStored());
  let wanted = false;      /* 配乐此刻「该响」还是「该停」 */
  let context = null;
  let tracks = null;

  function readStored() {
    try {
      return storage ? storage.getItem(STORAGE_KEY) : null;
    } catch (error) {
      return null;   /* 隐私模式下读不到，按有声处理 */
    }
  }

  function store() {
    try {
      if (storage) storage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
    } catch (error) {
      /* 写不进去也不影响本次播放 */
    }
  }

  /* 音频元素推迟到第一次用户手势再建，省掉页面打开时的几 MB 请求 */
  function ensureTracks() {
    if (tracks || !AudioCtor) return tracks;

    tracks = {};
    Object.keys(TRACKS).forEach(function (name) {
      const spec = TRACKS[name];
      const element = new AudioCtor();
      element.src = spec.source;
      element.loop = spec.loop;
      element.volume = spec.volume;
      element.preload = 'auto';
      element.addEventListener('error', function () {
        console.info('[jary-game] 音频加载失败，这一条就静音处理：' + spec.source);
      });
      tracks[name] = element;
    });

    return tracks;
  }

  function play(element) {
    if (!element) return;
    const result = element.play();
    /* 被自动播放策略拦下、或用户已经暂停，都会 reject，静默忽略即可 */
    if (result && typeof result.catch === 'function') result.catch(function () {});
  }

  function track(name) {
    return tracks ? tracks[name] : null;
  }

  /* 合成提示音用的 AudioContext，同样等第一次真的要用时才建 */
  function ensureContext() {
    if (context || !AudioContextCtor) return context;
    try {
      context = new AudioContextCtor();
    } catch (error) {
      context = null;
    }
    return context;
  }

  const api = {
    isMuted: function () {
      return muted;
    },

    setMuted: function (next) {
      muted = Boolean(next);
      store();

      if (muted) {
        const theme = track('theme');
        const laugh = track('laugh');
        if (theme) theme.pause();
        if (laugh) laugh.pause();
      } else if (wanted) {
        play(track('theme'));
      }

      return muted;
    },

    toggle: function () {
      return api.setMuted(!muted);
    },

    /* 开始 / 继续 / 重开都走这里 */
    playTheme: function () {
      if (muted) return;
      wanted = true;
      ensureTracks();
      play(track('theme'));
    },

    pauseTheme: function () {
      wanted = false;
      const theme = track('theme');
      if (theme) theme.pause();
    },

    /* 小红花：短促的两声铃，合成出来不占文件 */
    playPickup: function () {
      if (muted) return;

      const audioContext = ensureContext();
      if (!audioContext) return;
      if (audioContext.state === 'suspended' && audioContext.resume) audioContext.resume();

      const start = audioContext.currentTime;
      PICKUP_NOTES.forEach(function (note) {
        const begin = start + note.delay;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(note.frequency, begin);
        gain.gain.setValueAtTime(0.0001, begin);
        gain.gain.exponentialRampToValueAtTime(PICKUP_VOLUME, begin + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, begin + note.length);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(begin);
        oscillator.stop(begin + note.length + 0.02);
      });
    },

    playLaugh: function () {
      if (muted) return;
      ensureTracks();

      const laugh = track('laugh');
      if (!laugh) return;
      try {
        laugh.currentTime = 0;
      } catch (error) {
        /* 还没拿到元数据时设 currentTime 会抛，忽略就好 */
      }
      play(laugh);
    },

    stopLaugh: function () {
      const laugh = track('laugh');
      if (!laugh) return;
      laugh.pause();
      try {
        laugh.currentTime = 0;
      } catch (error) {
        /* 同上 */
      }
    },

    destroy: function () {
      Object.keys(TRACKS).forEach(function (name) {
        const element = track(name);
        if (element) element.pause();
      });
      if (context && context.close) context.close();
      context = null;
      tracks = null;
    },
  };

  return api;
}

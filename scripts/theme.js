/* ==========================================================================
   明暗主题：默认跟随系统，手动切过之后就记住选择。
   --------------------------------------------------------------------------
   这是个普通脚本（不是 module），放在 <head> 里也不加 defer ——
   它必须在首屏绘制之前把 data-theme 写到 <html> 上，否则会先闪一下浅色。
   脚本要放在 <meta name="theme-color"> 之后，apply() 第一次跑时要能读到它。
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'andy-theme';
  var LIGHT = 'light';
  var DARK = 'dark';

  /* 地址栏 / 状态栏颜色，跟 CSS 里的 --bg 对齐 */
  var THEME_COLOR = { light: '#f5f0eb', dark: '#191817' };

  /* 两张表都按「当前主题」取：按钮上写的永远是按下去会变成什么，
     跟游戏页的静音键一个约定。所以 key 是现在，value 是下一步。 */
  var LABELS = {
    zh: { light: '暗色', dark: '亮色' },
    en: { light: 'Dark', dark: 'Light' },
  };
  var HINTS = {
    light: '切换到暗色 / Switch to dark',
    dark: '切换到亮色 / Switch to light',
  };

  function readStored() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return value === LIGHT || value === DARK ? value : null;
    } catch (error) {
      return null;                 /* 隐私模式下读不到，按没选过处理 */
    }
  }

  function writeStored(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      /* 写不进去也不影响本次会话，只是下次打开又回到跟随系统 */
    }
  }

  function systemTheme() {
    var query = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    return query && query.matches ? DARK : LIGHT;
  }

  function resolved() {
    return readStored() || systemTheme();
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme]);

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(theme === DARK));
      button.setAttribute('aria-label', HINTS[theme]);
      button.setAttribute('title', HINTS[theme]);

      Object.keys(LABELS).forEach(function (language) {
        button.querySelectorAll('[data-theme-label-' + language + ']').forEach(function (span) {
          span.textContent = LABELS[language][theme];
        });
      });
    });
  }

  /* 先落主题：这一步必须在首屏之前完成 */
  apply(resolved());

  function toggle() {
    var next = document.documentElement.getAttribute('data-theme') === DARK ? LIGHT : DARK;
    writeStored(next);
    apply(next);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.addEventListener('click', toggle);
    });
    apply(resolved());             /* 按钮这时才在 DOM 里，刷一遍文案 */
  });

  /* 没手动选过就跟着系统走：白天切到夜间模式，页面跟着变 */
  var query = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (query) {
    var onSystemChange = function () {
      if (!readStored()) apply(systemTheme());
    };
    if (query.addEventListener) query.addEventListener('change', onSystemChange);
    else if (query.addListener) query.addListener(onSystemChange);
  }
}());

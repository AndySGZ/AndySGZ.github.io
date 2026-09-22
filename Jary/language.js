const SUPPORTED_LANGUAGES = new Set(['zh', 'en']);

const PAGE_METADATA = {
  zh: {
    title: 'JARY行为研究 | JARY Behavior Research',
    description: '一份专注于Jary的行为学学术期刊。',
  },
  en: {
    title: 'JARY Behavior Research | Journal of a Single Subject',
    description: 'An academic journal dedicated to the behavioral study of JARY.',
  },
};

/* 子页面（游戏厅、小游戏）可以在 <html> 上用
   data-title-zh / data-title-en / data-description-zh / data-description-en
   覆盖默认文案；不写就退回上面的期刊主文案，主页因此不用改。 */
function pageMetadata(language, root) {
  const dataset = root.dataset ?? {};
  const suffix = language === 'zh' ? 'Zh' : 'En';
  const defaults = PAGE_METADATA[language];

  return {
    title: dataset['title' + suffix] || defaults.title,
    description: dataset['description' + suffix] || defaults.description,
  };
}

export function resolveLanguage(savedLanguage, browserLanguage = '') {
  if (SUPPORTED_LANGUAGES.has(savedLanguage)) return savedLanguage;
  return browserLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function applyLanguage(language, root = document.documentElement, storage = window.localStorage) {
  const nextLanguage = SUPPORTED_LANGUAGES.has(language) ? language : 'zh';
  root.lang = nextLanguage === 'zh' ? 'zh-CN' : 'en';
  root.dataset.language = nextLanguage;

  root.querySelectorAll?.('[data-language-option]').forEach((button) => {
    const active = button.dataset.languageOption === nextLanguage;
    button.setAttribute('aria-pressed', String(active));
  });

  if (typeof document !== 'undefined' && root === document.documentElement) {
    const metadata = pageMetadata(nextLanguage, root);
    document.title = metadata.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', metadata.description);
  }

  try {
    storage?.setItem('jary-language', nextLanguage);
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }

  return nextLanguage;
}

function initializeLanguageControls() {
  let savedLanguage = null;
  try {
    savedLanguage = window.localStorage.getItem('jary-language');
  } catch {
    // Browser language remains a reliable fallback.
  }

  applyLanguage(resolveLanguage(savedLanguage, navigator.language));

  document.querySelectorAll('[data-language-option]').forEach((button) => {
    button.addEventListener('click', () => {
      applyLanguage(button.dataset.languageOption);
    });
  });
}

if (typeof document !== 'undefined') {
  initializeLanguageControls();
}

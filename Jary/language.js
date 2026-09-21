const SUPPORTED_LANGUAGES = new Set(['zh', 'en']);

const PAGE_METADATA = {
  zh: {
    title: 'JARY行为研究 | JARY Behavior Research',
    description: '一份专注于单一特定个体 Subject JARY 的深度行为学学术期刊。',
  },
  en: {
    title: 'JARY Behavior Research | Journal of a Single Subject',
    description: 'An academic journal dedicated to the in-depth behavioral study of Subject JARY.',
  },
};

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
    document.title = PAGE_METADATA[nextLanguage].title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', PAGE_METADATA[nextLanguage].description);
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

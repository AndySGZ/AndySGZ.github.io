/* ==========================================================================
   把 updates-data.js 里的动态渲染进 [data-updates-feed]。
   --------------------------------------------------------------------------
   全程用 textContent 拼节点，不用 innerHTML —— 动态内容不会被当成 HTML 执行。
   中英两版都包一层 <span data-lang="zh|en">，交给 styles.css 里那两条
   html[data-language=...] 规则去显隐，跟页面上的静态文案是同一套机制。
   数据里只写了中文的，英文那一份也照样生成（内容用中文顶上），
   否则切到 EN 会看到一整条空白。
   ========================================================================== */

import { UPDATES } from './updates-data.js';

/* 取 { zh, en } 里的某一语言；纯字符串就两边共用。
   导出是为了能单独测：英文缺了必须落回中文，不能给出空串。 */
export function pick(value, language) {
  if (value && typeof value === 'object') {
    return String(value[language] || value.zh || value.en || '');
  }
  return String(value || '');
}

/* 正文按空行切段。text 写成 { zh, en } 时两种语言各切各的（换行位置不必对得上），
   写成一整句字符串时两边共用。
   注意别对 text 本身做 String()：对象的话会变成 "[object Object]" 印在页面上。 */
export function splitParagraphs(value, language) {
  return String(pick(value, language))
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/* 生成一个中英并排的节点：<p class="x"><span data-lang="zh">..</span><span data-lang="en">..</span></p> */
function bilingual(tag, className, value, fallback) {
  const node = document.createElement(tag);
  if (className) node.className = className;

  const text = value === undefined || value === null ? fallback : value;
  ['zh', 'en'].forEach((language) => {
    const span = document.createElement('span');
    span.dataset.lang = language;
    span.textContent = pick(text, language);
    node.appendChild(span);
  });

  return node;
}

function imageFigure(image) {
  const figure = document.createElement('figure');
  figure.className = 'update__figure';

  const img = document.createElement('img');
  img.src = image.src;
  /* alt 是给读屏和图片加载失败时看的，写死一句中文就够 */
  img.alt = image.alt || '';
  img.loading = 'lazy';
  img.decoding = 'async';
  /* 图放错地方或还没导进来时，留一个空框而不是裂图 */
  img.addEventListener('error', () => {
    figure.classList.add('update__figure--broken');
    img.remove();
    console.warn('[updates] 图片加载失败：' + image.src);
  });
  figure.appendChild(img);

  if (image.caption) {
    figure.appendChild(bilingual('figcaption', null, image.caption));
  }

  return figure;
}

function updateNode(entry) {
  const article = document.createElement('article');
  article.className = 'update';

  const meta = document.createElement('p');
  meta.className = 'update__meta';
  const time = document.createElement('time');
  time.dateTime = entry.date;
  time.textContent = entry.date;
  meta.appendChild(time);
  if (entry.kind) meta.appendChild(bilingual('span', 'update__kind', entry.kind));
  article.appendChild(meta);

  article.appendChild(bilingual('h2', 'update__title', entry.title, '（未命名）'));

  const body = document.createElement('div');
  body.className = 'update__body';

  /* 空一行 = 一个新段落；中英两版按序号配对，少的那边留空但不塌行 */
  const zhParagraphs = splitParagraphs(entry.text, 'zh');
  const enParagraphs = splitParagraphs(entry.text, 'en');
  const paragraphCount = Math.max(zhParagraphs.length, enParagraphs.length);

  for (let index = 0; index < paragraphCount; index += 1) {
    const paragraph = { zh: zhParagraphs[index] || '', en: enParagraphs[index] || '' };
    if (!paragraph.zh && !paragraph.en) continue;
    body.appendChild(bilingual('p', null, paragraph));
  }

  const images = Array.isArray(entry.images) ? entry.images.filter((item) => item && item.src) : [];
  if (images.length) {
    const gallery = document.createElement('div');
    /* 一张铺满，两张以上并排（窄屏自动落回一张一行） */
    gallery.className = 'update__images' + (images.length > 1 ? ' update__images--row' : '');
    images.forEach((image) => gallery.appendChild(imageFigure(image)));
    body.appendChild(gallery);
  }

  if (entry.link && entry.link.href) {
    const link = document.createElement('a');
    link.className = 'plain-link';
    link.href = entry.link.href;
    link.appendChild(bilingual('span', null, entry.link.label, entry.link.href));
    body.appendChild(link);
  }

  article.appendChild(body);
  return article;
}

function render() {
  const host = document.querySelector('[data-updates-feed]');
  if (!host) return;

  const entries = (Array.isArray(UPDATES) ? UPDATES.slice() : [])
    /* 最新的排最前；sort 是稳定的，同一天的两条保持文件里的先后 */
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  if (!entries.length) {
    host.appendChild(bilingual('p', 'updates-empty', {
      zh: '还没有动态。',
      en: 'No updates yet.'
    }));
    return;
  }

  entries.forEach((entry) => host.appendChild(updateNode(entry)));
}

if (typeof document !== 'undefined') {
  render();
}

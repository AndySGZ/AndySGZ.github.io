import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);

test('Jary route exposes the complete bilingual journal identity', async () => {
  const html = await readFile(new URL('Jary/index.html', projectRoot), 'utf8');

  assert.match(html, /JARY Behavior Research/);
  assert.match(html, /《JARY行为研究》/);
  /* 期刊的「单一个体」设定靠侧栏这一栏撑着，正文里不再把人称作 Subject JARY */
  assert.ok(html.includes('JARY / N=1'), '侧栏应保留研究对象与样本数');
  assert.match(html, /研究对象/);
  assert.match(html, /严谨记录，科学分析/);
  assert.match(html, /Rigorous Recording, Scientific Analysis/);

  for (const scope of [
    'Jary个体行为学机理',
    'Jary行为动态观测',
    'Jary言论与认知分析',
    'Jary与网络符号交互',
  ]) {
    assert.match(html, new RegExp(scope));
  }
});

test('language resolver honors saved preference and browser language', async () => {
  const { resolveLanguage } = await import('../Jary/language.js');

  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
  assert.equal(resolveLanguage('zh', 'en-US'), 'zh');
  assert.equal(resolveLanguage(null, 'zh-TW'), 'zh');
  assert.equal(resolveLanguage(null, 'fr-FR'), 'en');
  assert.equal(resolveLanguage('invalid', 'zh-CN'), 'zh');
});

test('language application updates the document and persists the selection', async () => {
  const { applyLanguage } = await import('../Jary/language.js');
  const state = { lang: '', dataset: {}, querySelectorAll: () => [] };
  const writes = [];
  const storage = { setItem: (key, value) => writes.push([key, value]) };

  assert.equal(applyLanguage('en', state, storage), 'en');
  assert.equal(state.lang, 'en');
  assert.equal(state.dataset.language, 'en');
  assert.deepEqual(writes, [['jary-language', 'en']]);
});

test('behavior trace is deterministic and stays inside its drawing area', async () => {
  const { buildBehaviorTrace } = await import('../Jary/observation.js');
  const first = buildBehaviorTrace(640, 480, 0.25);
  const second = buildBehaviorTrace(640, 480, 0.25);

  assert.deepEqual(first, second);
  assert.equal(first.length, 72);
  assert.ok(first.every(({ x, y }) => x >= 0 && x <= 640 && y >= 0 && y <= 480));
  assert.ok(new Set(first.map(({ y }) => Math.round(y))).size > 12);
});

test('journal styles preserve keyboard focus and reduced-motion preferences', async () => {
  const css = await readFile(new URL('Jary/styles.css', projectRoot), 'utf8');

  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
});

test('journal homepage provides an editorial current-issue reading flow', async () => {
  const html = await readFile(new URL('Jary/index.html', projectRoot), 'utf8');

  assert.match(html, /class="journal-cover"/);
  assert.match(html, /class="[^"]*\bcurrent-issue\b[^"]*"/);
  assert.match(html, /class="article-list"/);
  assert.equal((html.match(/class="article-row"/g) ?? []).length, 4);
  assert.match(html, /Volume 1[\s\S]*Issue 1[\s\S]*21 September 2026/i);
});

test('mobile reading order puts issue editorial before its supplementary cover', async () => {
  const html = await readFile(new URL('Jary/index.html', projectRoot), 'utf8');
  const issue = html.slice(html.indexOf('<section class="current-issue'), html.indexOf('</section>', html.indexOf('<section class="current-issue')));

  assert.ok(issue.indexOf('class="issue-overview"') < issue.indexOf('class="journal-cover"'));
  assert.doesNotMatch(html, /class="institution-bar"/);
});

test('research programmes do not claim unpublished articles or identifiers', async () => {
  const html = await readFile(new URL('Jary/index.html', projectRoot), 'utf8');

  assert.equal((html.match(/class="article-row"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /OPEN PROGRAMME|ISSN PENDING|JBR-2026-001|JBR \/ (?:MEC|OBS|COG|NET)/);
});

test('observation plate remains static instead of scheduling continuous animation', async () => {
  const { createObservationPlate } = await import('../Jary/observation.js');
  const context = new Proxy({}, { get: () => () => {} });
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 360, height: 420, left: 0, top: 0 }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  let scheduledFrames = 0;
  const windowRef = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: () => {
      scheduledFrames += 1;
      return scheduledFrames;
    },
    cancelAnimationFrame: () => {},
  };

  const plate = createObservationPlate(canvas, { windowRef, reducedMotion: false });
  assert.equal(scheduledFrames, 0);
  plate.destroy();
});

test('observation plate identifies itself as conceptual rather than measured data', async () => {
  const source = await readFile(new URL('Jary/observation.js', projectRoot), 'utf8');

  assert.match(source, /CONCEPTUAL TRACE/);
  assert.doesNotMatch(source, /SIGNAL JARY-01|T\+/);
});

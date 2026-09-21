import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../index.html', import.meta.url);

test('homepage exposes its core identity and violin interaction', async () => {
  const html = await readFile(htmlPath, 'utf8');

  assert.match(html, /<html[^>]+lang="zh-CN"/);
  assert.match(html, /<h1[^>]*>\s*石广喆\s*<\/h1>/);
  assert.match(html, /src="assets\/violin\.png"/);
  assert.match(html, /aria-label="奏响小提琴"/);
});

test('homepage supports reduced motion and keyboard activation', async () => {
  const html = await readFile(htmlPath, 'utf8');

  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /event\.key === ['"]Enter['"]/);
  assert.match(html, /event\.key === ['"] ['"]/);
});

test('homepage includes stage layers and interaction hooks', async () => {
  const html = await readFile(htmlPath, 'utf8');

  for (const token of [
    'stage',
    'curtain',
    'aurora',
    'spotlight',
    'violin-stage',
    'sound-wave',
  ]) {
    assert.match(html, new RegExp(token));
  }

  assert.match(html, /function triggerResonance\(/);
  assert.match(html, /--pointer-x/);
  assert.match(html, /--pointer-y/);
});

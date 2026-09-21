import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../index.html', import.meta.url);


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

test('homepage exposes an accessible newspaper link to the JARY journal', async () => {
  const html = await readFile(htmlPath, 'utf8');

  assert.match(html, /class="newspaper-drawer"/);
  assert.match(html, /href="\/Jary\/index\.html"/);
  assert.match(html, /aria-label="打开 JARY 行为研究"/);
  assert.match(html, /\.newspaper-drawer:hover/);
  assert.match(html, /\.newspaper-drawer:focus-visible/);
  assert.match(html, /\.newspaper-drawer:active/);
});

# Andy SGZ个人主页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可直接由 GitHub Pages 发布、以虹彩姓名和炫酷小提琴为核心的单屏个人主页。

**Architecture:** 根目录 `index.html` 内联全部 CSS 和 JavaScript，以无依赖静态页面呈现剧院、极光、霓虹与交互效果。项目内透明 PNG 作为小提琴主体，Node 内置测试负责结构与可访问性回归，真实浏览器负责视觉和交互验收。

**Tech Stack:** HTML5、CSS3、原生 JavaScript、Node.js `node:test`、静态 HTTP 服务器

**Spec:** `docs/superpowers/specs/2026-09-21-andy-sgz-homepage-design.md`

## Global Constraints

- 页面实现为根目录单个 `index.html`，CSS 与 JavaScript 内联。
- 小提琴素材必须保存在项目内，不依赖外部图片服务。
- 不引入前端框架或第三方运行时依赖。
- 页面必须支持桌面与手机视口、键盘操作以及 `prefers-reduced-motion`。
- 页面无需构建步骤，可由静态服务器或 GitHub Pages 直接访问。

---

### Task 1: 页面契约与素材

**Files:**
- Create: `tests/homepage.test.mjs`
- Create: `assets/violin.png`

**Interfaces:**
- Consumes: 设计文档中的文字、素材和可访问性要求。
- Produces: 针对 `index.html` 的结构契约；项目内透明小提琴图片路径 `assets/violin.png`。

- [x] **Step 1: 写出失败的结构测试**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../index.html', import.meta.url);

test('homepage exposes its core identity and violin interaction', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /<html[^>]+lang="zh-CN"/);
  assert.match(html, /<h1[^>]*>\s*Andy SGZ\s*<\/h1>/);
  assert.match(html, /src="assets\/violin\.png"/);
  assert.match(html, /aria-label="奏响小提琴"/);
});

test('homepage supports reduced motion and keyboard activation', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /event\.key === ['"]Enter['"]/);
  assert.match(html, /event\.key === ['"] ['"]/);
});
```

- [x] **Step 2: 运行测试并确认因页面不存在而失败**

Run: `node --test tests/homepage.test.mjs`
Expected: FAIL with `ENOENT` for `index.html`.

- [x] **Step 3: 获取并保存项目内小提琴素材**

选择来源许可清晰、主体完整的透明背景小提琴图片，保存为 `assets/violin.png`，并用 `file assets/violin.png` 确认是有效 PNG。

### Task 2: 舞台页面与交互

**Files:**
- Create: `index.html`
- Modify: `tests/homepage.test.mjs`

**Interfaces:**
- Consumes: `assets/violin.png` 与 Task 1 的 HTML 契约。
- Produces: `triggerResonance(origin)` 音浪触发函数；指针视差 CSS 变量 `--pointer-x`、`--pointer-y`；完整静态主页。

- [x] **Step 1: 扩充失败测试以覆盖页面层次和交互钩子**

```js
test('homepage includes stage layers and interaction hooks', async () => {
  const html = await readFile(htmlPath, 'utf8');
  for (const token of ['stage', 'curtain', 'aurora', 'spotlight', 'violin-stage', 'sound-wave']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /function triggerResonance\(/);
  assert.match(html, /--pointer-x/);
  assert.match(html, /--pointer-y/);
});
```

- [x] **Step 2: 运行测试并确认因实现缺失而失败**

Run: `node --test tests/homepage.test.mjs`
Expected: FAIL because stage and interaction tokens are absent.

- [x] **Step 3: 实现最小完整页面**

在 `index.html` 中加入语义化舞台结构、内联样式、素材引用和原生交互：

```html
<main class="stage">
  <div class="curtain curtain-left" aria-hidden="true"></div>
  <div class="curtain curtain-right" aria-hidden="true"></div>
  <section class="hero" aria-labelledby="artist-name">
    <h1 id="artist-name">Andy SGZ</h1>
    <button class="violin-stage" type="button" aria-label="奏响小提琴">
      <img src="assets/violin.png" alt="鎏金霓虹小提琴">
    </button>
  </section>
</main>
```

JavaScript 中定义 `triggerResonance(origin)`，为指针、Enter 和 Space 统一触发 `.sound-wave` 元素；指针移动仅更新 CSS 变量，不改变布局。

- [x] **Step 4: 运行测试并确认通过**

Run: `node --test tests/homepage.test.mjs`
Expected: 3 tests PASS, 0 failures.

### Task 3: 真实浏览器验收与收尾

**Files:**
- Modify: `index.html`
- Modify: `tests/homepage.test.mjs` only if a verified regression needs coverage

**Interfaces:**
- Consumes: Task 2 的静态页面。
- Produces: 在桌面和手机视口均无溢出、遮挡或素材失败的最终页面。

- [x] **Step 1: 启动静态服务器**

Run: `python3 -m http.server 8000`
Expected: server listens on `http://localhost:8000`.

- [x] **Step 2: 在桌面视口检查页面**

检查 1440x900 视口：姓名和完整小提琴首屏可见；幕布不遮挡主内容；控制台无错误；点击小提琴后出现音浪。

- [x] **Step 3: 在手机视口检查页面**

检查 390x844 视口：无横向滚动；姓名不溢出；小提琴完整可见；轻触交互有效。

- [x] **Step 4: 根据截图做最小响应式修正并重测**

只调整导致溢出、遮挡、裁切或视觉焦点不清的 CSS，然后重新运行桌面和手机验收。

- [x] **Step 5: 运行最终自动验证**

Run: `node --test tests/homepage.test.mjs && git diff --check`
Expected: all tests PASS; `git diff --check` exits 0 with no output.

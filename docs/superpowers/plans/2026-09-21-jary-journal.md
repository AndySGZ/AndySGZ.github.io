# JARY Behavior Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual, responsive academic-journal homepage served at `/Jary/`.

**Architecture:** A dependency-free static subsite uses semantic HTML and dedicated CSS. A small language module handles deterministic bilingual state, while a separate Canvas module creates a static behavioral-observation cover visual without external assets.

**Tech Stack:** HTML5, CSS3, Canvas 2D, browser JavaScript, Node.js `node:test`

**Spec:** `docs/superpowers/specs/2026-09-21-jary-journal-design.md`

## Global Constraints

- The public path is exactly `/Jary/` with capital `J`.
- Do not add a framework, build step, remote image, or runtime dependency.
- Preserve all supplied Chinese and English journal copy.
- Support keyboard navigation and `prefers-reduced-motion`.
- Keep the existing root-site files unchanged.

---

### Task 1: Public Route And Language Contract

**Files:**
- Create: `tests/jary.test.mjs`
- Create: `Jary/index.html`
- Create: `Jary/language.js`

**Interfaces:**
- `resolveLanguage(savedLanguage, browserLanguage): 'zh' | 'en'`
- `applyLanguage(language, root, storage): 'zh' | 'en'`

- [ ] Write route, content, and language behavior tests.
- [ ] Run `node --test tests/jary.test.mjs` and confirm failure because `/Jary/` does not exist.
- [ ] Implement the semantic bilingual HTML and language module.
- [ ] Re-run the tests and confirm all language and content checks pass.

### Task 2: Editorial Layout And Observation Plate

**Files:**
- Create: `Jary/styles.css`
- Create: `Jary/observation.js`
- Modify: `Jary/index.html`
- Modify: `tests/jary.test.mjs`

**Interfaces:**
- `createObservationPlate(canvas, options)` returns an object exposing `resize()`, `draw(time)`, and `destroy()` without scheduling animation frames.
- CSS breakpoints preserve the editorial hierarchy at 390px, 768px, and 1440px viewport widths.

- [ ] Add failing tests for the Canvas and reduced-motion contract.
- [ ] Implement the editorial grid, responsive styles, and print/reduced-motion modes.
- [ ] Implement deterministic static drawing without continuous animation.
- [ ] Re-run the automated suite and confirm it passes.

### Task 3: Browser QA

**Files:**
- Modify only files above when verified browser defects require correction.

- [ ] Start a static server and open `/Jary/`.
- [ ] Inspect 1440x900 and 390x844 screenshots.
- [ ] Verify language switching, keyboard focus, Canvas rendering, and lack of overflow.
- [ ] Run `node --test tests/jary.test.mjs` and `git diff --check` as the final verification.

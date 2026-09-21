# JARY Behavior Research Journal Design

## Goal

Create an independent bilingual journal homepage at `/Jary/` for JARY Behavior Research. The page should feel like a credible academic publication while making Subject JARY's single-subject behavioral observation the unmistakable editorial premise.

## Visual Direction

- Follow the information density and restraint of established scientific-journal portals: white background, black and grey typography, and one deep-red publication accent.
- Use a compact institutional header, serif journal masthead, horizontal section navigation, visible volume and issue metadata, and rule-based editorial layout.
- Present the current issue through a conventional journal cover. Its static Canvas observation plate must not invent Jary's appearance.
- Keep corners square and avoid oversized manifesto typography, decorative motion, generic dashboard cards, gradients, and marketing-style feature copy.

## Information Architecture

1. Institutional utility bar and compact journal masthead.
2. Primary navigation and current-volume metadata strip.
3. Cover-led current issue with founding editorial and publication metadata.
4. Four numbered research programmes presented as formal contents rows, not completed papers.
5. Journal-information sidebar with the complete bilingual introduction, publication facts, editorial principles, and citation format.
6. Compact publisher-style footer.

## Language Behavior

- Chinese is the default when the browser language begins with `zh`; English is the fallback for other browser languages.
- A visible segmented control lets readers select Chinese or English.
- Switching language updates all localized copy, the document language, the page title, and active-control state without reloading or changing scroll position.
- The language selection persists in `localStorage`.

## Motion And Accessibility

- The observation Canvas draws one deterministic static trace and does not schedule continuous animation.
- Interface feedback is limited to link and button hover/focus states.
- `prefers-reduced-motion: reduce` disables smooth scrolling.
- The page remains understandable without Canvas or JavaScript because all journal content exists in semantic HTML.
- Navigation, language controls, and links are keyboard accessible with visible focus states.

## Technical Design

- `Jary/index.html` contains semantic content and all Chinese/English copy.
- `Jary/styles.css` owns the editorial layout, responsive behavior, and print/reduced-motion treatment.
- `Jary/language.js` provides pure language-resolution helpers and browser-side switching.
- `Jary/observation.js` renders the static behavioral observation Canvas.
- No framework, build step, remote image, or runtime dependency is required.

## Acceptance Criteria

- `/Jary/` responds successfully from a static server and displays the journal masthead in the first viewport.
- All four supplied research scopes and both complete journal introductions are present.
- Chinese and English modes update the visible language and persist the selection.
- Desktop and mobile views have no horizontal overflow, overlapping text, or clipped primary content.
- The Canvas is visible and nonblank, while the page remains meaningful when scripts do not run.
- Keyboard focus and reduced-motion behavior are present.

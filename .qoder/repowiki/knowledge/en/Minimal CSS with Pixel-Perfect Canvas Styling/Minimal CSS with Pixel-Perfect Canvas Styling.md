---
kind: frontend_style
name: Minimal CSS with Pixel-Perfect Canvas Styling
category: frontend_style
scope:
    - '**'
source_files:
    - src/styles.css
    - index.html
---

The project uses a single, flat `src/styles.css` file with no CSS framework, preprocessors, or component-scoped styling. All visual presentation is handled through vanilla CSS applied to the minimal HTML shell in `index.html`, which contains only a `<canvas>` and two overlay buttons (pause/restart).

**Design tokens & palette** — A small set of hard-coded values defines the look:
- Background: `rgba(21, 33, 44, 1)` (`#15212c`) — dark slate, also used as `theme-color`.
- Text color: `#f8f4dc` — warm off-white.
- Focus ring: `#ffe66d` — bright yellow for accessibility outlines.
- Font: monospace via `"Courier New", Courier, monospace`.
No design-token variables beyond these few root-level declarations exist; colors are duplicated inline rather than centralized.

**Layout approach** — The body uses `display: grid; place-items: center` to center the game on screen. The `.game-shell` wrapper spans `100vw × 100dvh` with `touch-action: none` and `user-select: none` to prevent browser gestures from interfering with gameplay. The canvas scales responsively using `width: min(100%, calc(100dvh * 0.677))` and an explicit `aspect-ratio: 420 / 620`, keeping the pixel-art rendering sharp via `image-rendering: pixelated` / `crisp-edges`.

**Overlay UI pattern** — Buttons are absolutely positioned over the canvas. Visibility is toggled by adding/removing modifier classes (`.is-visible`, `.is-paused`, `.is-hidden`) rather than inline styles. The restart button uses a sprite background image (`background-size: contain`) and hides its text via `font-size: 0; color: transparent`. The pause button is drawn entirely with CSS pseudo-elements (`::before`, `::after`) forming two vertical bars — no icon assets needed.

**Accessibility** — Every interactive element carries `aria-label`s and the pause button exposes `aria-pressed`. Focus states use visible `outline` rings with generous offsets.

**Responsive strategy** — Uses viewport-relative units (`vw`, `dvh`) and `env(safe-area-inset-*)` for notched-device safe areas. No media queries are present; scaling is purely proportional to viewport size.

There is no Tailwind, PostCSS pipeline, CSS modules, or component library — just one stylesheet consumed directly by Vite.
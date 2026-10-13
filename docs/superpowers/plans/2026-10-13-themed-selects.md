# Themed dropdowns

**Goal:** Make all single-choice dropdowns, including their expanded menus, match the existing four themes.

**Approach:** Use customizable native selects behind `@supports (appearance: base-select)`. Keep the existing React state, labels, disabled states, and browser keyboard behavior. Older browsers retain functional native menus. A shared stylesheet loaded after theme styles owns menu appearance; no new dependencies.

- [x] Add shared trigger, picker, option, selected, hover, focus, disabled, and reduced-motion styles. Hide the existing decorative arrow only when the native themed arrow is available.
- [x] Verify the story ratio menu in paper and dark themes, keyboard selection, Escape, long story names, and narrow-screen positioning without generating images or changing saved story data.
- [x] Update README with appearance and compatibility notes; run build and existing tests, then commit and push.


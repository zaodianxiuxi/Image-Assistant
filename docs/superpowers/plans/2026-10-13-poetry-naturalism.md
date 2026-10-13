# Poetry naturalism implementation plan

Goal: Give poetry images restrained, coherent visual direction without forcing every poem into a continuous character story.

Keep existing analysis and project storage. Improve storyboard direction, pass the existing user supplement to planning, and compose image prompts from the current scene with bounded context. Add an editable per-scene reference mode (independent by default; continuation only for the immediately preceding scene). Preserve saved user prompts; missing character settings must stay empty. No paid model requests during verification.

- [x] Test prompt context isolation, immediate-neighbor reference eligibility, legacy defaults, preference forwarding, and normalized reference modes.
- [x] Implement planning guidance, image prompt helper, request integration, reference mode persistence and selector. Refresh built-in example prompts and remove forced exposure/character fallbacks.
- [x] Verify UI, run tests/build, document behavior and limits, commit/push.

Quality check examples: 江雪 separates empty mountain/road scenes from the lone fishing boat; 山居秋暝 distinguishes moonlit pines, water over stones, and people returning without forcing them into every image; 咸阳城东楼 uses wind in reeds and a distant river instead of repeated posed portraits. These are intended criteria, not measured model outputs.


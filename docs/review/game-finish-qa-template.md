# Game finish QA template

Use this after a title reaches feature-complete or visual-complete state.

## 1. Core-loop integrity
- [ ] Original game mechanic is unchanged unless the task explicitly changes it.
- [ ] Title → play → result → retry is completable.
- [ ] No duplicate reward, double submit or stale delayed action after retry.
- [ ] Save/reload does not create an impossible state.

## 2. First-time usability
- [ ] Primary action is obvious without reading a long paragraph.
- [ ] Primary CTA has the strongest visual weight.
- [ ] Secondary actions do not compete with the primary action.
- [ ] Touch targets are large enough for mobile use.
- [ ] Critical controls are not under browser chrome / safe-area edges.

## 3. Visual hierarchy
- [ ] Character/subject is large enough relative to background.
- [ ] Important HUD values can be read at phone size.
- [ ] Result/win/loss state is recognizable within one second.
- [ ] Always-on particles/noise are minimal.
- [ ] Generated art is used only when it improves the screen.
- [ ] No background contains baked-in TAP / START / tutorial text.

## 4. Responsive coverage
Required representative sizes:
- portrait: 320×568, 390×844
- landscape: 800×360, 844×390, 932×430
- portal/desktop sizes from CrazyGames readiness tests

Check:
- [ ] Canvas fits viewport.
- [ ] Rotation keeps the current flow operable.
- [ ] No CTA clipping.
- [ ] Tap coordinates remain aligned after resize.
- [ ] Text does not overlap at English fallback length.

## 5. Result + replay
- [ ] Result screen has visible outcome, reward/progress and next action.
- [ ] Retry is one obvious action.
- [ ] Returning to title does not leave stale overlays.
- [ ] Victory and defeat have distinct hierarchy.

## 6. Automated gate
- [ ] lint
- [ ] typecheck
- [ ] unit tests
- [ ] build
- [ ] Browser E2E
- [ ] WebKit Smoke
- [ ] visual-QA artifact
- [ ] Pages/release package build if releasable

## 7. Asset gate
Before generating:
- inspect current `public/images`
- inspect generated manifest
- inspect review/reference sheets
- confirm the role is not already covered by code/native UI

After generating:
- use title prefix naming
- put runtime files under `public/images/generated/`
- retain fallback behavior when practical
- update manifest
- compare actual screenshot, not just the isolated asset

## 8. Human-device gate
Automation does not replace:
- [ ] physical iOS Safari
- [ ] physical Android Chrome
- [ ] browser bar expansion/collapse
- [ ] notch / Dynamic Island / home indicator
- [ ] sound volume feel
- [ ] 10+ minute thermal/memory/touch stability

## Done
A title is done when the player-facing loop is complete, the latest actual screenshot is acceptable, automated gates pass, and any physical-device-only items are tracked explicitly.

# AI_project002 v1.0.0-rc.1

## Candidate status
This is the release candidate for the six-game visual/usability completion round.

## Source of truth
- main branch
- final release gate: `docs/review/final-release-gate-2026-09-27.md`
- shared finish checklist: `docs/review/game-finish-qa-template.md`
- next gameplay phase: `docs/design/retention-phase-2026-09-27.md`

## Automated gates
Required before promoting a commit to this candidate:
- lint / typecheck / unit tests / build
- Browser E2E
- WebKit Smoke
- CrazyGames Readiness
- CrazyGames Marketing Assets
- GitHub Pages deploy
- six standalone release packages

## Human gates before v1.0.0
1. Physical iOS Safari:
   - title → core loop → result → retry
   - portrait/landscape rotation
   - browser bar expansion/collapse
   - safe-area / Dynamic Island / home indicator
   - sound and 10+ minute stability
2. Physical Android Chrome:
   - same flow, browser bar, back/resume, sound, 10+ minute stability
3. CrazyGames / PLiCy:
   - upload latest `game-release-packages`
   - portal preview
   - locale/SDK/iframe/PEGI checks
4. After the human gates pass:
   - create tag `v1.0.0`
   - create GitHub Release
   - record public/review URLs

## Known non-blockers
- historical merged branches remain because automatic branch deletion is disabled and the current connector cannot delete refs.
- historical review screenshots remain as evidence; the final release gate is the current source of truth.


## Package snapshot
Latest measured release package sizes after Karma cleanup:
- Color Match: ~1.2 MB
- Fist Legend: ~4.8 MB
- Karma Quest: ~66 MB
- Potion Workshop: ~4.3 MB
- Sangoku Tap: ~8.2 MB
- Sword Forest: ~3.4 MB

Karma Quest was reduced from ~94 MB to ~66 MB by removing unreferenced duplicate/legacy art while preserving deferred runtime loading.


## Release workflow
After the human-device and portal gates pass, use GitHub Actions **Create GitHub Release**:
1. Run the workflow manually.
2. Enter `v1.0.0` (or a prerelease tag such as `v1.0.0-rc.1`).
3. Choose prerelease true/false.
4. Keep target_ref as `main` unless intentionally releasing another ref.

The workflow rebuilds all six games, creates standalone ZIPs + SHA256SUMS + BUILD-INFO, creates the tag, and publishes the GitHub Release. It is manual-only so RC code does not auto-release before physical-device QA.

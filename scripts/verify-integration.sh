#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Use the locked dependencies. No global packages or browser downloads are required.
for game in potion-workshop side-scroller color-match fist-legend karma-quest sangoku-tap; do
  (
    cd "games/$game"
    npm ci
    npm run lint
    npm run typecheck
    npm test -- --run
    npm run build
  )
done

# Point GAME_CHROMIUM at an already installed Chrome/Chromium executable.
export GAME_CHROMIUM="${GAME_CHROMIUM:-/usr/bin/google-chrome}"
if [ ! -x "$GAME_CHROMIUM" ]; then
  echo "Set GAME_CHROMIUM to an installed Chrome/Chromium executable." >&2
  exit 1
fi
python3 -m http.server 8765 --bind 127.0.0.1 > /tmp/ai-project002-review-server.log 2>&1 &
review_server_pid=$!
trap 'kill "$review_server_pid" 2>/dev/null || true' EXIT
python3 - <<'PY'
import time, urllib.request
for attempt in range(50):
    try:
        urllib.request.urlopen('http://127.0.0.1:8765/', timeout=1).close()
        break
    except OSError:
        time.sleep(0.1)
else:
    raise SystemExit('Review server did not start')
PY
node scripts/review-games.mjs
node scripts/review-edge-cases.mjs
node scripts/review-sangoku-campaign.mjs

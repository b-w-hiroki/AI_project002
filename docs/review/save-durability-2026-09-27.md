# Save durability QA — 2026-09-27

Hardened persistent numeric/JSON progress loads for Color Match, Fist Legend, Karma Quest and Sangoku Tap.

- negative / NaN / Infinity numeric values fall back to safe defaults
- Sangoku inventory counts normalize to non-negative integers
- invalid general counts / equipment rarities are ignored
- corrupt JSON continues to fall back instead of blocking startup
- no save-key migration or gameplay-economy change

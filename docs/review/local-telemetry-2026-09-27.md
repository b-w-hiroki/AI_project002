# Local telemetry baseline — 2026-09-27

No data leaves the browser. The shared module stores per-title aggregate counters in localStorage only:

- session count
- first user action count
- foreground active time
- last session/action timestamps

It does not use network requests, cookies, account IDs, advertising IDs, fingerprinting, IP/location collection, or third-party analytics.

Purpose: local QA and future v1.1 balancing. Remote analytics, if ever added, requires a separate explicit privacy/consent decision.

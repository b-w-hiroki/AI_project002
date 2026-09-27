export interface LocalTelemetryData {
  sessions: number;
  firstActions: number;
  totalActiveMs: number;
  lastStartedAt: number | null;
  lastActiveAt: number | null;
}
export interface TelemetryStore { getItem(key: string): string | null; setItem(key: string, value: string): void; }
const PREFIX = "ai_project002_local_telemetry_v1";
export function emptyLocalTelemetry(): LocalTelemetryData {
  return { sessions: 0, firstActions: 0, totalActiveMs: 0, lastStartedAt: null, lastActiveAt: null };
}
function finiteNonNegative(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
export function telemetryKey(gameId: string): string { return `${PREFIX}:${gameId}`; }
export function loadLocalTelemetry(gameId: string, store: TelemetryStore = localStorage): LocalTelemetryData {
  const raw = store.getItem(telemetryKey(gameId));
  if (!raw) return emptyLocalTelemetry();
  try {
    const parsed = JSON.parse(raw) as Partial<LocalTelemetryData>;
    return {
      sessions: Math.floor(finiteNonNegative(parsed.sessions)),
      firstActions: Math.floor(finiteNonNegative(parsed.firstActions)),
      totalActiveMs: Math.floor(finiteNonNegative(parsed.totalActiveMs)),
      lastStartedAt: Number.isFinite(parsed.lastStartedAt) ? Number(parsed.lastStartedAt) : null,
      lastActiveAt: Number.isFinite(parsed.lastActiveAt) ? Number(parsed.lastActiveAt) : null,
    };
  } catch { return emptyLocalTelemetry(); }
}
export function saveLocalTelemetry(gameId: string, data: LocalTelemetryData, store: TelemetryStore = localStorage): void {
  store.setItem(telemetryKey(gameId), JSON.stringify(data));
}
export function recordLocalSessionStart(gameId: string, now = Date.now(), store: TelemetryStore = localStorage): LocalTelemetryData {
  const current = loadLocalTelemetry(gameId, store);
  const next = { ...current, sessions: current.sessions + 1, lastStartedAt: now, lastActiveAt: now };
  saveLocalTelemetry(gameId, next, store); return next;
}
export function recordLocalFirstAction(gameId: string, now = Date.now(), store: TelemetryStore = localStorage): LocalTelemetryData {
  const current = loadLocalTelemetry(gameId, store);
  const next = { ...current, firstActions: current.firstActions + 1, lastActiveAt: now };
  saveLocalTelemetry(gameId, next, store); return next;
}
export function recordLocalActiveTime(gameId: string, deltaMs: number, now = Date.now(), store: TelemetryStore = localStorage): LocalTelemetryData {
  const current = loadLocalTelemetry(gameId, store);
  const next = { ...current, totalActiveMs: current.totalActiveMs + Math.max(0, Math.floor(finiteNonNegative(deltaMs))), lastActiveAt: now };
  saveLocalTelemetry(gameId, next, store); return next;
}
/** localStorage-only baseline; no network, cookies, account IDs, ad IDs, or fingerprinting. */
export function installLocalTelemetry(gameId: string): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;
  recordLocalSessionStart(gameId);
  let firstActionRecorded = false;
  let activeSince = document.visibilityState === "visible" ? performance.now() : null;
  const flushActive = () => {
    if (activeSince === null) return;
    const now = performance.now(); recordLocalActiveTime(gameId, now - activeSince); activeSince = null;
  };
  const markFirstAction = () => {
    if (firstActionRecorded) return;
    firstActionRecorded = true; recordLocalFirstAction(gameId);
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") activeSince = performance.now();
    else flushActive();
  };
  const onPageHide = () => flushActive();
  window.addEventListener("pointerdown", markFirstAction, { once: true, passive: true });
  window.addEventListener("keydown", markFirstAction, { once: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    flushActive();
    window.removeEventListener("pointerdown", markFirstAction);
    window.removeEventListener("keydown", markFirstAction);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
  };
}

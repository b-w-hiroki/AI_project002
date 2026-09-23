export type JaEnLang = "ja" | "en";

let portalLocale: string | undefined;

export function setPortalLocale(locale: string | null | undefined): void {
  portalLocale = locale?.trim() || undefined;
}

export function getPortalLocale(): string | undefined {
  return portalLocale;
}

export function resolveJaEnLang(
  search: string,
  browserLanguage: string,
  sdkLocale: string | undefined = portalLocale,
): JaEnLang {
  const forced = new URLSearchParams(search).get("lang");
  if (forced === "ja" || forced === "en") return forced;
  const preferred = sdkLocale || browserLanguage || "en";
  return preferred.toLowerCase().startsWith("ja") ? "ja" : "en";
}

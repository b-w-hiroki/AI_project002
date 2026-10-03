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
  _browserLanguage: string,
  sdkLocale: string | undefined = portalLocale,
): JaEnLang {
  const forced = new URLSearchParams(search).get("lang");
  if (forced === "ja" || forced === "en") return forced;
  if (sdkLocale) return sdkLocale.toLowerCase().startsWith("ja") ? "ja" : "en";
  return "ja";
}

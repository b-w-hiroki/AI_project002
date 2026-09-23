import { setPortalLocale } from "../../../shared/locale";

/**
 * CrazyGames SDK v3 の薄いラッパー。
 * SDK が無い環境（ローカル / PLiCy / GitHub Pages）では全メソッドが安全に no-op になる。
 * https://docs.crazygames.com/sdk/html5-v3/
 */

interface CrazyGamesSDK {
  init(): Promise<void>;
  user?: {
    systemInfo?: {
      locale?: string | null;
      language?: string | null;
    };
  };
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    loadingStart(): void;
    loadingStop(): void;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazyGamesSDK };
  }
}

let sdk: CrazyGamesSDK | null = null;

function isCrazyGamesRuntime(): boolean {
  if (window.CrazyGames) return true;
  if (/(^|\.)crazygames\.com$/i.test(window.location.hostname)) return true;
  return document.referrer.includes("crazygames.com");
}

/** SDK スクリプトを読み込んで初期化。失敗しても例外は出さない */
export async function initCrazyGames(): Promise<boolean> {
  try {
    if (!isCrazyGamesRuntime()) {
      sdk = null;
      setPortalLocale(undefined);
      return false;
    }
    if (!window.CrazyGames) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("SDK load failed"));
        document.head.appendChild(s);
      });
    }
    if (!window.CrazyGames) return false;
    sdk = window.CrazyGames.SDK;
    await sdk.init();
    const info = sdk.user?.systemInfo;
    setPortalLocale(info?.locale ?? info?.language);
    return true;
  } catch {
    sdk = null;
    setPortalLocale(undefined);
    return false;
  }
}

export const cg = {
  gameplayStart: () => sdk?.game.gameplayStart(),
  gameplayStop: () => sdk?.game.gameplayStop(),
  /** ポジティブな瞬間（購入成功など）に呼ぶとポータル側で演出・広告最適化に使われる */
  happytime: () => sdk?.game.happytime(),
  loadingStart: () => sdk?.game.loadingStart(),
  loadingStop: () => sdk?.game.loadingStop(),
};

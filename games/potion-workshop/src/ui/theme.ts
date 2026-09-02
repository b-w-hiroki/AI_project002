import Phaser from "phaser";

/**
 * 「ポーション工房」共通のビジュアルテーマ。既存コードは `add.rectangle().setFillStyle()` を
 * 多用しているため、それと同じ呼び出し感覚のまま角丸パネルに置き換えられる薄いユーティリティにした。
 */

/**
 * 「淡い青空・ファンタジー」トーン。ユーザーから「もっと明るいソシャゲ調に」との要望を受け、
 * 濃紺ベースの配色から水色〜白のグラデーションを基調にしたパステル系に刷新した。
 * パネルが明るくなった分、テキストは濃紺〜紺青系の暗色に統一している（明るい背景での可読性優先）。
 */
export const THEME = {
  panelFill: 0xf3f9ff,
  panelBorder: 0x9ecbef,
  accent: 0x2ba876,
  textPrimary: "#2d3a52",
  textMuted: "#7488a0",
} as const;

/**
 * 階層（エレベーション）カラー。背景／ゾーンパネル／カード の3段階で明度を変え、
 * 「今どの階層を見ているか」が色だけで判別できるようにする。数字が大きいほど手前＝明るい。
 */
export const ELEVATION = {
  bg: 0xcfe9ff,
  zone: 0xffffff, // セクションのグルーピング用パネル
  card: 0xeaf5ff, // ゾーン内の個別カード/行
} as const;

/** 4/8/16/24/32px の余白スケール。マジックナンバーの散在を避けるために使う */
export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

const FONT_FAMILY = '"Segoe UI", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif';

/**
 * タイポグラフィスケール。サイズ・太さ・字間をここに集約し、画面ごとにバラバラだった
 * フォント指定を統一する。見出し系は字間を少し広げて締まった印象にする。
 */
export const TYPE = {
  h1: { fontFamily: FONT_FAMILY, fontSize: "26px", fontStyle: "700", letterSpacing: 1 },
  h2: { fontFamily: FONT_FAMILY, fontSize: "16px", fontStyle: "700", letterSpacing: 0.5 },
  numeric: { fontFamily: FONT_FAMILY, fontSize: "22px", fontStyle: "800" },
  body: { fontFamily: FONT_FAMILY, fontSize: "13px", fontStyle: "500" },
  small: { fontFamily: FONT_FAMILY, fontSize: "11px", fontStyle: "500" },
} as const;

export interface RoundedRectOptions {
  radius?: number;
  borderColor?: number;
  borderWidth?: number;
  borderAlpha?: number;
  /** ホバー時に明るくする度合い(0-1)。0でホバー演出なし */
  hoverLighten?: number;
}

export type RoundedRect = Phaser.GameObjects.Graphics & {
  setFillStyle: (color: number, alpha?: number) => RoundedRect;
};

/** color1 と color2 を amount(0-1) で線形補間する */
function blend(color1: number, color2: number, amount: number): number {
  const c1 = Phaser.Display.Color.IntegerToColor(color1);
  const c2 = Phaser.Display.Color.IntegerToColor(color2);
  const r = Phaser.Math.Interpolation.Linear([c1.red, c2.red], amount);
  const g = Phaser.Math.Interpolation.Linear([c1.green, c2.green], amount);
  const b = Phaser.Math.Interpolation.Linear([c1.blue, c2.blue], amount);
  return Phaser.Display.Color.GetColor(r, g, b);
}

/**
 * 角丸の四角形ボタン/パネル。既存の `add.rectangle(...).setStrokeStyle(...).setInteractive(...)` と
 * 同じ感覚で使える（`.on(...)` / `.setFillStyle(color)` がそのまま動く）。
 * Graphics はローカル座標（中心が原点）で描画し、GameObject自体を (x, y) に配置しているため、
 * scaleX 等のtweenも中心基準で自然に動く。
 *
 * ホバー演出はこのヘルパー内部で完結させている。`refreshUI()` が毎フレーム `setFillStyle` で
 * 購入可否の色を上書きするため、呼び出し側でホバー色を単純に上書きすると次のフレームで
 * 即座に消えてしまう（ちらつく）。そのため「最後に指定された基準色」を内部に保持し、
 * ホバー中はその基準色を明るくブレンドして描画する方式にした。
 */
export function makeRoundedRect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: number,
  options: RoundedRectOptions = {},
): RoundedRect {
  const radius = options.radius ?? 10;
  const borderColor = options.borderColor ?? THEME.panelBorder;
  const borderWidth = options.borderWidth ?? 2;
  const borderAlpha = options.borderAlpha ?? 0.9;
  const hoverLighten = options.hoverLighten ?? 0.12;

  const g = scene.add.graphics({ x, y }) as RoundedRect;
  let baseColor = fillColor;
  let baseAlpha = 1;
  let hovering = false;

  const paint = () => {
    // 明るい配色では白方向へのブレンドがほぼ効かないため、ホバー時は水色方向へブレンドして視認性を出す
    const color = hovering && hoverLighten > 0 ? blend(baseColor, 0x8ecbf5, hoverLighten * 1.6) : baseColor;
    g.clear();
    g.fillStyle(color, baseAlpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    // 上部のガラス風ハイライト帯
    g.fillStyle(0xffffff, hovering ? 0.55 : 0.4);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, Math.max(4, h * 0.25), radius * 0.7);
    if (borderWidth > 0) {
      g.lineStyle(borderWidth, borderColor, hovering ? Math.min(1, borderAlpha + 0.15) : borderAlpha);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    }
  };
  paint();
  g.setFillStyle = (color: number, alpha = 1) => {
    baseColor = color;
    baseAlpha = alpha;
    paint();
    return g;
  };

  g.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  if (g.input) g.input.cursor = "pointer";
  if (hoverLighten > 0) {
    g.on("pointerover", () => {
      hovering = true;
      paint();
    });
    g.on("pointerout", () => {
      hovering = false;
      paint();
    });
  }

  return g;
}

/** 装飾専用（非インタラクティブ）の角丸パネル。モーダルや背景ボックスに使う */
export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  options: RoundedRectOptions & { fillColor?: number; fillAlpha?: number; shadow?: boolean } = {},
): Phaser.GameObjects.Graphics {
  const radius = options.radius ?? 16;
  const g = scene.add.graphics();
  if (options.shadow !== false) {
    g.fillStyle(0x9db8d6, 0.4);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, radius);
  }
  g.fillStyle(options.fillColor ?? THEME.panelFill, options.fillAlpha ?? 0.95);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.4);
  g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(6, h * 0.2), radius * 0.7);
  g.lineStyle(options.borderWidth ?? 2, options.borderColor ?? 0xb98af0, options.borderAlpha ?? 0.8);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  return g;
}

/**
 * 表示値を実際の値へ指数的に近づけていく「なめらかなカウンター」。
 * 放置ゲームの生産量表示のように毎フレーム値が変わるものに使うと、瞬間的なジャンプではなく
 * 滑らかに数字が動く感覚になる。呼び出し側は毎フレーム `next(target, delta)` を呼ぶだけでよい。
 */
export class SmoothedCounter {
  private displayed: number;
  constructor(
    initial: number,
    private readonly speed = 6, // 大きいほど素早く追従する
  ) {
    this.displayed = initial;
  }

  next(target: number, deltaSec: number): number {
    const diff = target - this.displayed;
    if (Math.abs(diff) < Math.max(0.5, target * 0.0005)) {
      this.displayed = target;
    } else {
      this.displayed += diff * Math.min(1, this.speed * deltaSec);
    }
    return this.displayed;
  }
}

/**
 * フラスコのシルエットアイコンをGraphicsで描画する。絵文字はOS/フォント依存で
 * 環境によって表示が崩れる（豆腐化）ため、ブランドの顔であるタイトル横のアイコンは
 * 自前描画にして見た目を環境非依存にする。(x, y) はアイコン中心。
 */
export function drawFlaskIcon(scene: Phaser.Scene, x: number, y: number, size = 20): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const neckW = size * 0.22;
  const neckH = size * 0.32;
  const bodyR = size * 0.42;
  g.fillStyle(0x9d5fd6, 0.25);
  g.fillCircle(0, size * 0.12, bodyR + 3);
  g.lineStyle(2, THEME.accent, 0.95);
  g.beginPath();
  g.moveTo(-neckW / 2, -size / 2);
  g.lineTo(-neckW / 2, -size / 2 + neckH);
  g.lineTo(-bodyR, size * 0.12 + bodyR * 0.6);
  g.arc(0, size * 0.12, bodyR, Phaser.Math.DegToRad(150), Phaser.Math.DegToRad(30), true);
  g.lineTo(neckW / 2, -size / 2 + neckH);
  g.lineTo(neckW / 2, -size / 2);
  g.strokePath();
  g.lineStyle(2, THEME.accent, 0.95);
  g.strokeLineShape(new Phaser.Geom.Line(-neckW / 2 - 3, -size / 2, neckW / 2 + 3, -size / 2));
  g.fillStyle(0x4ecca3, 0.85);
  g.fillCircle(-bodyR * 0.3, size * 0.28, size * 0.09);
  g.fillCircle(bodyR * 0.15, size * 0.4, size * 0.06);
  return g;
}

export interface ProgressBar {
  /** 進捗(フィル)側のGraphics。表示/非表示の切替はこちらで行う */
  graphics: Phaser.GameObjects.Graphics;
  /** 下地(トラック)側のGraphics。Containerへ移す等、2枚まとめて扱う時に使う */
  track: Phaser.GameObjects.Graphics;
  /** ratio(0-1)で塗りつぶし量を更新する。ratio自体はサチュレーションしないので呼び出し側で0-1にクランプすること */
  setRatio: (ratio: number) => void;
}

/**
 * 横向きのプログレスバー。(x, y)は中央左寄せではなく中心。トラック(下地)とフィル(進捗)の
 * 2枚のGraphicsで構成し、`setRatio`で再描画コストの低い更新ができるようにする。
 */
export function drawProgressBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  options: { trackColor?: number; fillColor?: number; radius?: number } = {},
): ProgressBar {
  const radius = options.radius ?? h / 2;
  const track = scene.add.graphics({ x, y });
  track.fillStyle(options.trackColor ?? 0xdde9f5, 1);
  track.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  track.lineStyle(1, THEME.panelBorder, 0.6);
  track.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

  const fill = scene.add.graphics({ x: x - w / 2, y });
  const fillColor = options.fillColor ?? THEME.accent;
  const paint = (r: number) => {
    const clamped = Phaser.Math.Clamp(r, 0, 1);
    fill.clear();
    if (clamped <= 0) return;
    fill.fillStyle(fillColor, 1);
    fill.fillRoundedRect(0, -h / 2, Math.max(clamped * w, h), h, Math.min(radius, (clamped * w) / 2 || radius));
  };
  paint(ratio);

  return { graphics: fill, track, setRatio: paint };
}

/**
 * スピーカーアイコンをGraphicsで描画する。🔊/🔇絵文字はこの環境で潰れて表示されることを
 * 確認したため、フラスコアイコンと同じ理由でオリジナル描画に置き換える。onなら音波を、
 * offなら✕を添えて状態を表す。(x, y) はアイコン中心。
 */
export function drawSpeakerIcon(scene: Phaser.Scene, x: number, y: number, on: boolean, size = 16): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const color = on ? THEME.textPrimary : "#666688";
  const c = Phaser.Display.Color.ValueToColor(color).color;
  g.fillStyle(c, 1);
  const bodyW = size * 0.28;
  const bodyH = size * 0.4;
  g.fillRect(-size / 2, -bodyH / 2, bodyW, bodyH);
  g.fillTriangle(
    -size / 2 + bodyW,
    -bodyH / 2,
    -size / 2 + bodyW,
    bodyH / 2,
    -size / 2 + bodyW + size * 0.32,
    -size * 0.55,
  );
  g.fillTriangle(
    -size / 2 + bodyW,
    -bodyH / 2,
    -size / 2 + bodyW,
    bodyH / 2,
    -size / 2 + bodyW + size * 0.32,
    size * 0.55,
  );
  g.lineStyle(2, c, 1);
  if (on) {
    g.beginPath();
    g.arc(-size / 2 + bodyW + size * 0.1, 0, size * 0.34, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(40));
    g.strokePath();
  } else {
    const cx = size * 0.22;
    g.strokeLineShape(new Phaser.Geom.Line(cx - 5, -5, cx + 5, 5));
    g.strokeLineShape(new Phaser.Geom.Line(cx - 5, 5, cx + 5, -5));
  }
  return g;
}

/** 稲妻アイコン（クリック強化用）。絵文字⚡はフォント依存で崩れうるためGraphics描画にする */
export function drawBoltIcon(scene: Phaser.Scene, x: number, y: number, size = 16, color = 0xc98a12): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(size * 0.12, -size * 0.5);
  g.lineTo(-size * 0.28, size * 0.08);
  g.lineTo(size * 0.02, size * 0.08);
  g.lineTo(-size * 0.12, size * 0.5);
  g.lineTo(size * 0.32, -size * 0.12);
  g.lineTo(size * 0.02, -size * 0.12);
  g.closePath();
  g.fillPath();
  return g;
}

/** 砂時計アイコン（放置上限拡張用） */
export function drawHourglassIcon(scene: Phaser.Scene, x: number, y: number, size = 16, color = 0x2f8fd1): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const w = size * 0.42;
  const h = size * 0.5;
  g.fillStyle(color, 1);
  g.fillTriangle(-w, -h, w, -h, 0, 0);
  g.fillTriangle(-w, h, w, h, 0, 0);
  g.lineStyle(Math.max(1.5, size * 0.1), color, 1);
  g.strokeLineShape(new Phaser.Geom.Line(-w, -h, w, -h));
  g.strokeLineShape(new Phaser.Geom.Line(-w, h, w, h));
  return g;
}

/** 4方向にとがった星（キラキラ）アイコン（転生用） */
export function drawSparkleIcon(scene: Phaser.Scene, x: number, y: number, size = 16, color = 0x8a4fd1): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(color, 1);
  const s = size * 0.5;
  const inner = s * 0.28;
  g.beginPath();
  g.moveTo(0, -s);
  g.lineTo(inner, -inner);
  g.lineTo(s, 0);
  g.lineTo(inner, inner);
  g.lineTo(0, s);
  g.lineTo(-inner, inner);
  g.lineTo(-s, 0);
  g.lineTo(-inner, -inner);
  g.closePath();
  g.fillPath();
  return g;
}

/**
 * アクションカードの見た目モード。
 * - idle:  購入不可（通常）。白系グラデーション + 淡いアクセント
 * - ready: 購入可能。アクセント色に寄せたグラデーション + 外側にソフトグロー
 * - hero:  特別状態（転生可能など）。アクセント色ベタ塗りの濃色カード + 白文字
 * - muted: 上限到達など操作できない状態。灰色寄せ
 */
export type CardMood = "idle" | "ready" | "hero" | "muted";

export interface ActionCard {
  container: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  /** 右側のコストピル内テキスト。setCostで更新する */
  costText: Phaser.GameObjects.Text;
  /** カード内の左端(テキスト開始)と右端のローカルX。進捗バー等を追加配置する時の目安 */
  contentLeft: number;
  contentRight: number;
  setMood: (mood: CardMood) => void;
  /** nullでピルを隠す */
  setCost: (text: string | null) => void;
  /** タップ時の押し込み演出 */
  press: () => void;
}

/**
 * 「アイコン + 見出し + 説明 + 右側コストピル」で構成される操作カード。
 * クリック強化 / 放置上限拡張 / 転生の3パネルを、単色枠+中央寄せテキストの単調な見た目から
 * カード型UIへ刷新するために追加した。
 *
 * - 全要素をContainerに入れ、押下時のスケール演出・ホバー演出がカード全体に一括で掛かるようにする
 * - テキストは左寄せ・固定X開始にし、日英切り替えで文字列長が変わってもピルやアイコンと
 *   重ならないよう `contentLeft`〜`contentRight` の範囲に収める（呼び出し側でwordWrap幅に使う）
 * - グラデーションは WebGL でのみ有効。Canvasレンダラーでは先頭色の単色塗りにフォールバックする
 *   （Phaser標準挙動）ため、どちらでも成立する配色にしている
 */
export function makeActionCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  drawIcon: (scene: Phaser.Scene, x: number, y: number, size: number, color: number) => Phaser.GameObjects.Graphics,
  options: { radius?: number } = {},
): ActionCard {
  const radius = options.radius ?? 14;
  const iconR = Math.min(22, h * 0.34);
  const iconX = -w / 2 + 12 + iconR;
  const contentLeft = iconX + iconR + 12;
  const contentRight = w / 2 - 12;
  const pillH = 22;

  const bg = scene.add.graphics();
  const disc = scene.add.graphics();
  const icon = drawIcon(scene, iconX, 0, iconR * 1.05, 0xffffff);
  const title = scene.add
    .text(contentLeft, -h * 0.18, "", { ...TYPE.body, fontStyle: "700", color: THEME.textPrimary })
    .setOrigin(0, 0.5);
  const sub = scene.add
    .text(contentLeft, h * 0.16, "", { ...TYPE.small, color: THEME.textMuted })
    .setOrigin(0, 0.5);
  const pill = scene.add.graphics();
  const costText = scene.add
    .text(contentRight - 9, 0, "", { ...TYPE.small, fontStyle: "700" })
    .setOrigin(1, 0.5);

  const container = scene.add.container(x, y, [bg, disc, icon, title, sub, pill, costText]);
  container.setSize(w, h);
  container.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  if (container.input) container.input.cursor = "pointer";

  let mood: CardMood = "idle";
  let hovering = false;
  let cost: string | null = null;

  const paint = () => {
    const hero = mood === "hero";
    const ready = mood === "ready";
    const muted = mood === "muted";

    // 本体
    bg.clear();
    // Canvasレンダラーではグラデーション非対応で先頭色(top)の単色になるため、topだけでも成立する色にする
    const top = hero ? blend(accent, 0x000000, 0.08) : ready ? blend(accent, 0xffffff, 0.9) : 0xffffff;
    const bottom = hero
      ? blend(accent, 0x000000, 0.3)
      : ready
        ? blend(accent, 0xffffff, 0.76)
        : muted
          ? 0xeceff3
          : 0xf3f6fa;
    if (ready || hero) {
      // 外側のソフトグロー
      bg.lineStyle(6, accent, hero ? 0.28 : 0.16);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    }
    bg.fillGradientStyle(top, top, bottom, bottom, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    // ガラス風ハイライト
    bg.fillStyle(0xffffff, hero ? 0.14 : 0.5);
    bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, Math.max(6, h * 0.3), radius * 0.8);
    if (hovering) {
      bg.fillStyle(0xffffff, hero ? 0.1 : 0.25);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    }
    // 左端のアクセントストライプ（ヒーロー時は白）
    bg.fillStyle(hero ? 0xffffff : accent, muted ? 0.35 : hero ? 0.6 : 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2 + 8, 4, h - 16, 2);
    bg.lineStyle(1.5, hero ? 0xffffff : ready ? accent : THEME.panelBorder, hero ? 0.55 : ready ? 0.9 : 0.8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

    // アイコン円
    disc.clear();
    const discColor = muted ? 0xb0bcc8 : hero ? 0xffffff : accent;
    disc.fillStyle(discColor, hero ? 0.22 : ready || muted ? 1 : 0.55);
    disc.fillCircle(iconX, 0, iconR);
    if (ready) {
      disc.lineStyle(2, 0xffffff, 0.7);
      disc.strokeCircle(iconX, 0, iconR - 1);
    }

    // 文字色
    title.setColor(hero ? "#ffffff" : muted ? "#7a8794" : THEME.textPrimary);
    sub.setColor(hero ? "#efe4ff" : THEME.textMuted);

    // コストピル
    pill.clear();
    if (cost === null) {
      costText.setVisible(false);
      return;
    }
    costText.setVisible(true);
    const pillW = costText.width + 18;
    const pillX = contentRight - pillW;
    if (hero) {
      pill.fillStyle(0xffd76a, 1);
      costText.setColor("#4a2d00");
    } else if (ready) {
      pill.fillStyle(accent, 1);
      costText.setColor("#ffffff");
    } else {
      pill.fillStyle(0xffffff, 0.75);
      pill.lineStyle(1, THEME.panelBorder, 0.9);
      costText.setColor(muted ? "#9aa6b2" : "#6b7a8a");
    }
    pill.fillRoundedRect(pillX, -pillH / 2, pillW, pillH, pillH / 2);
    if (!hero && !ready) pill.strokeRoundedRect(pillX, -pillH / 2, pillW, pillH, pillH / 2);
  };

  container.on("pointerover", () => {
    hovering = true;
    paint();
  });
  container.on("pointerout", () => {
    hovering = false;
    paint();
  });
  paint();

  return {
    container,
    title,
    sub,
    costText,
    contentLeft,
    contentRight,
    setMood: (m) => {
      if (m === mood) return;
      mood = m;
      paint();
    },
    setCost: (text) => {
      if (text === cost) return;
      cost = text;
      if (text !== null) costText.setText(text);
      paint();
    },
    press: () => {
      scene.tweens.killTweensOf(container);
      container.setScale(1);
      scene.tweens.add({ targets: container, scale: 0.96, duration: 70, yoyo: true, ease: "Sine.easeOut" });
    },
  };
}

/** テキストの値が変わった時だけ、軽くポップさせて変化に気付きやすくする */
export function popOnChange(scene: Phaser.Scene, target: Phaser.GameObjects.Text, newText: string): void {
  if (target.text === newText) return;
  target.setText(newText);
  scene.tweens.add({ targets: target, scale: 1.15, duration: 90, yoyo: true, ease: "Sine.easeOut" });
}

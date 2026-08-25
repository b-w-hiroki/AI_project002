import Phaser from "phaser";

/**
 * 「ポーション工房」共通のビジュアルテーマ。既存コードは `add.rectangle().setFillStyle()` を
 * 多用しているため、それと同じ呼び出し感覚のまま角丸パネルに置き換えられる薄いユーティリティにした。
 */

export const THEME = {
  panelFill: 0x181830,
  panelBorder: 0x44446a,
  accent: 0x4ecca3,
  textPrimary: "#e0e0ff",
  textMuted: "#8888aa",
} as const;

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
    const color = hovering && hoverLighten > 0 ? blend(baseColor, 0xffffff, hoverLighten) : baseColor;
    g.clear();
    g.fillStyle(color, baseAlpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    // 上部のガラス風ハイライト帯
    g.fillStyle(0xffffff, hovering ? 0.09 : 0.05);
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
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, radius);
  }
  g.fillStyle(options.fillColor ?? THEME.panelFill, options.fillAlpha ?? 0.95);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.05);
  g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(6, h * 0.2), radius * 0.7);
  g.lineStyle(options.borderWidth ?? 2, options.borderColor ?? 0x7b2cbf, options.borderAlpha ?? 0.8);
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

/** テキストの値が変わった時だけ、軽くポップさせて変化に気付きやすくする */
export function popOnChange(scene: Phaser.Scene, target: Phaser.GameObjects.Text, newText: string): void {
  if (target.text === newText) return;
  target.setText(newText);
  scene.tweens.add({ targets: target, scale: 1.15, duration: 90, yoyo: true, ease: "Sine.easeOut" });
}

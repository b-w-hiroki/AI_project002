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

export interface RoundedRectOptions {
  radius?: number;
  borderColor?: number;
  borderWidth?: number;
  borderAlpha?: number;
}

export type RoundedRect = Phaser.GameObjects.Graphics & {
  setFillStyle: (color: number, alpha?: number) => RoundedRect;
};

/**
 * 角丸の四角形ボタン/パネル。既存の `add.rectangle(...).setStrokeStyle(...).setInteractive(...)` と
 * 同じ感覚で使える（`.on(...)` / `.setFillStyle(color)` がそのまま動く）。
 * Graphics はローカル座標（中心が原点）で描画し、GameObject自体を (x, y) に配置しているため、
 * scaleX 等のtweenも中心基準で自然に動く。
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

  const g = scene.add.graphics({ x, y }) as RoundedRect;

  const redraw = (color: number, alpha = 1): RoundedRect => {
    g.clear();
    g.fillStyle(color, alpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    // 上部のガラス風ハイライト帯
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, Math.max(4, h * 0.25), radius * 0.7);
    if (borderWidth > 0) {
      g.lineStyle(borderWidth, borderColor, borderAlpha);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    }
    return g;
  };
  redraw(fillColor);
  g.setFillStyle = redraw;

  g.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  if (g.input) g.input.cursor = "pointer";

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

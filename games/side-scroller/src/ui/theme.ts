import Phaser from "phaser";

/**
 * 「剣戟の森」共通のビジュアルテーマ。角丸パネル・グロー枠・ホバー/押下フィードバック付きボタンを
 * Graphics ベースで組み立てる。既存の `add.rectangle` フラット塗りより一段モダンな見た目にするための
 * 薄いユーティリティで、ロジック側には一切踏み込まない。
 */

export const THEME = {
  panelFill: 0x181830,
  panelFillAlt: 0x1e1e3a,
  panelBorder: 0x4a4a72,
  shadow: 0x000000,
  accent: 0xff6b8a,
  accentSoft: 0xffb3c1,
  textPrimary: "#f0f0ff",
  textMuted: "#9a9ac0",
} as const;

/**
 * 階層（エレベーション）カラー。背景／ゾーンパネル／カード の3段階で明度を変え、
 * 「今どの階層を見ているか」が色だけで判別できるようにする（ポーション工房と共通の考え方）。
 */
export const ELEVATION = {
  bg: 0x0a0a18,
  zone: 0x181c38,
  card: 0x242850,
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

/** テキストの値が変わった時だけ、軽くポップさせて変化に気付きやすくする */
export function popOnChange(scene: Phaser.Scene, target: Phaser.GameObjects.Text, newText: string): void {
  if (target.text === newText) return;
  target.setText(newText);
  scene.tweens.add({ targets: target, scale: 1.15, duration: 90, yoyo: true, ease: "Sine.easeOut" });
}

export interface PanelOptions {
  radius?: number;
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  borderAlpha?: number;
  borderWidth?: number;
  shadow?: boolean;
  depth?: number;
  scrollFactor?: number;
}

/**
 * 角丸パネル。下寄りに柔らかい影、上部にわずかなハイライト帯を重ねてガラス調の質感を出す。
 * (x, y) はパネル中心。
 */
export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  options: PanelOptions = {},
): Phaser.GameObjects.Graphics {
  const radius = options.radius ?? 14;
  const g = scene.add.graphics();
  if (options.scrollFactor !== undefined) g.setScrollFactor(options.scrollFactor);
  if (options.depth !== undefined) g.setDepth(options.depth);

  if (options.shadow !== false) {
    g.fillStyle(THEME.shadow, 0.35);
    g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 4, w, h, radius);
  }

  g.fillStyle(options.fillColor ?? THEME.panelFill, options.fillAlpha ?? 0.92);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);

  // 上部のガラス風ハイライト帯
  g.fillStyle(0xffffff, 0.05);
  g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(6, h * 0.28), radius * 0.8);

  g.lineStyle(options.borderWidth ?? 1.5, options.borderColor ?? THEME.panelBorder, options.borderAlpha ?? 0.9);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  return g;
}

export interface ButtonOptions {
  radius?: number;
  fillColor?: number;
  hoverColor?: number;
  pressColor?: number;
  disabledColor?: number;
  borderColor?: number;
  textColor?: string;
  fontSize?: string;
  fontStyle?: string;
}

export interface ThemedButton {
  container: Phaser.GameObjects.Container;
  setLabel: (text: string) => void;
  setEnabled: (enabled: boolean) => void;
}

/**
 * 角丸＋ホバー/押下フィードバック付きのボタン。(x, y) は中心。
 * pointerover/out/down/up で塗りを切り替え、押下時はわずかに縮小してタップ感を出す。
 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): ThemedButton {
  const radius = options.radius ?? 10;
  const fill = options.fillColor ?? 0x2a2a4a;
  const hover = options.hoverColor ?? blend(fill, 0xffffff, 0.12);
  const press = options.pressColor ?? blend(fill, 0x000000, 0.2);
  const disabledColor = options.disabledColor ?? 0x25253a;

  const g = scene.add.graphics();
  const draw = (color: number, alpha = 1) => {
    g.clear();
    g.fillStyle(color, alpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.lineStyle(1.5, options.borderColor ?? 0xffffff, 0.14);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  };
  draw(fill);

  const text = scene.add
    .text(0, 0, label, {
      fontSize: options.fontSize ?? "14px",
      color: options.textColor ?? THEME.textPrimary,
      fontStyle: options.fontStyle ?? "600",
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [g, text]).setSize(w, h);
  let enabled = true;

  container.setInteractive({ useHandCursor: true });
  container.on("pointerover", () => enabled && draw(hover));
  container.on("pointerout", () => enabled && draw(fill));
  container.on("pointerdown", () => {
    if (!enabled) return;
    draw(press);
    scene.tweens.add({ targets: container, scale: 0.96, duration: 60, yoyo: true });
    onClick();
  });
  container.on("pointerup", () => enabled && draw(hover));

  return {
    container,
    setLabel: (t: string) => text.setText(t),
    setEnabled: (want: boolean) => {
      enabled = want;
      draw(want ? fill : disabledColor);
      text.setAlpha(want ? 1 : 0.5);
      container.disableInteractive();
      if (want) container.setInteractive({ useHandCursor: true });
    },
  };
}

/** color1 と color2 を amount(0-1) で線形補間する */
function blend(color1: number, color2: number, amount: number): number {
  const c1 = Phaser.Display.Color.IntegerToColor(color1);
  const c2 = Phaser.Display.Color.IntegerToColor(color2);
  const r = Phaser.Math.Interpolation.Linear([c1.red, c2.red], amount);
  const g = Phaser.Math.Interpolation.Linear([c1.green, c2.green], amount);
  const b = Phaser.Math.Interpolation.Linear([c1.blue, c2.blue], amount);
  return Phaser.Display.Color.GetColor(r, g, b);
}

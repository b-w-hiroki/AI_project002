import Phaser from "phaser";

/**
 * 「カラーマッチ」共通のビジュアルテーマ。角丸パネル・ホバー/押下フィードバック付きボタンを
 * Graphics ベースで組み立てる。他2作（ポーション工房/剣戟の森）と同じ「淡い青空」トーンの
 * 薄いユーティリティで、ロジック側には一切踏み込まない。
 */
export const THEME = {
  panelFill: 0xfffaf0,
  panelBorder: 0xe8d9b0,
  shadow: 0xd8c9a0,
  textPrimary: "#3a2e1f",
  textMuted: "#8a7a5c",
} as const;

export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

const FONT_FAMILY = '"Segoe UI", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif';

export const TYPE = {
  h1: { fontFamily: FONT_FAMILY, fontSize: "26px", fontStyle: "700", letterSpacing: 1 },
  h2: { fontFamily: FONT_FAMILY, fontSize: "16px", fontStyle: "700", letterSpacing: 0.5 },
  numeric: { fontFamily: FONT_FAMILY, fontSize: "40px", fontStyle: "800" },
  body: { fontFamily: FONT_FAMILY, fontSize: "14px", fontStyle: "500" },
  small: { fontFamily: FONT_FAMILY, fontSize: "12px", fontStyle: "500" },
} as const;

export interface PanelOptions {
  radius?: number;
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  borderAlpha?: number;
  borderWidth?: number;
  shadow?: boolean;
  depth?: number;
}

/** 角丸パネル。(x, y) はパネル中心 */
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
  if (options.depth !== undefined) g.setDepth(options.depth);

  if (options.shadow !== false) {
    g.fillStyle(THEME.shadow, 0.38);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w, h, radius);
  }

  g.fillStyle(options.fillColor ?? THEME.panelFill, options.fillAlpha ?? 0.97);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.68);
  g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(8, h * 0.18), radius * 0.75);

  g.lineStyle(options.borderWidth ?? 2, options.borderColor ?? THEME.panelBorder, options.borderAlpha ?? 0.94);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(1, 0xffffff, 0.72);
  g.strokeRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, Math.max(4, radius - 3));
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

/** 影・上面ハイライト・底面エッジを持つ、押せるゲームボタン。(x, y) は中心 */
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
  const fill = options.fillColor ?? 0xf3ead7;
  const hover = options.hoverColor ?? blend(fill, 0xf2c14e, 0.38);
  const press = options.pressColor ?? blend(fill, 0x6a4d22, 0.16);
  const disabledColor = options.disabledColor ?? 0xe4ddd0;

  const g = scene.add.graphics();
  const draw = (color: number, alpha = 1, active = false) => {
    g.clear();
    g.fillStyle(0x7b5a32, active ? 0.14 : 0.22);
    g.fillRoundedRect(-w / 2 + 1, -h / 2 + 4, w - 2, h, radius);
    g.fillStyle(color, alpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.fillStyle(0xffffff, active ? 0.55 : 0.74);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, Math.max(6, h * 0.3), radius * 0.72);
    g.fillStyle(0xb98a3f, active ? 0.08 : 0.13);
    g.fillRoundedRect(-w / 2 + 3, h / 2 - 7, w - 6, 5, 3);
    g.lineStyle(active ? 2.5 : 2, options.borderColor ?? THEME.panelBorder, active ? 1 : 0.92);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.lineStyle(1, 0xffffff, active ? 0.66 : 0.88);
    g.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, Math.max(4, radius - 3));
  };
  draw(fill);

  const text = scene.add
    .text(0, -1, label, {
      fontFamily: FONT_FAMILY,
      fontSize: options.fontSize ?? "14px",
      color: options.textColor ?? THEME.textPrimary,
      fontStyle: options.fontStyle ?? "800",
      letterSpacing: 0.3,
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [g, text]).setSize(w, h);
  let enabled = true;

  container.setInteractive({ useHandCursor: true });
  container.on("pointerover", () => enabled && draw(hover, 1, true));
  container.on("pointerout", () => enabled && draw(fill));
  container.on("pointerdown", () => {
    if (!enabled) return;
    draw(press, 1, true);
    scene.tweens.add({ targets: container, scaleX: 0.965, scaleY: 0.94, duration: 55, yoyo: true, ease: "Quad.easeOut" });
    onClick();
  });
  container.on("pointerup", () => enabled && draw(hover, 1, true));

  return {
    container,
    setLabel: (t: string) => text.setText(t),
    setEnabled: (want: boolean) => {
      enabled = want;
      draw(want ? fill : disabledColor, want ? 1 : 0.85);
      text.setAlpha(want ? 1 : 0.45);
      container.disableInteractive();
      if (want) container.setInteractive({ useHandCursor: true });
    },
  };
}

function blend(color1: number, color2: number, amount: number): number {
  const c1 = Phaser.Display.Color.IntegerToColor(color1);
  const c2 = Phaser.Display.Color.IntegerToColor(color2);
  const r = Phaser.Math.Interpolation.Linear([c1.red, c2.red], amount);
  const g = Phaser.Math.Interpolation.Linear([c1.green, c2.green], amount);
  const b = Phaser.Math.Interpolation.Linear([c1.blue, c2.blue], amount);
  return Phaser.Display.Color.GetColor(r, g, b);
}

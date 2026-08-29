import Phaser from "phaser";

/**
 * 「三国ポチポチ」共通のビジュアルテーマ。朱色〜金の配色で三国志らしい世界観を表す。
 * 角丸パネル・ボタンのユーティリティは他作と共通構成。
 */
export const THEME = {
  panelFill: 0x2a1a14,
  panelBorder: 0xd9974a,
  shadow: 0x000000,
  accent: 0xd94a3d,
  textPrimary: "#f5e6d3",
  textMuted: "#c2a68a",
} as const;

export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

const FONT_FAMILY = '"Segoe UI", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif';

export const TYPE = {
  h1: { fontFamily: FONT_FAMILY, fontSize: "28px", fontStyle: "800", letterSpacing: 1 },
  h2: { fontFamily: FONT_FAMILY, fontSize: "16px", fontStyle: "700", letterSpacing: 0.5 },
  numeric: { fontFamily: FONT_FAMILY, fontSize: "22px", fontStyle: "800" },
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
    g.fillStyle(THEME.shadow, 0.35);
    g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 4, w, h, radius);
  }

  g.fillStyle(options.fillColor ?? THEME.panelFill, options.fillAlpha ?? 0.95);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);

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

/** 角丸＋ホバー/押下フィードバック付きのボタン。(x, y) は中心 */
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
  const fill = options.fillColor ?? 0x3a2418;
  const hover = options.hoverColor ?? blend(fill, THEME.accent, 0.35);
  const press = options.pressColor ?? blend(fill, 0x000000, 0.2);
  const disabledColor = options.disabledColor ?? 0x2a2a2a;

  const g = scene.add.graphics();
  const draw = (color: number, alpha = 1) => {
    g.clear();
    g.fillStyle(color, alpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.lineStyle(1.5, options.borderColor ?? THEME.panelBorder, 0.7);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  };
  draw(fill);

  const text = scene.add
    .text(0, 0, label, {
      fontSize: options.fontSize ?? "14px",
      color: options.textColor ?? THEME.textPrimary,
      fontStyle: options.fontStyle ?? "700",
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

/**
 * スピーカーアイコンをGraphicsで描画する。🔊/🔇絵文字はヘッドレスChromium環境で
 * 潰れて表示されることが判明しているため、オリジナル描画に置き換える。
 * onなら音波を、offなら✕を添えて状態を表す。(x, y) はアイコン中心。
 */
export function drawSpeakerIcon(scene: Phaser.Scene, x: number, y: number, on: boolean, size = 16): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const color = on ? THEME.textPrimary : "#7a6a5a";
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

function blend(color1: number, color2: number, amount: number): number {
  const c1 = Phaser.Display.Color.IntegerToColor(color1);
  const c2 = Phaser.Display.Color.IntegerToColor(color2);
  const r = Phaser.Math.Interpolation.Linear([c1.red, c2.red], amount);
  const g = Phaser.Math.Interpolation.Linear([c1.green, c2.green], amount);
  const b = Phaser.Math.Interpolation.Linear([c1.blue, c2.blue], amount);
  return Phaser.Display.Color.GetColor(r, g, b);
}

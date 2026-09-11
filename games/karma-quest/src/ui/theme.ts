import Phaser from "phaser";

/**
 * 「カルマクエスト」共通のビジュアルテーマ。落ち着いた深緑〜金の配色で、
 * 神話・お伽噺めいた育成RPGの世界観を表す。角丸パネル・ボタンのユーティリティは他作と共通構成。
 */
export const THEME = {
  panelFill: 0x1f3a30,
  panelBorder: 0xd9b45a,
  shadow: 0x000000,
  accent: 0xd9b45a,
  textPrimary: "#f2ecd9",
  textMuted: "#a9bfae",
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
    g.fillStyle(THEME.shadow, 0.42);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w, h, radius);
  }

  g.fillStyle(options.fillColor ?? THEME.panelFill, options.fillAlpha ?? 0.96);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.055);
  g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(8, h * 0.18), radius * 0.75);

  g.lineStyle(options.borderWidth ?? 2, options.borderColor ?? THEME.panelBorder, options.borderAlpha ?? 0.92);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(1, 0xffffff, 0.07);
  g.strokeRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, Math.max(4, radius - 3));
  g.lineStyle(2, THEME.accent, 0.7);
  g.lineBetween(x - w / 2 + 14, y - h / 2 + 1, x - w / 2 + 42, y - h / 2 + 1);
  g.lineBetween(x + w / 2 - 42, y + h / 2 - 1, x + w / 2 - 14, y + h / 2 - 1);
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

/** 立体的な縁・上面ハイライト・押下フィードバック付きのゲームボタン。(x, y) は中心 */
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
  const fill = options.fillColor ?? 0x2c4a3c;
  const hover = options.hoverColor ?? blend(fill, THEME.accent, 0.3);
  const press = options.pressColor ?? blend(fill, 0x000000, 0.2);
  const disabledColor = options.disabledColor ?? 0x2a2a2a;

  const g = scene.add.graphics();
  const draw = (color: number, alpha = 1, active = false) => {
    g.clear();
    g.fillStyle(0x000000, active ? 0.24 : 0.38);
    g.fillRoundedRect(-w / 2 + 1, -h / 2 + 4, w - 2, h, radius);
    g.fillStyle(color, alpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.fillStyle(0xffffff, active ? 0.1 : 0.07);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, Math.max(6, h * 0.28), radius * 0.72);
    g.fillStyle(0x000000, active ? 0.1 : 0.18);
    g.fillRoundedRect(-w / 2 + 3, h / 2 - 7, w - 6, 5, 3);
    g.lineStyle(active ? 2.5 : 2, options.borderColor ?? THEME.panelBorder, active ? 1 : 0.84);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.lineStyle(1, 0xffffff, active ? 0.12 : 0.07);
    g.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, Math.max(4, radius - 3));
  };
  draw(fill);

  const text = scene.add
    .text(0, -1, label, {
      fontFamily: FONT_FAMILY,
      fontSize: options.fontSize ?? "14px",
      color: options.textColor ?? THEME.textPrimary,
      fontStyle: options.fontStyle ?? "800",
      letterSpacing: 0.35,
      stroke: "#0b1711",
      strokeThickness: 2,
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
      draw(want ? fill : disabledColor, want ? 1 : 0.8);
      text.setAlpha(want ? 1 : 0.45);
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
  const color = on ? THEME.textPrimary : "#5a6b62";
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

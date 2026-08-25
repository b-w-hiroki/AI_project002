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

/**
 * 階層（エレベーション）カラー。背景／ゾーンパネル／カード の3段階で明度を変え、
 * 「今どの階層を見ているか」が色だけで判別できるようにする。数字が大きいほど手前＝明るい。
 */
export const ELEVATION = {
  bg: 0x0f1022,
  zone: 0x161a35, // セクションのグルーピング用パネル
  card: 0x22254a, // ゾーン内の個別カード/行
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
  graphics: Phaser.GameObjects.Graphics;
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
  track.fillStyle(options.trackColor ?? 0x14162c, 1);
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

  return { graphics: fill, setRatio: paint };
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

/** テキストの値が変わった時だけ、軽くポップさせて変化に気付きやすくする */
export function popOnChange(scene: Phaser.Scene, target: Phaser.GameObjects.Text, newText: string): void {
  if (target.text === newText) return;
  target.setText(newText);
  scene.tweens.add({ targets: target, scale: 1.15, duration: 90, yoyo: true, ease: "Sine.easeOut" });
}

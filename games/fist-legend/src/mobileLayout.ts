import Phaser from "phaser";
import { bindResponsiveScene, type ViewportLayout } from "../../shared/mobile";
import { MAX_HP, MOVE_LABEL, OUGI_GAUGE_MAX, type BattleOutcome, type BattleState, type MoveType } from "./logic/battle";
import { MOVE_TELL, OPPONENTS, type Opponent } from "./logic/opponent";
import { loadCurrency, loadWinCount } from "./logic/progress";
import { GameScene } from "./scenes/GameScene";

type FighterSprite = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

type Runtime = Phaser.Scene & {
  phase?: "title" | "battle" | "result";
  battle?: BattleState;
  opponent?: Opponent;
  nextEnemyMove?: MoveType;
  beat?: number;
  timeRemainingSec?: number;
  accepting?: boolean;
  lastOutcome?: BattleOutcome | null;
  playerSprite?: FighterSprite;
  enemySprite?: FighterSprite;
  gachaGroup?: Phaser.GameObjects.Container;
  startBattle?: () => void;
  showTitle?: () => void;
  openGacha?: () => void;
  onPlayerMove?: (move: MoveType) => void;
  onPlayerOugi?: () => void;
};

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;

type MobileUi = {
  root: Phaser.GameObjects.Container;
  chrome: Phaser.GameObjects.Graphics;
  titleGroup: Phaser.GameObjects.Container;
  battleGroup: Phaser.GameObjects.Container;
  resultGroup: Phaser.GameObjects.Container;
  titleStatus: Phaser.GameObjects.Text;
  titleHint: Phaser.GameObjects.Text;
  opponentButtons: Phaser.GameObjects.Container[];
  battleStatus: Phaser.GameObjects.Text;
  battleTell: Phaser.GameObjects.Text;
  battleGauge: Phaser.GameObjects.Text;
  resultHeading: Phaser.GameObjects.Text;
  resultStats: Phaser.GameObjects.Text;
  portrait: boolean;
  phone: boolean;
};

const uiByScene = new WeakMap<object, MobileUi>();

function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#ffffff",
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", "Yu Gothic", sans-serif',
      fontSize: `${size}px`,
      fontStyle: "800",
      color,
      align: "center",
      wordWrap: { width: 390, useAdvancedWrap: true },
    })
    .setOrigin(0.5);
}

function button(
  scene: Runtime,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: number,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const bg = scene.add
    .rectangle(0, 0, width, height, color, 0.92)
    .setStrokeStyle(2, 0xffe0a3, 0.6);
  const labelText = text(scene, 0, 0, label, height >= 56 ? 20 : 15);
  const container = scene.add
    .container(x, y, [bg, labelText])
    .setSize(width, Math.max(48, height))
    .setInteractive({ useHandCursor: true });
  container.on("pointerdown", onTap);
  root.add(container);
  return container;
}

function hideLegacyOrientationWarning(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Container)) continue;
    const isWarning = child.list.some(
      (item) => item instanceof Phaser.GameObjects.Text && item.text.includes("横向きにしてください"),
    );
    if (isWarning) child.setVisible(false);
  }
}

function buildUi(scene: Runtime): MobileUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const chrome = scene.add.graphics();
  const titleGroup = scene.add.container(0, 0);
  const battleGroup = scene.add.container(0, 0);
  const resultGroup = scene.add.container(0, 0);
  const root = scene.add
    .container(0, 0, [chrome, titleGroup, battleGroup, resultGroup])
    .setDepth(2800);

  const title = text(scene, 225, 118, "覇拳伝", 38, "#ffe1a8");
  const subtitle = text(scene, 225, 170, "拳 > 気 > 蹴 > 拳\n相手の構えを読み、一撃を通せ。", 16, "#f4d4bb");
  const titleStatus = text(scene, 225, 225, "", 14, "#d9c4ad");
  const titleHint = text(scene, 225, 430, "", 13, "#ffe0a0");
  titleGroup.add([title, subtitle, titleStatus, titleHint]);

  const opponentButtons: Phaser.GameObjects.Container[] = [];
  OPPONENTS.forEach((opponent, index) => {
    const b = button(scene, titleGroup, 225, 292 + index * 58, 330, 46, opponent.name, 0x4d2b26, () => {
      scene.opponent = opponent.id;
      titleHint.setText(opponent.hint);
    });
    opponentButtons.push(b);
  });
  button(scene, titleGroup, 225, 522, 330, 58, "バトル開始", 0xa9402d, () => scene.startBattle?.());
  button(scene, titleGroup, 225, 590, 330, 48, "ガチャ", 0x334c70, () => scene.openGacha?.());

  const battleStatus = text(scene, 18, 18, "", 13, "#fff1d5").setOrigin(0, 0);
  const battleTell = text(scene, 225, 112, "", 16, "#ffe2a8");
  const battleGauge = text(scene, 225, 162, "", 13, "#fff0a0");
  battleGroup.add([battleStatus, battleTell, battleGauge]);

  const moveButtons: Array<{ move: MoveType; label: string; color: number }> = [
    { move: "punch", label: "拳", color: 0xb8412f },
    { move: "kick", label: "蹴", color: 0x2f7d58 },
    { move: "ki", label: "気", color: 0x315d91 },
  ];
  moveButtons.forEach(({ move, label, color }, index) => {
    const b = button(scene, battleGroup, 92 + index * 133, 690, 110, 62, label, color, () => scene.onPlayerMove?.(move));
    b.setName(`mobile-move-${move}`);
  });
  const ougi = button(scene, battleGroup, 225, 764, 350, 56, "奥義", 0x9b7119, () => scene.onPlayerOugi?.());
  ougi.setName("mobile-ougi");

  const resultHeading = text(scene, 225, 285, "", 42, "#ffe3a8");
  const resultStats = text(scene, 225, 345, "", 15, "#e5d0bc");
  resultGroup.add([resultHeading, resultStats]);
  button(scene, resultGroup, 225, 430, 330, 58, "もう一度", 0xa9402d, () => scene.startBattle?.());
  button(scene, resultGroup, 225, 500, 330, 48, "タイトルへ", 0x334c70, () => scene.showTitle?.());

  const ui: MobileUi = {
    root,
    chrome,
    titleGroup,
    battleGroup,
    resultGroup,
    titleStatus,
    titleHint,
    opponentButtons,
    battleStatus,
    battleTell,
    battleGauge,
    resultHeading,
    resultStats,
    portrait: false,
    phone: false,
  };
  uiByScene.set(scene, ui);
  return ui;
}

function applySurface(scene: Runtime, width: number, height: number): void {
  const current = scene.scale.gameSize;
  if (current.width !== width || current.height !== height) scene.scale.resize(width, height);
  scene.cameras.main.setViewport(0, 0, width, height);
}

function applyLayout(scene: Runtime, layout: ViewportLayout): void {
  const ui = buildUi(scene);
  ui.phone = !layout.isTablet;
  ui.root.setVisible(ui.phone);
  hideLegacyOrientationWarning(scene);
  if (!ui.phone) return;

  ui.portrait = layout.isPortrait;
  if (scene.gachaGroup?.visible) {
    applySurface(scene, 800, 600);
    ui.root.setVisible(false);
    return;
  }

  applySurface(scene, layout.isPortrait ? 450 : 800, layout.isPortrait ? 800 : 450);
}

function positionFighters(scene: Runtime, portrait: boolean): void {
  const player = scene.playerSprite;
  const enemy = scene.enemySprite;
  if (!player || !enemy) return;
  if (portrait) {
    player.setPosition(135, 400).setScale(0.82);
    enemy.setPosition(315, 330).setScale(0.82);
  } else {
    player.setPosition(185, 245).setScale(0.9);
    enemy.setPosition(615, 245).setScale(0.9);
  }
}

function refresh(scene: Runtime): void {
  const ui = buildUi(scene);
  if (!ui.phone) return;

  hideLegacyOrientationWarning(scene);
  if (scene.gachaGroup?.visible) {
    ui.root.setVisible(false);
    applySurface(scene, 800, 600);
    return;
  }

  ui.root.setVisible(true);
  const portrait = ui.portrait;
  const width = portrait ? 450 : 800;
  const height = portrait ? 800 : 450;
  applySurface(scene, width, height);

  ui.titleGroup.setVisible(scene.phase === "title");
  ui.battleGroup.setVisible(scene.phase === "battle");
  ui.resultGroup.setVisible(scene.phase === "result");

  ui.chrome.clear();
  if (scene.phase === "title") {
    ui.chrome.fillStyle(0x140a08, 0.97).fillRect(0, 0, width, height);
    ui.chrome.fillStyle(0x40201a, 0.72).fillRoundedRect(18, 70, width - 36, portrait ? 570 : 340, 24);
    ui.titleStatus.setPosition(width / 2, portrait ? 225 : 120);
    ui.titleHint.setPosition(width / 2, portrait ? 430 : 324);
    ui.titleStatus.setText(`豪拳石 ${loadCurrency()}  ·  勝利 ${loadWinCount()}`);
    ui.titleHint.setText(OPPONENTS.find((opponent) => opponent.id === scene.opponent)?.hint ?? OPPONENTS[0]!.hint);
    ui.opponentButtons.forEach((b, index) => b.setAlpha(OPPONENTS[index]?.id === scene.opponent ? 1 : 0.62));
    if (!portrait) {
      // 横持ちは既存タイトルを活かし、モバイル専用タイトル面を隠す。
      ui.titleGroup.setVisible(false);
      ui.chrome.clear();
    }
    return;
  }

  if (scene.phase === "battle" && scene.battle) {
    positionFighters(scene, portrait);
    const battle = scene.battle;
    const playerRatio = Phaser.Math.Clamp(battle.playerHp / MAX_HP, 0, 1);
    const enemyRatio = Phaser.Math.Clamp(battle.enemyHp / MAX_HP, 0, 1);
    const gaugeRatio = Phaser.Math.Clamp(battle.playerGauge / OUGI_GAUGE_MAX, 0, 1);

    ui.chrome.fillStyle(0x100806, 0.9).fillRoundedRect(8, 8, width - 16, 90, 16);
    ui.chrome.fillStyle(0x37130f, 1).fillRoundedRect(18, 54, width * 0.38, 12, 6);
    ui.chrome.fillStyle(0xe74d30, 1).fillRoundedRect(18, 54, width * 0.38 * playerRatio, 12, 6);
    const enemyX = width - 18 - width * 0.38;
    ui.chrome.fillStyle(0x12233c, 1).fillRoundedRect(enemyX, 54, width * 0.38, 12, 6);
    ui.chrome.fillStyle(0x489ff0, 1).fillRoundedRect(enemyX + width * 0.38 * (1 - enemyRatio), 54, width * 0.38 * enemyRatio, 12, 6);
    if (portrait) {
      ui.chrome.fillStyle(0x120a08, 0.95).fillRect(0, 620, 450, 180);
      ui.chrome.lineStyle(1, 0xffd68a, 0.32).lineBetween(0, 620, 450, 620);
      ui.battleTell.setPosition(225, 112);
      ui.battleGauge.setPosition(225, 162);
      const moveXs = [92, 225, 358];
      (["punch", "kick", "ki"] as const).forEach((move, index) => {
        const b = ui.battleGroup.getByName(`mobile-move-${move}`) as Phaser.GameObjects.Container | null;
        b?.setPosition(moveXs[index]!, 690).setVisible(true);
      });
      (ui.battleGroup.getByName("mobile-ougi") as Phaser.GameObjects.Container | null)?.setPosition(225, 764).setVisible(true);
    } else {
      ui.battleTell.setPosition(400, 102);
      ui.battleGauge.setPosition(400, 132);
      const moveXs = [520, 635, 750];
      (["punch", "kick", "ki"] as const).forEach((move, index) => {
        const b = ui.battleGroup.getByName(`mobile-move-${move}`) as Phaser.GameObjects.Container | null;
        b?.setPosition(moveXs[index]!, 392).setScale(0.82).setVisible(true);
      });
      (ui.battleGroup.getByName("mobile-ougi") as Phaser.GameObjects.Container | null)?.setPosition(290, 395).setScale(0.8).setVisible(true);
    }

    const remaining = Math.max(0, Math.ceil(scene.timeRemainingSec ?? 0));
    ui.battleStatus.setPosition(18, 18).setText(`PLAYER ${battle.playerHp}/${MAX_HP}   TIME ${remaining}   ENEMY ${battle.enemyHp}/${MAX_HP}`);
    ui.battleTell.setText(`${MOVE_TELL[scene.nextEnemyMove ?? "punch"]}\n拳 > 気 > 蹴 > 拳`);
    ui.battleGauge.setText(gaugeRatio >= 1 ? "奥義 READY" : `奥義 ${Math.round(gaugeRatio * 100)}%  ·  EXCHANGE ${(scene.beat ?? 0) + 1}`);
    return;
  }

  if (scene.phase === "result") {
    ui.chrome.fillStyle(0x120907, 0.97).fillRect(0, 0, width, height);
    const outcome = scene.lastOutcome;
    ui.resultHeading.setPosition(width / 2, portrait ? 285 : 165).setText(outcome === "playerWin" ? "勝利" : outcome === "enemyWin" ? "敗北" : "引き分け");
    ui.resultStats.setPosition(width / 2, portrait ? 345 : 220).setText(`豪拳石 ${loadCurrency()}\n次は相手の構えをさらに読もう`);
    if (!portrait) {
      ui.resultGroup.each((child) => {
        const obj = child as Phaser.GameObjects.GameObject & { x?: number; y?: number };
        if (typeof obj.x === "number" && obj.x === 225) obj.x = 400;
        if (typeof obj.y === "number" && obj.y === 430) obj.y = 300;
        if (typeof obj.y === "number" && obj.y === 500) obj.y = 360;
      });
    }
  }
}

export function installFistMobileLayout(): void {
  const proto = GameScene.prototype as unknown as MethodTable;
  const originalCreate = proto.create;
  const originalUpdate = proto.update;
  if (!originalCreate || !originalUpdate || proto.__mobileLayoutCreate) return;

  proto.__mobileLayoutCreate = originalCreate;
  proto.create = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalCreate.apply(this, args);
    const scene = this as Runtime;
    hideLegacyOrientationWarning(scene);
    bindResponsiveScene(scene, (layout) => applyLayout(scene, layout));
    refresh(scene);
    return result;
  };

  proto.__mobileLayoutUpdate = originalUpdate;
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}

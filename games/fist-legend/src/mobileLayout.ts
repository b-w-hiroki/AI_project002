import Phaser from "phaser";
import { bindResponsiveScene, type ViewportLayout } from "../../shared/mobile";
import { MAX_HP, OUGI_GAUGE_MAX, type BattleOutcome, type BattleState, type MoveType } from "./logic/battle";
import { OPPONENTS, plannedMove, type Opponent } from "./logic/opponent";
import { loadCurrency, loadWinCount } from "./logic/progress";
import { FIGHTERS, fighterById, type FighterId } from "./logic/team";
import { teamTacticalRead } from "./logic/teamTactics";
import {
  detectLang,
  fighterName,
  moveLabel,
  moveTell,
  opponentHint,
  opponentName as localizedOpponentName,
  opponentType,
  tr,
} from "./logic/i18n";
import { GameScene } from "./scenes/GameScene";

type FighterSprite = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

type Runtime = Phaser.Scene & {
  phase?: "title" | "battle" | "result";
  battle?: BattleState;
  titleGroup?: Phaser.GameObjects.Container;
  battleGroup?: Phaser.GameObjects.Container;
  resultGroup?: Phaser.GameObjects.Container;
  opponent?: Opponent;
  selectedTeam?: FighterId[];
  activeFighterIndex?: number;
  toggleTeamMember?: (id: FighterId) => void;
  switchFighter?: () => void;
  nextEnemyMove?: MoveType;
  beat?: number;
  timeRemainingSec?: number;
  accepting?: boolean;
  lastOutcome?: BattleOutcome | null;
  playerSprite?: FighterSprite;
  enemySprite?: FighterSprite;
  gachaGroup?: Phaser.GameObjects.Container;
  startBattle?: () => void;
  startSingleBattle?: () => void;
  startSeries?: () => void;
  startStory?: () => void;
  handleResultPrimary?: () => void;
  seriesActive?: boolean;
  storyActive?: boolean;
  storyChapterIndex?: number;
  storyProgress?: number;
  seriesIndex?: number;
  seriesWins?: number;
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
  teamText: Phaser.GameObjects.Text;
  opponentButtons: Phaser.GameObjects.Container[];
  teamButtons: Phaser.GameObjects.Container[];
  battleStatus: Phaser.GameObjects.Text;
  battleTell: Phaser.GameObjects.Text;
  battleGauge: Phaser.GameObjects.Text;
  resultBackdrop?: Phaser.GameObjects.Image;
  resultHero?: Phaser.GameObjects.Image;
  resultEnemy?: Phaser.GameObjects.Image;
  resultFinish: Phaser.GameObjects.Text;
  resultHeading: Phaser.GameObjects.Text;
  resultStats: Phaser.GameObjects.Text;
  resultRetry: Phaser.GameObjects.Container;
  resultTitle: Phaser.GameObjects.Container;
  portrait: boolean;
  phone: boolean;
};

const uiByScene = new WeakMap<object, MobileUi>();

const OPPONENT_ACCENT: Readonly<Record<Opponent, { accent: number; glow: number }>> = {
  rush: { accent: 0xe6533f, glow: 0xffad66 },
  counter: { accent: 0x4ca67a, glow: 0x8ce6bd },
  charge: { accent: 0x576ccf, glow: 0xaebaff },
};

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
  const shadow = scene.add.rectangle(3, 5, width, height, 0x120b09, 0.38).setStrokeStyle(1, 0x000000, 0.22);
  const bg = scene.add.rectangle(0, 0, width, height, color, 0.96).setStrokeStyle(3, 0x2b1713, 0.82);
  const rim = scene.add.rectangle(0, 0, width - 7, height - 7, color, 0).setStrokeStyle(1.5, 0xffd68c, 0.78);
  const shine = scene.add.rectangle(0, -height * 0.31, width - 12, Math.max(5, height * 0.16), 0xffffff, 0.13);
  const leftStud = scene.add.circle(-width / 2 + 10, 0, 2.5, 0xffd68c, 0.82);
  const rightStud = scene.add.circle(width / 2 - 10, 0, 2.5, 0xffd68c, 0.82);
  const labelText = text(scene, 0, 0, label, height >= 56 ? 20 : 15).setStroke("#351713", 3);
  const hit = scene.add.zone(0, 0, width, Math.max(48, height)).setInteractive({ useHandCursor: true });
  const container = scene.add
    .container(x, y, [shadow, bg, rim, shine, leftStud, rightStud, labelText, hit])
    .setSize(width, Math.max(48, height));
  const release = () => container.setScale(1);
  hit.on("pointerdown", () => { container.setScale(0.97); onTap(); });
  hit.on("pointerup", release);
  hit.on("pointerout", release);
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
  const lang = detectLang();
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  const chrome = scene.add.graphics();
  const titleGroup = scene.add.container(0, 0);
  const battleGroup = scene.add.container(0, 0);
  const resultGroup = scene.add.container(0, 0);
  const root = scene.add
    .container(0, 0, [chrome, titleGroup, battleGroup, resultGroup])
    .setDepth(2800);

  const title = text(scene, 225, 118, tr(lang, "覇拳伝", "Fist Legend"), 38, "#ffe1a8");
  const subtitle = text(scene, 225, 170, `${moveLabel(lang, "punch")} > ${moveLabel(lang, "ki")} > ${moveLabel(lang, "kick")} > ${moveLabel(lang, "punch")}\n${tr(lang, "相手の構えを読み、一撃を通せ。", "Read the stance. Land the decisive hit.")}`, 16, "#f4d4bb");
  const titleStatus = text(scene, 225, 225, "", 14, "#d9c4ad");
  const titleHint = text(scene, 225, 444, "", 12, "#ffe0a0");
  const teamText = text(scene, 225, 474, "", 12, "#ffe6b5");
  titleGroup.add([title, subtitle, titleStatus, titleHint, teamText]);

  const opponentButtons: Phaser.GameObjects.Container[] = [];
  OPPONENTS.forEach((opponent, index) => {
    const b = button(scene, titleGroup, 225, 292 + index * 58, 330, 46, localizedOpponentName(lang, opponent.id), 0x4d2b26, () => {
      scene.opponent = opponent.id;
      titleHint.setText(opponentHint(lang, opponent.id));
    });
    opponentButtons.push(b);
  });

  const teamButtons: Phaser.GameObjects.Container[] = [];
  FIGHTERS.forEach((fighter, index) => {
    const x = 57 + index * 112;
    const b = button(
      scene,
      titleGroup,
      x,
      507,
      92,
      34,
      fighterName(lang, fighter.id),
      fighter.id === "ryuga" ? 0x6d3f2f : fighter.accent,
      () => scene.toggleTeamMember?.(fighter.id),
    );
    teamButtons.push(b);
  });
  button(scene, titleGroup, 82, 565, 118, 54, tr(lang, "対戦", "Battle"), 0xa9402d, () => scene.startSingleBattle?.()).setName("title-battle");
  button(scene, titleGroup, 225, 565, 118, 54, tr(lang, "3連戦", "Gauntlet"), 0x8a6118, () => scene.startSeries?.()).setName("title-series");
  button(scene, titleGroup, 368, 565, 118, 54, tr(lang, "物語", "Story"), 0x5d3e76, () => scene.startStory?.()).setName("title-story");
  button(scene, titleGroup, 225, 630, 330, 46, tr(lang, "ガチャ", "Gacha"), 0x334c70, () => scene.openGacha?.()).setName("title-gacha");

  const battleStatus = text(scene, 18, 18, "", 13, "#fff1d5").setOrigin(0, 0);
  const battleTell = text(scene, 225, 104, "", 17, "#ffe2a8");
  const battleGauge = text(scene, 225, 151, "", 12, "#fff0a0");
  battleGroup.add([battleStatus, battleTell, battleGauge]);

  const moveButtons: Array<{ move: MoveType; label: string; color: number }> = [
    { move: "punch", label: moveLabel(lang, "punch"), color: 0xb8412f },
    { move: "kick", label: moveLabel(lang, "kick"), color: 0x2f7d58 },
    { move: "ki", label: moveLabel(lang, "ki"), color: 0x315d91 },
  ];
  moveButtons.forEach(({ move, label, color }, index) => {
    const b = button(scene, battleGroup, 92 + index * 133, 684, 112, 66, label, color, () => scene.onPlayerMove?.(move));
    b.setName(`mobile-move-${move}`);
  });
  const ougi = button(scene, battleGroup, 225, 760, 360, 60, tr(lang, "奥義", "SPECIAL"), 0x9b7119, () => scene.onPlayerOugi?.());
  ougi.setName("mobile-ougi");
  const landscapeOugi = button(scene, battleGroup, 735, 402, 110, 52, tr(lang, "奥義", "SPECIAL"), 0x9b7119, () => scene.onPlayerOugi?.());
  landscapeOugi.setName("mobile-ougi-landscape").setVisible(false);
  const switchButton = button(scene, battleGroup, 225, 715, 76, 44, tr(lang, "交代", "SWITCH"), 0x505385, () => scene.switchFighter?.());
  switchButton.setName("mobile-switch").setVisible(false);
  const landscapeSwitch = button(scene, battleGroup, 300, 402, 88, 46, tr(lang, "交代", "SWITCH"), 0x505385, () => scene.switchFighter?.());
  landscapeSwitch.setName("mobile-switch-landscape").setVisible(false);

  const resultBackdrop = scene.textures.exists("fl-bg-arena")
    ? scene.add.image(225, 400, "fl-bg-arena").setDisplaySize(450, 800).setAlpha(0.34)
    : undefined;
  const resultHero = scene.textures.exists("fl-hero-fighter")
    ? scene.add.image(118, 430, "fl-hero-fighter").setDisplaySize(150, 200).setAlpha(0.72)
    : undefined;
  const resultEnemy = scene.textures.exists("fl-enemy-fighter")
    ? scene.add.image(332, 430, "fl-enemy-fighter").setDisplaySize(150, 200).setFlipX(true).setAlpha(0.42)
    : undefined;
  resultGroup.add([
    ...(resultBackdrop ? [resultBackdrop] : []),
    ...(resultHero ? [resultHero] : []),
    ...(resultEnemy ? [resultEnemy] : []),
  ]);

  const resultFinish = text(scene, 225, 205, "", 56, "#ffe3a8")
    .setStroke("#3a1a12", 7)
    .setAngle(-5);
  const resultHeading = text(scene, 225, 285, "", 42, "#ffe3a8");
  const resultStats = text(scene, 225, 345, "", 15, "#e5d0bc");
  resultGroup.add([resultFinish, resultHeading, resultStats]);
  const resultRetry = button(scene, resultGroup, 225, 430, 330, 58, tr(lang, "もう一度", "Play Again"), 0xa9402d, () => scene.handleResultPrimary?.());
  const resultTitle = button(scene, resultGroup, 225, 500, 330, 48, tr(lang, "タイトルへ", "Title"), 0x334c70, () => scene.showTitle?.());

  const ui: MobileUi = {
    root,
    chrome,
    titleGroup,
    battleGroup,
    resultGroup,
    titleStatus,
    titleHint,
    teamText,
    opponentButtons,
    teamButtons,
    battleStatus,
    battleTell,
    battleGauge,
    resultBackdrop,
    resultHero,
    resultEnemy,
    resultFinish,
    resultHeading,
    resultStats,
    resultRetry,
    resultTitle,
    portrait: false,
    phone: false,
  };
  uiByScene.set(scene, ui);
  return ui;
}

function portraitSurfaceHeight(): number {
  const viewport = window.visualViewport;
  const availableWidth = Math.max(320, (viewport?.width ?? window.innerWidth) - 18);
  const availableHeight = Math.max(640, (viewport?.height ?? window.innerHeight) - 8);
  return Phaser.Math.Clamp(Math.round(450 * availableHeight / availableWidth), 860, 1040);
}

function applySurface(scene: Runtime, width: number, height: number): void {
  const current = scene.scale.gameSize;
  if (current.width !== width || current.height !== height) {
    scene.scale.resize(width, height);
  }
  const viewport = window.visualViewport;
  const portrait = height > width;
  const availableWidth = (viewport?.width ?? window.innerWidth) - 18;
  const availableHeight = (viewport?.height ?? window.innerHeight) - 8;
  const fit = Math.min(availableWidth / width, availableHeight / height);
  scene.scale.canvas.style.setProperty("width", `${Math.floor(width * fit)}px`, "important");
  scene.scale.canvas.style.setProperty("height", `${Math.floor(height * fit)}px`, "important");
  scene.scale.canvas.style.setProperty("margin", "0 auto", "important");
  scene.scale.updateBounds();
  scene.scale.displayScale.set(
    scene.scale.baseSize.width / scene.scale.canvasBounds.width,
    scene.scale.baseSize.height / scene.scale.canvasBounds.height,
  );
  scene.cameras.main.setViewport(0, 0, width, height);
}

function applyLayout(scene: Runtime, layout: ViewportLayout): void {
  const ui = buildUi(scene);
  ui.phone = !layout.isTablet;
  ui.root.setVisible(ui.phone);
  hideLegacyOrientationWarning(scene);
  scene.titleGroup?.setVisible(!ui.phone && scene.phase === "title");
  scene.resultGroup?.setVisible(!ui.phone && scene.phase === "result");
  (scene.battleGroup?.getByName("legacy-battle-hud") as Phaser.GameObjects.Container | null)?.setVisible(!ui.phone);
  if (!ui.phone) { applySurface(scene, 800, 600); return; }

  ui.portrait = layout.isPortrait;
  if (scene.gachaGroup?.visible) {
    applySurface(scene, 800, 600);
    ui.root.setVisible(false);
    return;
  }

  applySurface(scene, layout.isPortrait ? 450 : 800, layout.isPortrait ? portraitSurfaceHeight() : 450);
}

function fitFighter(sprite: FighterSprite, height: number): void {
  // Uniform scaling keeps the source artwork's aspect ratio.
  sprite.setScale(sprite instanceof Phaser.GameObjects.Image ? height / sprite.height : height / 110);
}

function positionFighters(scene: Runtime, portrait: boolean): void {
  const player = scene.playerSprite;
  const enemy = scene.enemySprite;
  if (!player || !enemy) return;
  if (portrait) {
    const extra = portraitSurfaceHeight() - 800;
    player.setPosition(225, 500 + extra * 0.34);
    fitFighter(player, 200);
    enemy.setPosition(225, 270 + extra * 0.08);
    fitFighter(enemy, 200);
  } else {
    player.setPosition(185, 245);
    fitFighter(player, 240);
    enemy.setPosition(615, 245);
    fitFighter(enemy, 240);
  }
}

function refresh(scene: Runtime): void {
  const lang = detectLang();
  const ui = buildUi(scene);
  if (!ui.phone) return;

  hideLegacyOrientationWarning(scene);
  scene.titleGroup?.setVisible(false);
  scene.resultGroup?.setVisible(false);
  if (scene.gachaGroup?.visible) {
    ui.root.setVisible(false);
    applySurface(scene, 800, 600);
    return;
  }

  ui.root.setVisible(true);
  const portrait = ui.portrait;
  const width = portrait ? 450 : 800;
  const height = portrait ? portraitSurfaceHeight() : 450;
  const extra = portrait ? height - 800 : 0;
  applySurface(scene, width, height);

  ui.titleGroup.setVisible(scene.phase === "title");
  ui.battleGroup.setVisible(scene.phase === "battle");
  ui.resultGroup.setVisible(scene.phase === "result");
  if (portrait && scene.phase === "result") {
    ui.resultBackdrop?.setPosition(225, height / 2).setDisplaySize(450, height);
    ui.resultHero?.setPosition(118, 430 + extra * 0.28);
    ui.resultEnemy?.setPosition(332, 430 + extra * 0.28);
    ui.resultFinish.setPosition(225, 205 + extra * 0.10);
    ui.resultHeading.setPosition(225, 285 + extra * 0.14);
    ui.resultStats.setPosition(225, 345 + extra * 0.18);
    ui.resultRetry.setPosition(225, height - 245);
    ui.resultTitle.setPosition(225, height - 175);
  }

  ui.chrome.clear();
  if (scene.phase === "title") {
    ui.chrome.fillStyle(0x140a08, 0.97).fillRect(0, 0, width, height);
    ui.chrome.fillStyle(0x40201a, 0.72).fillRoundedRect(18, 70, width - 36, portrait ? height - 140 : 340, 24);
    ui.titleStatus.setPosition(width / 2, portrait ? 225 : 120);
    ui.titleHint.setPosition(width / 2, portrait ? 444 + extra * 0.34 : 324);
    const team = scene.selectedTeam?.length ? scene.selectedTeam : (["ryuga"] as FighterId[]);
    ui.titleStatus.setText(`${tr(lang, "豪拳石", "Fist Gems")} ${loadCurrency()} · ${tr(lang, "勝利", "Wins")} ${loadWinCount()}`);
    ui.titleHint.setText(opponentHint(lang, scene.opponent ?? "rush"));
    ui.teamText.setPosition(width / 2, portrait ? 474 + extra * 0.42 : 350).setText(`TEAM ${team.length}/3 · ${team.map(id => fighterName(lang, id)).join(" / ")} · ${tr(lang, "先頭が出場", "leader starts")}`);
    ui.opponentButtons.forEach((b, index) => {
      if (portrait) b.setPosition(225, 292 + index * 58 + extra * 0.12);
      b.setAlpha(OPPONENTS[index]?.id === scene.opponent ? 1 : 0.62);
    });
    ui.teamButtons.forEach((b, index) => {
      const fighter = FIGHTERS[index];
      if (portrait) b.setPosition(57 + index * 112, 507 + extra * 0.52);
      b.setAlpha(fighter && team.includes(fighter.id) ? 1 : 0.42);
    });
    if (portrait) {
      (ui.titleGroup.getByName("title-battle") as Phaser.GameObjects.Container | null)?.setPosition(82, 565 + extra * 0.69);
      (ui.titleGroup.getByName("title-series") as Phaser.GameObjects.Container | null)?.setPosition(225, 565 + extra * 0.69);
      (ui.titleGroup.getByName("title-story") as Phaser.GameObjects.Container | null)?.setPosition(368, 565 + extra * 0.69);
      (ui.titleGroup.getByName("title-gacha") as Phaser.GameObjects.Container | null)?.setPosition(225, 630 + extra * 0.84);
    }
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
    const opponentVisual = OPPONENT_ACCENT[scene.opponent ?? "rush"];
    const opponentName = localizedOpponentName(lang, scene.opponent ?? "rush");
    const playerRatio = Phaser.Math.Clamp(battle.playerHp / MAX_HP, 0, 1);
    const enemyRatio = Phaser.Math.Clamp(battle.enemyHp / MAX_HP, 0, 1);
    const gaugeRatio = Phaser.Math.Clamp(battle.playerGauge / OUGI_GAUGE_MAX, 0, 1);

    const hudTop = portrait ? 8 : 44;
    const hpY = portrait ? 54 : 78;
    ui.chrome.fillStyle(0x100806, 0.9).fillRoundedRect(8, hudTop, width - 16, portrait ? 90 : 62, 16);
    ui.chrome.fillStyle(0x37130f, 1).fillRoundedRect(18, hpY, width * 0.38, 12, 6);
    ui.chrome.fillStyle(0xe74d30, 1).fillRoundedRect(18, hpY, width * 0.38 * playerRatio, 12, 6);
    const enemyX = width - 18 - width * 0.38;
    ui.chrome.fillStyle(0x12233c, 1).fillRoundedRect(enemyX, hpY, width * 0.38, 12, 6);
    ui.chrome.fillStyle(opponentVisual.accent, 1).fillRoundedRect(enemyX + width * 0.38 * (1 - enemyRatio), hpY, width * 0.38 * enemyRatio, 12, 6);
    ui.chrome.lineStyle(2, opponentVisual.glow, 0.45).strokeRoundedRect(enemyX - 3, hpY - 4, width * 0.38 + 6, 20, 9);
    ui.chrome.fillStyle(opponentVisual.glow, portrait ? 0.055 : 0.04).fillCircle(portrait ? 225 : 615, portrait ? 270 : 245, portrait ? 116 : 132);
    if (portrait) {
      const controlsTop = Math.max(610, height - 300);
      ui.chrome.fillStyle(0x2a160f, 0.98).fillRect(0, 600, 450, Math.max(0, controlsTop - 600));
      ui.chrome.fillStyle(0x1b0d09, 0.98).fillRect(0, controlsTop, 450, height - controlsTop);
      ui.chrome.lineStyle(1, 0xffd68a, 0.28).lineBetween(0, 600, 450, 600);
      ui.chrome.lineStyle(1, 0xffd68a, 0.36).lineBetween(0, controlsTop, 450, controlsTop);
      ui.chrome.lineStyle(1, 0x7b3f2b, 0.24).lineBetween(20, controlsTop - 22, 430, controlsTop - 22);
      ui.chrome.fillStyle(0x100806, 0.86).fillRoundedRect(55, 365 + extra * 0.18, 340, 58, 14);
      ui.chrome.lineStyle(1, 0xffcf82, 0.45).strokeRoundedRect(55, 365 + extra * 0.18, 340, 58, 14);
      ui.battleTell.setPosition(225, 394 + extra * 0.18);
      ui.battleGauge.setPosition(225, 90);
      const canSwitch = (scene.selectedTeam?.length ?? 1) > 1;
      (ui.battleGroup.getByName("mobile-switch") as Phaser.GameObjects.Container | null)
        ?.setPosition(225, controlsTop + 205).setScale(1).setVisible(canSwitch).setAlpha(canSwitch ? 1 : 0.4);
      (ui.battleGroup.getByName("mobile-switch-landscape") as Phaser.GameObjects.Container | null)?.setVisible(false);
      const movePositions = [{ x: 120, y: controlsTop + 70 }, { x: 330, y: controlsTop + 70 }, { x: 120, y: controlsTop + 145 }];
      (["punch", "kick", "ki"] as const).forEach((move, index) => {
        const b = ui.battleGroup.getByName(`mobile-move-${move}`) as Phaser.GameObjects.Container | null;
        b?.setPosition(movePositions[index]!.x, movePositions[index]!.y).setScale(1).setVisible(true);
      });
      (ui.battleGroup.getByName("mobile-ougi") as Phaser.GameObjects.Container | null)?.setVisible(false);
      (ui.battleGroup.getByName("mobile-ougi-landscape") as Phaser.GameObjects.Container | null)?.setPosition(330, controlsTop + 145).setScale(1).setVisible(true);
    } else {
      ui.chrome.fillStyle(0x100806, 0.84).fillRoundedRect(270, 101, 260, 58, 14);
      ui.chrome.lineStyle(1, 0xffcf82, 0.45).strokeRoundedRect(270, 101, 260, 58, 14);
      ui.chrome.fillStyle(0x100806, 0.9).fillRoundedRect(18, 372, 330, 60, 14);
      ui.chrome.lineStyle(1, 0xffcf82, 0.4).strokeRoundedRect(18, 372, 330, 60, 14);
      ui.battleTell.setPosition(400, 124);
      ui.battleGauge.setPosition(130, 404);
      const canSwitch = (scene.selectedTeam?.length ?? 1) > 1;
      (ui.battleGroup.getByName("mobile-switch") as Phaser.GameObjects.Container | null)?.setVisible(false);
      (ui.battleGroup.getByName("mobile-switch-landscape") as Phaser.GameObjects.Container | null)
        ?.setPosition(300, 402).setScale(0.86).setVisible(canSwitch).setAlpha(canSwitch ? 1 : 0.4);
      const moveXs = [410, 520, 630];
      (["punch", "kick", "ki"] as const).forEach((move, index) => {
        const b = ui.battleGroup.getByName(`mobile-move-${move}`) as Phaser.GameObjects.Container | null;
        b?.setPosition(moveXs[index]!, 402).setScale(0.82).setVisible(true);
      });
      (ui.battleGroup.getByName("mobile-ougi") as Phaser.GameObjects.Container | null)?.setVisible(false);
      (ui.battleGroup.getByName("mobile-ougi-landscape") as Phaser.GameObjects.Container | null)?.setPosition(735, 402).setScale(1).setVisible(true);
    }

    const remaining = Math.max(0, Math.ceil(scene.timeRemainingSec ?? 0));
    const team = scene.selectedTeam?.length ? scene.selectedTeam : (["ryuga"] as FighterId[]);
    const activeIndex = Phaser.Math.Clamp(scene.activeFighterIndex ?? 0, 0, Math.max(0, team.length - 1));
    const leader = fighterById(team[activeIndex] ?? "ryuga");
    ui.battleStatus
      .setPosition(18, portrait ? 18 : 50)
      .setColor(`#${opponentVisual.glow.toString(16).padStart(6, "0")}`)
      .setText(`${fighterName(lang, leader.id)} [${activeIndex + 1}/${team.length}] ${battle.playerHp}/${MAX_HP}   TIME ${remaining}   ${opponentType(lang, scene.opponent ?? "rush")} · ${opponentName} ${battle.enemyHp}/${MAX_HP}`);
    ui.battleTell.setText(`${moveTell(lang, scene.nextEnemyMove ?? "punch")}\n${moveLabel(lang, "punch")} > ${moveLabel(lang, "ki")} > ${moveLabel(lang, "kick")} > ${moveLabel(lang, "punch")}`);
    ui.battleGauge.setText(gaugeRatio >= 1
      ? `${tr(lang, "奥義", "SPECIAL")} READY · TEAM ${activeIndex + 1}/${team.length}`
      : `${tr(lang, "奥義", "SPECIAL")} ${Math.round(gaugeRatio * 100)}% · TEAM ${activeIndex + 1}/${team.length} · EXCHANGE ${(scene.beat ?? 0) + 1}`);
    return;
  }

  if (scene.phase === "result") {
    ui.chrome.fillStyle(0x120907, 0.58).fillRect(0, 0, width, height);
    ui.resultBackdrop?.setPosition(width / 2, height / 2).setDisplaySize(width, height).setAlpha(0.34);
    if (portrait) {
      ui.resultHero?.setPosition(width * 0.28, 430).setDisplaySize(150, 200);
      ui.resultEnemy?.setPosition(width * 0.72, 430).setDisplaySize(150, 200);
    } else {
      ui.resultHero?.setPosition(width * 0.26, 255).setDisplaySize(160, 214);
      ui.resultEnemy?.setPosition(width * 0.74, 255).setDisplaySize(160, 214);
    }
    const outcome = scene.lastOutcome;
    if (ui.resultHero) {
      ui.resultHero.clearTint().setAlpha(outcome === "playerWin" ? 0.92 : 0.28);
      if (outcome === "enemyWin") ui.resultHero.setTint(0x777777);
    }
    if (ui.resultEnemy) {
      ui.resultEnemy.clearTint().setAlpha(outcome === "enemyWin" ? 0.88 : 0.24);
      if (outcome === "playerWin") ui.resultEnemy.setTint(0x777777);
    }
    ui.resultFinish
      .setPosition(width / 2, portrait ? 205 : 92)
      .setText(outcome === "playerWin" ? "K.O." : outcome === "enemyWin" ? "DOWN" : "DRAW")
      .setColor(outcome === "playerWin" ? "#ffe3a8" : outcome === "enemyWin" ? "#cad6eb" : "#e4d6ff")
      .setScale(portrait ? 1 : 0.72);
    ui.resultHeading.setPosition(width / 2, portrait ? 285 : 150).setText(outcome === "playerWin" ? tr(lang, "勝利", "Victory") : outcome === "enemyWin" ? tr(lang, "敗北", "Defeat") : tr(lang, "引き分け", "Draw"));
    const modeText = scene.storyActive
      ? `${tr(lang, "物語", "Story")} ${Math.min(3, (scene.storyChapterIndex ?? 0) + 1)}/3 · ${tr(lang, "進行", "Progress")} ${scene.storyProgress ?? 0}/3`
      : scene.seriesActive
        ? `${tr(lang, "3連戦", "Gauntlet")} ${scene.seriesWins ?? 0}/3 ${tr(lang, "勝", "wins")} · ${Math.min(3, (scene.seriesIndex ?? 0) + 1)}/3`
        : "";
    const firstMove = plannedMove(scene.opponent ?? "rush", 0, null);
    const retryRead = teamTacticalRead(scene.selectedTeam ?? ["ryuga"], firstMove);
    const tacticalNext = retryRead.specialist
      ? `${tr(lang, "再挑戦", "Retry")}: ${fighterName(lang, retryRead.specialist)} → ${moveLabel(lang, retryRead.counterMove)} (+18%)`
      : `${tr(lang, "編成変更", "Team Change")}: ${moveLabel(lang, retryRead.counterMove)} ${tr(lang, "得意の拳士を追加", "specialist needed") }`;
    const nextLine = outcome === "playerWin"
      ? modeText || tr(lang, "同じ相手へ再挑戦", "Retry the same rival")
      : `${modeText ? `${modeText}\n` : ""}${tacticalNext}`;
    ui.resultStats
      .setPosition(width / 2, portrait ? 338 : 202)
      .setText(`${tr(lang, "豪拳石", "Fist Gems")} ${loadCurrency()}\n${nextLine}`);
    const retryLabel = ui.resultRetry.list.find(node => node.type === "Text") as Phaser.GameObjects.Text | undefined;
    if (retryLabel) {
      retryLabel.setText(
        scene.storyActive
          ? scene.lastOutcome === "playerWin" && (scene.storyChapterIndex ?? 0) < 2
            ? `${tr(lang, "次章へ", "Next Chapter")} (${(scene.storyChapterIndex ?? 0) + 2}/3)`
            : scene.lastOutcome === "playerWin"
              ? tr(lang, "物語を再演", "Replay Story")
              : tr(lang, "この章を再挑戦", "Retry Chapter")
          : scene.seriesActive
            ? scene.lastOutcome === "playerWin" && (scene.seriesIndex ?? 0) < 2
              ? `${tr(lang, "次の相手へ", "Next Rival")} (${(scene.seriesIndex ?? 0) + 2}/3)`
              : scene.lastOutcome === "playerWin"
                ? tr(lang, "もう一度3連戦", "Replay Gauntlet")
                : tr(lang, "3連戦を再挑戦", "Retry Gauntlet")
            : tr(lang, "もう一度", "Play Again"),
      );
    }
    ui.resultRetry.setPosition(width / 2, portrait ? 430 : 292).setScale(portrait ? 1 : 0.86);
    ui.resultTitle.setPosition(width / 2, portrait ? 500 : 352).setScale(portrait ? 1 : 0.86);
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

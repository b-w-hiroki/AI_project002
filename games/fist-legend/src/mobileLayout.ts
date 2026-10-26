import { createBattleView, renderBattleView, type BattleView } from "./ui/battleView";
import { createResultView, renderResultView, type ResultView } from "./ui/resultView";
import { fitFighter } from "./ui/art";
import { layoutGacha } from "./ui/gachaLayout";
import { createTitleView, renderTitleView, type TitleView } from "./ui/titleView";
import Phaser from "phaser";
import { bindResponsiveScene, type ViewportLayout } from "../../shared/mobile";
import { type BattleOutcome, type BattleState, type MoveType } from "./logic/battle";
import { type Opponent } from "./logic/opponent";
import { loadCurrency, loadWinCount } from "./logic/progress";
import { type FighterId } from "./logic/team";
import { GameScene } from "./scenes/GameScene";

type FighterSprite = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

type Runtime = Phaser.Scene & {
  titleGroup?: Phaser.GameObjects.Container;
  phase?: "title" | "battle" | "result";
  battle?: BattleState;
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
  lastReward?: number;
  lastBalance?: number;
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
  updateLegacyTellCopy?: (compactTablet: boolean) => void;
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
  battleView: BattleView;
  resultView: ResultView;
  titleView: TitleView;
  root: Phaser.GameObjects.Container;
  chrome: Phaser.GameObjects.Graphics;
  portrait: boolean;
  phone: boolean;
};

const uiByScene = new WeakMap<object, MobileUi>();

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
  const titleView = createTitleView(scene, {
    selectOpponent: opponent => { scene.opponent = opponent; },
    toggleTeamMember: fighter => scene.toggleTeamMember?.(fighter),
    startBattle: () => scene.startSingleBattle?.(), startSeries: () => scene.startSeries?.(),
    startStory: () => scene.startStory?.(), openGacha: () => scene.openGacha?.(),
  });
  const battleView = createBattleView(scene, {
    move: move => scene.onPlayerMove?.(move),
    ougi: () => scene.onPlayerOugi?.(), switchFighter: () => scene.switchFighter?.(),
  });
  const resultView = createResultView(scene, {
    primary: () => scene.handleResultPrimary?.(), title: () => scene.showTitle?.(),
  });
  const root = scene.add
    .container(0, 0, [chrome, titleView.titleChrome, titleView.titleArt, titleView.titleGroup, battleView.battleGroup, resultView.resultGroup])
    .setDepth(2800);

  const ui: MobileUi = {
    titleView,
    battleView,
    resultView,
    root,
    chrome,
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
  scene.updateLegacyTellCopy?.(!ui.phone && layout.width < 800);
  ui.root.setVisible(ui.phone);
  hideLegacyOrientationWarning(scene);
  scene.titleGroup?.setVisible(!ui.phone && scene.phase === "title");
  scene.resultGroup?.setVisible(!ui.phone && scene.phase === "result");
  (scene.battleGroup?.getByName("legacy-battle-hud") as Phaser.GameObjects.Container | null)?.setVisible(!ui.phone);
  ((scene.battleGroup?.getByName("legacy-battle-hud") as Phaser.GameObjects.Container | null)
    ?.getByName("compact-tablet-guide-shade") as Phaser.GameObjects.Graphics | null)
    ?.setVisible(!ui.phone && layout.width < 800);
  if (!ui.phone) {
    if (scene.gachaGroup) layoutGacha(scene.gachaGroup, false, 600);
    applySurface(scene, 800, 600); return;
  }

  ui.portrait = layout.isPortrait;
  if (scene.gachaGroup?.visible) {
    const height = ui.portrait ? portraitSurfaceHeight() : 600;
    applySurface(scene, ui.portrait ? 450 : 800, height);
    layoutGacha(scene.gachaGroup, ui.portrait, height);
    ui.root.setVisible(false);
    return;
  }

  applySurface(scene, layout.isPortrait ? 450 : 800, layout.isPortrait ? portraitSurfaceHeight() : 450);
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
  const ui = buildUi(scene);
  (scene.children.getByName("presentation-result-summary") as Phaser.GameObjects.Text | null)?.setVisible(!ui.phone);
  if (!ui.phone) return;

  hideLegacyOrientationWarning(scene);
  scene.titleGroup?.setVisible(false);
  scene.resultGroup?.setVisible(false);
  if (scene.gachaGroup?.visible) {
    ui.root.setVisible(false);
    const height = ui.portrait ? portraitSurfaceHeight() : 600;
    applySurface(scene, ui.portrait ? 450 : 800, height);
    layoutGacha(scene.gachaGroup, ui.portrait, height);
    return;
  }

  ui.root.setVisible(true);
  const portrait = ui.portrait;
  const width = portrait ? 450 : 800;
  const height = portrait ? portraitSurfaceHeight() : 450;
  applySurface(scene, width, height);

  ui.titleView.titleGroup.setVisible(scene.phase === "title");
  ui.titleView.titleArt.setVisible(scene.phase === "title");
  ui.titleView.titleChrome.setVisible(scene.phase === "title");
  ui.battleView.battleGroup.setVisible(scene.phase === "battle");
  ui.resultView.resultGroup.setVisible(scene.phase === "result");

  ui.chrome.clear();
  if (scene.phase === "title") {
    renderTitleView(ui.titleView, {
      selectedTeam: scene.selectedTeam ?? ["ryuga"], opponent: scene.opponent ?? "rush",
      currency: loadCurrency(), wins: loadWinCount(),
    }, { portrait, width, height });
    return;
  }

  if (scene.phase === "battle" && scene.battle) {
    positionFighters(scene, portrait);
    renderBattleView(ui.battleView, {
      battle: scene.battle, opponent: scene.opponent, selectedTeam: scene.selectedTeam,
      activeFighterIndex: scene.activeFighterIndex, nextEnemyMove: scene.nextEnemyMove,
      accepting: scene.accepting === true,
      beat: scene.beat, timeRemainingSec: scene.timeRemainingSec,
    }, { portrait, width, height }, ui.chrome);
    return;
  }

  if (scene.phase === "result" && scene.battle) {
    renderResultView(ui.resultView, {
      battle: scene.battle,
      lastOutcome: scene.lastOutcome,
      lastReward: scene.lastReward,
      lastBalance: scene.lastBalance,
      storyActive: scene.storyActive,
      seriesActive: scene.seriesActive,
      storyChapterIndex: scene.storyChapterIndex,
      storyProgress: scene.storyProgress,
      seriesWins: scene.seriesWins,
      seriesIndex: scene.seriesIndex,
      opponent: scene.opponent,
      selectedTeam: scene.selectedTeam,
      currency: loadCurrency(),
    }, { portrait, width, height }, ui.chrome);
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

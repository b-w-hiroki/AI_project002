import Phaser from "phaser";
import {
  BattleOutcome,
  BattleState,
  ClashResult,
  MAX_HP,
  MoveType,
  MOVE_LABEL,
  OUGI_GAUGE_MAX,
  applyBeat,
  applyPlayerOugi,
  battleOutcome,
  initialBattleState,
  pickCpuMove,
} from "../logic/battle";
import { GachaItem, canAffordGacha, drawGacha, GACHA_COST } from "../logic/gacha";
import { addCurrency, incrementWinCount, loadCurrency, loadWinCount, spendCurrency } from "../logic/progress";
import { sfx } from "../platform/audio";
import { drawPanel, drawSpeakerIcon, makeButton, THEME, TYPE } from "../ui/theme";
import { buildOrientationWarning, isTouchDevice } from "../ui/touch";

const SOUND_PREF_KEY = "fist_legend_sound_v1";

const ROUND_TIME_SEC = 60;
const BEAT_COOLDOWN_MS = 380;
const WIN_REWARD = 60;
const DRAW_REWARD = 20;
const LOSE_REWARD = 10;

const MOVE_ORDER: MoveType[] = ["punch", "kick", "ki"];
const RARITY_COLOR: Readonly<Record<string, number>> = {
  SSR: 0xffc94a,
  SR: 0xc9a4ff,
  R: 0x7fc4ff,
  N: 0xb8a888,
};

type Phase = "title" | "battle" | "result";

export class GameScene extends Phaser.Scene {
  private phase: Phase = "title";
  private battle: BattleState = initialBattleState();
  private timeRemainingSec = ROUND_TIME_SEC;
  private accepting = false;
  private lastOutcome: BattleOutcome | null = null;

  private titleGroup!: Phaser.GameObjects.Container;
  private battleGroup!: Phaser.GameObjects.Container;
  private resultGroup!: Phaser.GameObjects.Container;
  private gachaGroup!: Phaser.GameObjects.Container;

  private playerHpFill!: Phaser.GameObjects.Graphics;
  private enemyHpFill!: Phaser.GameObjects.Graphics;
  private ougiFill!: Phaser.GameObjects.Graphics;
  private ougiBtn!: ReturnType<typeof makeButton>;
  private timerText!: Phaser.GameObjects.Text;
  private clashText!: Phaser.GameObjects.Text;
  private currencyText!: Phaser.GameObjects.Text;

  private playerSprite!: Phaser.GameObjects.Graphics;
  private enemySprite!: Phaser.GameObjects.Graphics;

  private soundOn = typeof localStorage !== "undefined" ? localStorage.getItem(SOUND_PREF_KEY) !== "off" : true;
  private soundIcon!: Phaser.GameObjects.Graphics;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1410);
    this.buildTitleScreen();
    this.buildBattleScreen();
    this.buildResultScreen();
    this.buildGachaScreen();
    this.showTitle();
    if (isTouchDevice(this)) buildOrientationWarning(this);

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => this.handleKeydown(e));
  }

  update(_time: number, delta: number): void {
    if (this.phase !== "battle") return;
    this.timeRemainingSec -= delta / 1000;
    if (this.timeRemainingSec <= 0) {
      this.timeRemainingSec = 0;
      this.updateTimerVisual();
      this.finishBattle(true);
      return;
    }
    this.updateTimerVisual();
  }

  // ---------- タイトル ----------

  private buildTitleScreen(): void {
    this.titleGroup = this.add.container(0, 0);
    const panel = drawPanel(this, 400, 300, 600, 420, { depth: 0 });

    const title = this.add
      .text(400, 130, "覇拳伝", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const rules = this.add
      .text(
        400,
        220,
        "拳・蹴・気の3ボタンで応酬する格闘バトル。\n拳は気に、気は蹴に、蹴は拳に有利。\n攻撃を当てるほど奥義ゲージが溜まり、\n満タンで必殺の「奥義」を放てる。\n60秒以内にHPを多く残した方が勝利！",
        { ...TYPE.body, color: THEME.textMuted, align: "center" },
      )
      .setOrigin(0.5);

    const currency = this.add
      .text(400, 340, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);

    const startBtn = makeButton(this, 300, 410, 180, 48, "バトル開始", () => { this.playSound(sfx.buttonTap); this.startBattle(); }, {
      fontSize: "16px",
    });
    const gachaBtn = makeButton(this, 500, 410, 180, 48, "ガチャ", () => { this.playSound(sfx.buttonTap); this.openGacha(); }, {
      fontSize: "16px",
    });

    this.soundIcon = drawSpeakerIcon(this, 660, 30, this.soundOn, 18);
    const soundHit = this.add
      .rectangle(660, 30, 40, 40, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.soundOn = !this.soundOn;
        localStorage.setItem(SOUND_PREF_KEY, this.soundOn ? "on" : "off");
        this.soundIcon.destroy();
        this.soundIcon = drawSpeakerIcon(this, 660, 30, this.soundOn, 18);
        this.titleGroup.add(this.soundIcon);
        this.playSound(sfx.buttonTap);
      });

    this.titleGroup.add([panel, title, rules, currency, startBtn.container, gachaBtn.container, this.soundIcon, soundHit]);
    this.titleGroup.setData("currencyText", currency);
  }

  private playSound(fn: () => void): void {
    if (this.soundOn) fn();
  }

  private showTitle(): void {
    this.phase = "title";
    this.titleGroup.setVisible(true);
    this.battleGroup.setVisible(false);
    this.resultGroup.setVisible(false);
    this.gachaGroup.setVisible(false);
    const currencyText = this.titleGroup.getData("currencyText") as Phaser.GameObjects.Text;
    currencyText.setText(`所持: 豪拳石 ${loadCurrency()}  勝利数: ${loadWinCount()}`);
  }

  // ---------- バトル ----------

  private buildBattleScreen(): void {
    this.battleGroup = this.add.container(0, 0);

    const playerHpBg = this.add.graphics();
    playerHpBg.fillStyle(0x000000, 0.5);
    playerHpBg.fillRoundedRect(40, 30, 300, 18, 6);
    this.playerHpFill = this.add.graphics();

    const enemyHpBg = this.add.graphics();
    enemyHpBg.fillStyle(0x000000, 0.5);
    enemyHpBg.fillRoundedRect(460, 30, 300, 18, 6);
    this.enemyHpFill = this.add.graphics();

    const playerLabel = this.add
      .text(40, 12, "プレイヤー", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0, 0.5);
    const enemyLabel = this.add
      .text(760, 12, "対戦相手", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(1, 0.5);

    this.timerText = this.add
      .text(400, 40, "", { ...TYPE.h2, color: THEME.textPrimary })
      .setOrigin(0.5);

    this.clashText = this.add
      .text(400, 130, "", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5)
      .setAlpha(0);

    this.playerSprite = this.add.graphics();
    this.playerSprite.fillStyle(0x3b7fd1, 1);
    this.playerSprite.fillRoundedRect(-30, -55, 60, 110, 10);
    this.playerSprite.setPosition(180, 300);

    this.enemySprite = this.add.graphics();
    this.enemySprite.fillStyle(0xd1493b, 1);
    this.enemySprite.fillRoundedRect(-30, -55, 60, 110, 10);
    this.enemySprite.setPosition(620, 300);

    const ougiBg = this.add.graphics();
    ougiBg.fillStyle(0x000000, 0.5);
    ougiBg.fillRoundedRect(300, 420, 200, 14, 6);
    this.ougiFill = this.add.graphics();
    const ougiLabel = this.add
      .text(400, 405, "奥義ゲージ", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);

    const buttonY = 480;
    const punchBtn = makeButton(this, 240, buttonY, 100, 56, "拳", () => this.onPlayerMove("punch"), {
      fontSize: "22px",
      fillColor: 0x5a2c1c,
    });
    const kickBtn = makeButton(this, 400, buttonY, 100, 56, "蹴", () => this.onPlayerMove("kick"), {
      fontSize: "22px",
      fillColor: 0x2c5a2c,
    });
    const kiBtn = makeButton(this, 560, buttonY, 100, 56, "気", () => this.onPlayerMove("ki"), {
      fontSize: "22px",
      fillColor: 0x2c3f5a,
    });

    this.ougiBtn = makeButton(this, 400, 545, 220, 44, "奥義発動！", () => this.onPlayerOugi(), {
      fontSize: "16px",
      fillColor: 0x7a5210,
    });
    this.ougiBtn.setEnabled(false);

    this.battleGroup.add([
      playerHpBg,
      this.playerHpFill,
      enemyHpBg,
      this.enemyHpFill,
      playerLabel,
      enemyLabel,
      this.timerText,
      this.clashText,
      this.playerSprite,
      this.enemySprite,
      ougiBg,
      this.ougiFill,
      ougiLabel,
      punchBtn.container,
      kickBtn.container,
      kiBtn.container,
      this.ougiBtn.container,
    ]);
  }

  private startBattle(): void {
    this.phase = "battle";
    this.battle = initialBattleState();
    this.timeRemainingSec = ROUND_TIME_SEC;
    this.accepting = true;
    this.titleGroup.setVisible(false);
    this.resultGroup.setVisible(false);
    this.gachaGroup.setVisible(false);
    this.battleGroup.setVisible(true);
    this.refreshBattleVisual();
  }

  private onPlayerMove(move: MoveType): void {
    if (this.phase !== "battle" || !this.accepting) return;
    this.accepting = false;

    const enemyMove = pickCpuMove();
    const result = applyBeat(this.battle, move, enemyMove);
    this.battle = result.state;

    this.playSound(
      result.clash === "advantage" ? sfx.hitAdvantage : result.clash === "disadvantage" ? sfx.hitDisadvantage : sfx.hitClash,
    );
    this.showClash(result.clash, move, enemyMove);
    this.flashHit(this.enemySprite, result.playerDamageDealt);
    this.flashHit(this.playerSprite, result.enemyDamageDealt);
    if (result.playerDamageDealt > 0) {
      this.spawnDamageText(this.enemySprite.x, this.enemySprite.y - 70, result.playerDamageDealt, "#ff8a6a");
    }
    if (result.enemyDamageDealt > 0) {
      this.spawnDamageText(this.playerSprite.x, this.playerSprite.y - 70, result.enemyDamageDealt, "#6ac9ff");
    }
    this.refreshBattleVisual();

    const outcome = battleOutcome(this.battle, false);
    if (outcome) {
      this.time.delayedCall(400, () => this.finishBattle(false));
      return;
    }

    this.time.delayedCall(BEAT_COOLDOWN_MS, () => {
      this.accepting = true;
    });
  }

  private onPlayerOugi(): void {
    if (this.phase !== "battle" || this.battle.playerGauge < OUGI_GAUGE_MAX) return;
    this.battle = applyPlayerOugi(this.battle);
    this.playSound(sfx.ougi);
    this.showClash("advantage", "punch", "punch", "奥義炸裂！");
    this.flashHit(this.enemySprite, 1);
    this.spawnDamageText(this.enemySprite.x, this.enemySprite.y - 70, 32, "#ffc94a");
    this.refreshBattleVisual();

    const outcome = battleOutcome(this.battle, false);
    if (outcome) {
      this.time.delayedCall(400, () => this.finishBattle(false));
    }
  }

  private showClash(clash: ClashResult, playerMove: MoveType, enemyMove: MoveType, overrideText?: string): void {
    const text =
      overrideText ??
      `${MOVE_LABEL[playerMove]} vs ${MOVE_LABEL[enemyMove]} ー ${
        clash === "advantage" ? "有利！" : clash === "disadvantage" ? "不利…" : "相殺！"
      }`;
    this.clashText.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.clashText, alpha: 0, delay: 500, duration: 300 });
  }

  private flashHit(sprite: Phaser.GameObjects.Graphics, damage: number): void {
    if (damage <= 0) return;
    this.tweens.add({ targets: sprite, x: sprite.x + (sprite === this.playerSprite ? -8 : 8), duration: 60, yoyo: true });
  }

  private spawnDamageText(x: number, y: number, damage: number, color: string): void {
    const obj = this.add
      .text(x + Phaser.Math.Between(-14, 14), y, `-${damage}`, {
        fontSize: "20px",
        color,
        fontStyle: "800",
        stroke: "#1a1410",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: obj,
      y: y - 40,
      alpha: 0,
      duration: 650,
      ease: "Cubic.easeOut",
      onComplete: () => obj.destroy(),
    });
  }

  private refreshBattleVisual(): void {
    const playerRatio = Phaser.Math.Clamp(this.battle.playerHp / MAX_HP, 0, 1);
    const enemyRatio = Phaser.Math.Clamp(this.battle.enemyHp / MAX_HP, 0, 1);
    this.playerHpFill.clear();
    this.playerHpFill.fillStyle(playerRatio < 0.3 ? 0xd1493b : 0x4ade80, 1);
    this.playerHpFill.fillRoundedRect(40, 30, 300 * playerRatio, 18, 6);

    this.enemyHpFill.clear();
    this.enemyHpFill.fillStyle(enemyRatio < 0.3 ? 0xd1493b : 0x4ade80, 1);
    this.enemyHpFill.fillRoundedRect(460 + 300 * (1 - enemyRatio), 30, 300 * enemyRatio, 18, 6);

    const gaugeRatio = Phaser.Math.Clamp(this.battle.playerGauge / OUGI_GAUGE_MAX, 0, 1);
    this.ougiFill.clear();
    this.ougiFill.fillStyle(0xffc94a, 1);
    this.ougiFill.fillRoundedRect(300, 420, 200 * gaugeRatio, 14, 6);
    this.ougiBtn.setEnabled(this.battle.playerGauge >= OUGI_GAUGE_MAX);
  }

  private updateTimerVisual(): void {
    this.timerText.setText(`残り ${Math.ceil(this.timeRemainingSec)}秒`);
  }

  private finishBattle(timeUp: boolean): void {
    this.phase = "result";
    this.accepting = false;
    const outcome = battleOutcome(this.battle, timeUp) ?? "draw";
    this.lastOutcome = outcome;

    let reward = LOSE_REWARD;
    if (outcome === "playerWin") {
      reward = WIN_REWARD;
      incrementWinCount();
      this.playSound(sfx.win);
    } else if (outcome === "draw") {
      reward = DRAW_REWARD;
    } else {
      this.playSound(sfx.lose);
    }
    const balance = addCurrency(reward);

    this.battleGroup.setVisible(false);
    const heading = this.resultGroup.getByName("heading") as Phaser.GameObjects.Text;
    const stats = this.resultGroup.getByName("stats") as Phaser.GameObjects.Text;

    const outcomeLabel = outcome === "playerWin" ? "勝利！" : outcome === "enemyWin" ? "敗北…" : "引き分け";
    heading.setText(outcomeLabel);
    stats.setText(`獲得: 豪拳石 +${reward}（所持: ${balance}）`);

    this.resultGroup.setVisible(true);
  }

  // ---------- 結果 ----------

  private buildResultScreen(): void {
    this.resultGroup = this.add.container(0, 0);
    const panel = drawPanel(this, 400, 300, 480, 320, { depth: 0 });

    const heading = this.add
      .text(400, 220, "", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5)
      .setName("heading");
    const stats = this.add
      .text(400, 280, "", { ...TYPE.body, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("stats");

    const retryBtn = makeButton(this, 400, 360, 200, 48, "もう一度あそぶ (R)", () => this.startBattle(), {
      fontSize: "15px",
    });
    const titleBtn = makeButton(this, 400, 420, 200, 44, "タイトルへ戻る", () => this.showTitle(), {
      fontSize: "14px",
    });

    this.resultGroup.add([panel, heading, stats, retryBtn.container, titleBtn.container]);
    this.resultGroup.setVisible(false);
  }

  // ---------- ガチャ ----------

  private buildGachaScreen(): void {
    this.gachaGroup = this.add.container(0, 0);
    const panel = drawPanel(this, 400, 300, 480, 320, { depth: 0 });

    const heading = this.add
      .text(400, 180, "ガチャ", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const costText = this.add
      .text(400, 220, `1回 豪拳石 ${GACHA_COST}`, { ...TYPE.body, color: THEME.textMuted })
      .setOrigin(0.5);
    const resultText = this.add
      .text(400, 280, "", { ...TYPE.h2, color: THEME.textPrimary })
      .setOrigin(0.5)
      .setName("gachaResult");
    const balanceText = this.add
      .text(400, 320, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("gachaBalance");

    const drawBtn = makeButton(this, 300, 400, 180, 48, "引く", () => this.rollGacha(), { fontSize: "16px" });
    const backBtn = makeButton(this, 500, 400, 180, 48, "タイトルへ戻る", () => this.showTitle(), {
      fontSize: "16px",
    });

    this.gachaGroup.add([panel, heading, costText, resultText, balanceText, drawBtn.container, backBtn.container]);
    this.gachaGroup.setVisible(false);
  }

  private openGacha(): void {
    this.phase = "title";
    this.titleGroup.setVisible(false);
    this.gachaGroup.setVisible(true);
    const resultText = this.gachaGroup.getByName("gachaResult") as Phaser.GameObjects.Text;
    resultText.setText("");
    this.refreshGachaBalance();
  }

  private refreshGachaBalance(): void {
    const balanceText = this.gachaGroup.getByName("gachaBalance") as Phaser.GameObjects.Text;
    balanceText.setText(`所持: 豪拳石 ${loadCurrency()}`);
  }

  private rollGacha(): void {
    const balance = loadCurrency();
    if (!canAffordGacha(balance)) {
      const resultText = this.gachaGroup.getByName("gachaResult") as Phaser.GameObjects.Text;
      resultText.setText("豪拳石が足りません…").setColor(THEME.textMuted);
      return;
    }
    spendCurrency(GACHA_COST);
    const item: GachaItem = drawGacha();
    const isRare = item.rarity === "SSR" || item.rarity === "SR";
    this.playSound(isRare ? sfx.gachaRare : sfx.gachaDraw);
    const resultText = this.gachaGroup.getByName("gachaResult") as Phaser.GameObjects.Text;
    resultText.setText(`【${item.rarity}】${item.name}`).setColor(hexToCss(RARITY_COLOR[item.rarity] ?? 0xffffff));
    this.tweens.add({ targets: resultText, scale: isRare ? 1.4 : 1.2, duration: isRare ? 180 : 120, yoyo: true });
    if (isRare) this.cameras.main.flash(200, 255, 220, 140);
    this.refreshGachaBalance();
  }

  // ---------- 共通 ----------

  private handleKeydown(e: KeyboardEvent): void {
    if (this.phase === "result" && (e.key === "r" || e.key === "R")) {
      this.startBattle();
      return;
    }
    if (this.phase === "battle" && this.accepting) {
      const index = ["1", "2", "3"].indexOf(e.key);
      if (index >= 0) {
        const move = MOVE_ORDER[index];
        if (move) this.onPlayerMove(move);
      }
    }
  }
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

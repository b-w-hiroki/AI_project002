import Phaser from "phaser";
import {
  COLORS,
  Round,
  RoundResult,
  generateRound,
  hexForColorId,
  nameForColorId,
  summarizeSession,
  timeLimitMsForLevel,
} from "../logic/round";
import { loadBestScore, saveBestScore } from "../logic/progress";
import { drawPanel, makeButton, THEME, TYPE } from "../ui/theme";

const ROUNDS_PER_SESSION = 12;
const FEEDBACK_DELAY_MS = 320;
const CARD_W = 150;
const CARD_H = 96;
const CARD_HOME_X = 400;
const CARD_HOME_Y = 190;
const BOX_W = 118;
const BOX_H = 70;

interface TargetBoxView {
  colorId: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  bounds: Phaser.Geom.Rectangle;
}

type Phase = "title" | "playing" | "result";

export class GameScene extends Phaser.Scene {
  private phase: Phase = "title";
  private level = 0;
  private roundIndex = 0;
  private results: RoundResult[] = [];
  private currentRound: Round | null = null;
  private roundStartedAt = 0;
  private accepting = false;
  private timeLimitMs = 0;
  private timeRemainingMs = 0;

  private promptCard!: Phaser.GameObjects.Container;
  private promptBg!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;
  private judgeModeText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private timerBarBg!: Phaser.GameObjects.Graphics;
  private timerBarFill!: Phaser.GameObjects.Graphics;
  private targetBoxes: TargetBoxView[] = [];

  private titleGroup!: Phaser.GameObjects.Container;
  private resultGroup!: Phaser.GameObjects.Container;
  private playGroup!: Phaser.GameObjects.Container;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0xfdf6e3);
    this.buildTitleScreen();
    this.buildPlayScreen();
    this.buildResultScreen();
    this.showTitle();

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => this.handleKeydown(e));
  }

  update(_time: number, delta: number): void {
    if (this.phase !== "playing" || !this.accepting) return;
    this.timeRemainingMs -= delta;
    if (this.timeRemainingMs <= 0) {
      this.timeRemainingMs = 0;
      this.updateTimerVisual();
      this.finishRound(null);
      return;
    }
    this.updateTimerVisual();
  }

  private buildTitleScreen(): void {
    this.titleGroup = this.add.container(0, 0);
    const panel = drawPanel(this, 400, 300, 580, 400, { depth: 0 });

    const title = this.add
      .text(400, 140, "カラーマッチ", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const rules = this.add
      .text(
        400,
        250,
        "毎回「内容」か「色」どちらかで判定します。\n指示に合う色の枠までカードをドラッグしてください。\n意味と色があえて食い違うカードが混じります。\n制限時間内に判断できないと失敗になります。",
        { ...TYPE.body, color: THEME.textMuted, align: "center" },
      )
      .setOrigin(0.5);
    const best = this.add
      .text(400, 360, `ベストスコア: ${loadBestScore()}`, { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);

    const startBtn = makeButton(this, 400, 420, 180, 48, "スタート", () => this.startSession(), {
      fontSize: "16px",
    });

    this.titleGroup.add([panel, title, rules, best, startBtn.container]);
    this.titleGroup.setData("bestText", best);
  }

  private buildPlayScreen(): void {
    this.playGroup = this.add.container(0, 0);

    this.progressText = this.add
      .text(400, 30, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);

    this.judgeModeText = this.add
      .text(400, 62, "", { ...TYPE.h2, color: THEME.textPrimary })
      .setOrigin(0.5);

    this.timerBarBg = this.add.graphics();
    this.timerBarBg.fillStyle(THEME.panelBorder, 0.4);
    this.timerBarBg.fillRoundedRect(300, 90, 200, 8, 4);
    this.timerBarFill = this.add.graphics();
    this.timerText = this.add
      .text(400, 112, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);

    this.promptBg = this.add.graphics();
    this.promptText = this.add.text(0, 0, "", { ...TYPE.numeric }).setOrigin(0.5);
    this.promptCard = this.add.container(CARD_HOME_X, CARD_HOME_Y, [this.promptBg, this.promptText]);
    this.promptCard.setSize(CARD_W, CARD_H);
    this.drawPromptBg(THEME.panelBorder);

    this.buildTargetBoxes();

    this.playGroup.add([
      this.progressText,
      this.judgeModeText,
      this.timerBarBg,
      this.timerBarFill,
      this.timerText,
      this.promptCard,
    ]);

    this.setupDrag();
  }

  private buildTargetBoxes(): void {
    const cols = 3;
    const gapX = 20;
    const gapY = 18;
    const totalW = cols * BOX_W + (cols - 1) * gapX;
    const startX = 400 - totalW / 2 + BOX_W / 2;
    const startY = 380;

    COLORS.forEach((color, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (BOX_W + gapX);
      const y = startY + row * (BOX_H + gapY);

      const bg = this.add.graphics();
      this.drawTargetBox(bg, color.hex, false);

      const label = this.add
        .text(0, 0, color.name, { ...TYPE.body, fontStyle: "700" })
        .setOrigin(0.5)
        .setColor(hexToCss(color.hex));

      const container = this.add.container(x, y, [bg, label]).setSize(BOX_W, BOX_H);
      this.playGroup.add(container);

      this.targetBoxes.push({
        colorId: color.id,
        container,
        bg,
        bounds: new Phaser.Geom.Rectangle(x - BOX_W / 2, y - BOX_H / 2, BOX_W, BOX_H),
      });
    });
  }

  private drawTargetBox(g: Phaser.GameObjects.Graphics, colorHex: number, highlight: boolean): void {
    g.clear();
    g.fillStyle(colorHex, highlight ? 0.28 : 0.12);
    g.fillRoundedRect(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H, 12);
    g.lineStyle(highlight ? 3 : 2, colorHex, highlight ? 1 : 0.6);
    g.strokeRoundedRect(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H, 12);
  }

  private drawPromptBg(borderColor: number | string): void {
    this.promptBg.clear();
    this.promptBg.fillStyle(THEME.panelFill, 0.98);
    this.promptBg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16);
    this.promptBg.lineStyle(2.5, typeof borderColor === "number" ? borderColor : THEME.panelBorder, 0.9);
    this.promptBg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16);
  }

  private setupDrag(): void {
    this.promptCard.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.promptCard);

    this.promptCard.on("dragstart", () => {
      if (!this.accepting) return;
      this.promptCard.setDepth(10);
      // ドラッグ中は半透明にして、下に隠れる枠のホバー表示が見えるようにする
      this.promptCard.setAlpha(0.7);
    });

    this.promptCard.on(
      "drag",
      (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (!this.accepting) return;
        this.promptCard.setPosition(dragX, dragY);
        this.updateHoverHighlight(dragX, dragY);
      },
    );

    this.promptCard.on("dragend", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.accepting) return;
      const dropped = this.targetBoxes.find((box) => box.bounds.contains(dragX, dragY));
      this.clearHoverHighlight();
      this.promptCard.setAlpha(1);
      if (dropped) {
        this.finishRound(dropped.colorId);
      } else {
        this.tweens.add({
          targets: this.promptCard,
          x: CARD_HOME_X,
          y: CARD_HOME_Y,
          duration: 180,
          ease: "Back.easeOut",
        });
      }
    });
  }

  private updateHoverHighlight(x: number, y: number): void {
    for (const box of this.targetBoxes) {
      const hovering = box.bounds.contains(x, y);
      this.drawTargetBox(box.bg, hexForColorId(box.colorId), hovering);
    }
  }

  private clearHoverHighlight(): void {
    for (const box of this.targetBoxes) {
      this.drawTargetBox(box.bg, hexForColorId(box.colorId), false);
    }
  }

  private buildResultScreen(): void {
    this.resultGroup = this.add.container(0, 0);
    const panel = drawPanel(this, 400, 300, 480, 340, { depth: 0 });

    const heading = this.add
      .text(400, 170, "", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5)
      .setName("heading");
    const stats = this.add
      .text(400, 260, "", { ...TYPE.body, color: THEME.textMuted, align: "center" })
      .setOrigin(0.5)
      .setName("stats");
    const bestLine = this.add
      .text(400, 320, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("bestLine");

    const retryBtn = makeButton(this, 400, 400, 200, 48, "もう一度あそぶ (R)", () => this.startSession(), {
      fontSize: "15px",
    });

    this.resultGroup.add([panel, heading, stats, bestLine, retryBtn.container]);
    this.resultGroup.setVisible(false);
  }

  private showTitle(): void {
    this.phase = "title";
    this.titleGroup.setVisible(true);
    this.playGroup.setVisible(false);
    this.resultGroup.setVisible(false);
    const bestText = this.titleGroup.getData("bestText") as Phaser.GameObjects.Text;
    bestText.setText(`ベストスコア: ${loadBestScore()}`);
  }

  private startSession(): void {
    this.phase = "playing";
    this.level = 0;
    this.roundIndex = 0;
    this.results = [];
    this.titleGroup.setVisible(false);
    this.resultGroup.setVisible(false);
    this.playGroup.setVisible(true);
    this.nextRound();
  }

  private nextRound(): void {
    if (this.roundIndex >= ROUNDS_PER_SESSION) {
      this.endSession();
      return;
    }
    const round = generateRound();
    this.currentRound = round;
    this.timeLimitMs = timeLimitMsForLevel(this.level);
    this.timeRemainingMs = this.timeLimitMs;
    this.level += 1;
    this.roundIndex += 1;
    this.accepting = true;

    this.progressText.setText(`ラウンド ${this.roundIndex} / ${ROUNDS_PER_SESSION}`);
    this.judgeModeText.setText(
      round.judgeMode === "content" ? "文字の「内容」に合う枠へドラッグ" : "文字の「色」に合う枠へドラッグ",
    );
    this.promptText.setText(nameForColorId(round.promptWord)).setColor(hexToCss(hexForColorId(round.promptInk)));
    this.drawPromptBg(THEME.panelBorder);
    this.promptCard.setPosition(CARD_HOME_X, CARD_HOME_Y).setScale(1).setDepth(1).setAlpha(1);
    this.clearHoverHighlight();
    this.updateTimerVisual();

    this.roundStartedAt = performance.now();
  }

  private updateTimerVisual(): void {
    const ratio = this.timeLimitMs > 0 ? Phaser.Math.Clamp(this.timeRemainingMs / this.timeLimitMs, 0, 1) : 0;
    this.timerBarFill.clear();
    const color = ratio < 0.25 ? 0xd1495b : ratio < 0.5 ? 0xd6a71a : 0x3fae6a;
    this.timerBarFill.fillStyle(color, 0.9);
    this.timerBarFill.fillRoundedRect(300, 90, 200 * ratio, 8, 4);
    this.timerText.setText(`残り ${(this.timeRemainingMs / 1000).toFixed(1)}秒`);
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.phase === "result" && (e.key === "r" || e.key === "R")) {
      this.startSession();
    }
  }

  /** colorId が null ならタイムアウト扱い */
  private finishRound(colorId: string | null): void {
    if (!this.accepting || !this.currentRound) return;
    this.accepting = false;
    const reactionMs = performance.now() - this.roundStartedAt;
    const timedOut = colorId === null;
    const correct = !timedOut && colorId === this.currentRound.correctColorId;
    this.results.push({ correct, timedOut, reactionMs: timedOut ? this.timeLimitMs : reactionMs });

    const feedbackColor = correct ? 0x3fae6a : 0xd1495b;
    this.drawPromptBg(feedbackColor);
    if (correct) {
      this.tweens.add({ targets: this.promptCard, scale: 1.15, duration: 120, yoyo: true });
    } else {
      this.cameras.main.shake(120, 0.006);
      this.tweens.add({
        targets: this.promptCard,
        x: CARD_HOME_X,
        y: CARD_HOME_Y,
        duration: 120,
      });
    }

    this.time.delayedCall(FEEDBACK_DELAY_MS, () => this.nextRound());
  }

  private endSession(): void {
    this.phase = "result";
    this.playGroup.setVisible(false);

    const summary = summarizeSession(this.results);
    saveBestScore(summary.score);
    const best = loadBestScore();

    const heading = this.resultGroup.getByName("heading") as Phaser.GameObjects.Text;
    const stats = this.resultGroup.getByName("stats") as Phaser.GameObjects.Text;
    const bestLine = this.resultGroup.getByName("bestLine") as Phaser.GameObjects.Text;

    heading.setText(`スコア ${summary.score}`);
    stats.setText(
      `正答率: ${Math.round(summary.accuracy * 100)}%  平均反応: ${Math.round(summary.avgReactionMs)}ms`,
    );
    bestLine.setText(`ベストスコア: ${best}`);

    this.resultGroup.setVisible(true);
  }
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

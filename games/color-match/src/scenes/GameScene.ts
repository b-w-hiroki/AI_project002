import Phaser from "phaser";
import {
  CandidateCard,
  Round,
  RoundResult,
  generateRound,
  hexForColorId,
  nameForColorId,
  summarizeSession,
} from "../logic/round";
import { loadBestScore, saveBestScore } from "../logic/progress";
import { drawPanel, makeButton, THEME, TYPE } from "../ui/theme";

const ROUNDS_PER_SESSION = 12;
const FEEDBACK_DELAY_MS = 260;

interface ChoiceCardView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  card: CandidateCard;
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

  private promptCard!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private judgeModeText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private choiceViews: ChoiceCardView[] = [];

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

  private buildTitleScreen(): void {
    this.titleGroup = this.add.container(0, 0);
    const panel = drawPanel(this, 400, 300, 560, 380, { depth: 0 });

    const title = this.add
      .text(400, 150, "カラーマッチ", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const rules = this.add
      .text(
        400,
        260,
        "毎回「内容」か「色」どちらかで判定します。\n指示に合うカードをすばやく選んでください。\n意味と色があえて食い違うカードが混じります。",
        { ...TYPE.body, color: THEME.textMuted, align: "center" },
      )
      .setOrigin(0.5);
    const best = this.add
      .text(400, 340, `ベストスコア: ${loadBestScore()}`, { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);

    const startBtn = makeButton(this, 400, 400, 180, 48, "スタート", () => this.startSession(), {
      fontSize: "16px",
    });

    this.titleGroup.add([panel, title, rules, best, startBtn.container]);
    this.titleGroup.setData("bestText", best);
  }

  private buildPlayScreen(): void {
    this.playGroup = this.add.container(0, 0);

    this.progressText = this.add
      .text(400, 40, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);

    this.judgeModeText = this.add
      .text(400, 90, "", { ...TYPE.h2, color: THEME.textPrimary })
      .setOrigin(0.5);

    const promptPanel = drawPanel(this, 400, 180, 220, 90, { depth: 0 });
    this.promptText = this.add.text(400, 180, "", { ...TYPE.numeric }).setOrigin(0.5);
    this.promptCard = this.add.container(0, 0, [promptPanel, this.promptText]);

    this.playGroup.add([this.progressText, this.judgeModeText, this.promptCard]);
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
    this.clearChoiceViews();
    const round = generateRound(this.level);
    this.currentRound = round;
    this.level += 1;
    this.roundIndex += 1;
    this.accepting = true;

    this.progressText.setText(`ラウンド ${this.roundIndex} / ${ROUNDS_PER_SESSION}`);
    this.judgeModeText.setText(
      round.judgeMode === "content" ? "文字の「内容」に合うカードを選べ" : "文字の「色」に合うカードを選べ",
    );
    this.promptText.setText(nameForColorId(round.promptWord)).setColor(hexToCss(hexForColorId(round.promptInk)));

    this.renderChoices(round.choices);
    this.roundStartedAt = performance.now();
  }

  private renderChoices(choices: CandidateCard[]): void {
    const count = choices.length;
    const cols = count <= 4 ? count : Math.ceil(count / 2);
    const cardW = 120;
    const cardH = 80;
    const gapX = 24;
    const gapY = 20;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const startX = 400 - totalW / 2 + cardW / 2;
    const startY = 340;

    choices.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      const bg = this.add.graphics();
      bg.fillStyle(THEME.panelFill, 0.95);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
      bg.lineStyle(2, THEME.panelBorder, 0.9);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);

      const label = this.add
        .text(0, 0, nameForColorId(card.word), { ...TYPE.body, fontStyle: "700" })
        .setOrigin(0.5)
        .setColor(hexToCss(hexForColorId(card.ink)));

      const container = this.add.container(x, y, [bg, label]).setSize(cardW, cardH);
      container.setInteractive({ useHandCursor: true });
      container.on("pointerdown", () => this.submitAnswer(i, container, bg));
      this.playGroup.add(container);

      this.choiceViews.push({ container, bg, card });
    });
  }

  private clearChoiceViews(): void {
    for (const view of this.choiceViews) view.container.destroy();
    this.choiceViews = [];
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.phase === "result" && (e.key === "r" || e.key === "R")) {
      this.startSession();
      return;
    }
    if (this.phase !== "playing" || !this.accepting) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= this.choiceViews.length) {
      const view = this.choiceViews[n - 1]!;
      this.submitAnswer(n - 1, view.container, view.bg);
    }
  }

  private submitAnswer(index: number, container: Phaser.GameObjects.Container, bg: Phaser.GameObjects.Graphics): void {
    if (!this.accepting || !this.currentRound) return;
    this.accepting = false;
    const reactionMs = performance.now() - this.roundStartedAt;
    const correct = index === this.currentRound.correctIndex;
    this.results.push({ correct, reactionMs });

    const cardW = 120;
    const cardH = 80;
    bg.clear();
    bg.fillStyle(correct ? 0x3fae6a : 0xd1495b, 0.25);
    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    bg.lineStyle(3, correct ? 0x3fae6a : 0xd1495b, 1);
    bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    this.tweens.add({ targets: container, scale: 1.06, duration: 100, yoyo: true });

    this.time.delayedCall(FEEDBACK_DELAY_MS, () => this.nextRound());
  }

  private endSession(): void {
    this.phase = "result";
    this.playGroup.setVisible(false);
    this.clearChoiceViews();

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

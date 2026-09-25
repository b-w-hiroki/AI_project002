import {
  CHALLENGE_MS,
  challengeRound,
  nextSwitchAt,
  accuracyFor,
  type ChallengeResult,
} from "../logic/challenge";
import Phaser from "phaser";
import {
  COLORS,
  Round,
  TURBO_ENTRY_STREAK,
  TURBO_FAST_MS,
  WRITING_MODES,
  WRITING_MODE_LABEL,
  WritingMode,
  generateRound,
  hexForColorId,
  nameForColorId,
  pointsForStreak,
  summarizeSession,
  timeLimitMsForLevel,
} from "../logic/round";
import {
  loadBestScore,
  loadBestTurbo,
  loadPerformanceStats,
  loadWritingMode,
  metricAccuracy,
  metricAvgReaction,
  recordPerformance,
  saveBestScore,
  saveBestTurbo,
  saveWritingMode,
  weakestJudgeMode,
} from "../logic/progress";
import { detectLang, t, writingModeLabel, type Lang } from "../logic/i18n";
import { cg } from "../platform/crazygames";
import { sfx } from "../platform/audio";
import { drawPanel, makeButton, THEME, TYPE } from "../ui/theme";

/** スマホでの片手持ちを想定した縦持ちレイアウト。中央X座標 */
const CX = 225;

const FEEDBACK_DELAY_MS = 320;
const CARD_W = 176;
const CARD_H = 112;
const CARD_HOME_X = CX;
const CARD_HOME_Y = 260;
const BOX_W = 166;
const BOX_H = 84;
const TURBO_COLOR = 0xff7a3d;
const PRACTICE_MS = 20_000;
/** 画像アセットのキー（docs/art-assets.md の asset-id と一致させる） */
const MASCOT_KEY = "cm-mascot";
const TURBO_BADGE_KEY = "cm-turbo-badge";
const ANSWER_BUTTONS_KEY = "cm-answer-buttons";

interface TargetBoxView {
  colorId: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  bounds: Phaser.Geom.Rectangle;
}

interface ModeButtonView {
  mode: WritingMode;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  container: Phaser.GameObjects.Container;
}

type Phase = "title" | "playing" | "result";
type SessionMode = "challenge" | "practice";

export class GameScene extends Phaser.Scene {
  private phase: Phase = "title";
  private level = 0;
  private roundIndex = 0;
  private results: ChallengeResult[] = [];
  private sessionRemaining = CHALLENGE_MS;
  private sessionDurationMs = CHALLENGE_MS;
  private sessionMode: SessionMode = "challenge";
  private practiceJudgeMode: "content" | "color" = "content";
  private previousMode: "content" | "color" | null = null;
  private switched = false;
  private switchHint!: Phaser.GameObjects.Text;
  private pendingRound?: Phaser.Time.TimerEvent;
  private currentRound: Round | null = null;
  private roundStartedAt = 0;
  private accepting = false;
  private timeLimitMs = 0;
  private timeRemainingMs = 0;
  private turboStreak = 0;
  private turboPoints = 0;
  private writingMode: WritingMode = "hiragana";
  private lang: Lang = "en";

  private promptCard!: Phaser.GameObjects.Container;
  private promptBg!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;
  private judgeModeText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private timerBarBg!: Phaser.GameObjects.Graphics;
  private timerBarFill!: Phaser.GameObjects.Graphics;
  private turboText!: Phaser.GameObjects.Text;
  /** ターボ中に HUD に出し続ける小バッジ。画像が無い場合は null（turboText のみで表現） */
  private turboHudBadge: Phaser.GameObjects.Image | null = null;
  private targetBoxes: TargetBoxView[] = [];
  private modeButtons: ModeButtonView[] = [];

  private titleGroup!: Phaser.GameObjects.Container;
  private resultGroup!: Phaser.GameObjects.Container;
  private playGroup!: Phaser.GameObjects.Container;

  constructor() {
    super("GameScene");
  }

  preload(): void {
    // 画像はいずれも任意。読み込みに失敗しても textures.exists() で判定し、従来の Graphics/Text 表現にフォールバックする
    this.load.image(MASCOT_KEY, `images/${MASCOT_KEY}.png`);
    this.load.image(TURBO_BADGE_KEY, `images/${TURBO_BADGE_KEY}.png`);
    this.load.image(ANSWER_BUTTONS_KEY, "images/generated/ui/cm-answer-buttons.webp");
  }

  create(): void {
    cg.gameplayStart();
    this.cameras.main.setBackgroundColor(0xfdf6e3);
    this.lang = detectLang();
    document.documentElement.lang = this.lang;
    this.writingMode = loadWritingMode();
    this.buildTitleScreen();
    this.buildPlayScreen();
    this.buildResultScreen();
    this.showTitle();

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) =>
      this.handleKeydown(e),
    );
  }

  update(_time: number, delta: number): void {
    if (this.phase !== "playing") return;
    this.sessionRemaining = Math.max(0, this.sessionRemaining - delta);
    this.progressText.setText(
      this.sessionMode === "practice"
        ? `${t(this.lang, "practice")} · ${this.practiceJudgeMode === "content" ? t(this.lang, "contentMeaning") : t(this.lang, "inkColor")} · ${t(this.lang, "remaining")} ${Math.ceil(this.sessionRemaining / 1000)}s · ${this.roundIndex}${t(this.lang, "questions")}`
        : `${t(this.lang, "challenge")} · ${t(this.lang, "remaining")} ${Math.ceil(this.sessionRemaining / 1000)}s · ${this.roundIndex}${t(this.lang, "questions")}`,
    );
    if (this.sessionRemaining <= 0) {
      if (this.accepting && this.currentRound) {
        this.results.push({
          correct: false,
          timedOut: true,
          reactionMs: Math.min(
            this.timeLimitMs,
            performance.now() - this.roundStartedAt,
          ),
          mode: this.currentRound.judgeMode,
          switched: this.switched,
        });
      }
      this.accepting = false;
      this.pendingRound?.remove(false);
      this.endSession();
      return;
    }
    const elapsed = this.sessionDurationMs - this.sessionRemaining;
    if (this.sessionMode === "practice") {
      this.switchHint.setText(
        this.practiceJudgeMode === "content"
          ? t(this.lang, "practiceContentHint")
          : t(this.lang, "practiceColorHint"),
      );
    } else {
      const until = nextSwitchAt(elapsed) - elapsed;
      this.switchHint.setText(
        until <= 2000
          ? t(this.lang, "switchSoon")
          : t(this.lang, "switchGuide"),
      );
    }
    if (!this.accepting) return;
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
    const panel = drawPanel(this, CX, 400, 400, 700, { depth: 0 });

    // マスコット画像がある時はタイトル文字を右へ寄せ、左隣にマスコットを置く。無ければ従来の中央揃え
    const hasMascot = this.textures.exists(MASCOT_KEY);
    const title = this.add
      .text(hasMascot ? CX + 55 : CX, 110, t(this.lang, "title"), {
        ...TYPE.h1,
        color: THEME.textPrimary,
      })
      .setOrigin(0.5);
    const rules = this.add
      .text(
        CX,
        260,
        t(this.lang, "rules"),
        { ...TYPE.body, color: THEME.textMuted, align: "center" },
      )
      .setOrigin(0.5);

    const modeLabel = this.add
      .text(CX, 430, t(this.lang, "writing"), { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);
    this.titleGroup.add([panel, title, rules, modeLabel]);
    if (hasMascot) {
      // パネルより後に追加してパネルの上に描画する
      const mascot = this.add
        .image(105, 118, MASCOT_KEY)
        .setDisplaySize(120, 120);
      this.titleGroup.add(mascot);
      this.tweens.add({
        targets: mascot,
        y: mascot.y - 6,
        duration: 1400,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }
    this.buildWritingModeSelector();

    const best = this.add
      .text(
        CX,
        580,
        `${t(this.lang, "bestScore")}: ${loadBestScore()}\n${t(this.lang, "bestTurbo")}: ${loadBestTurbo()}pt`,
        {
          ...TYPE.small,
          color: THEME.textMuted,
          align: "center",
        },
      )
      .setOrigin(0.5);

    const startBtn = makeButton(
      this,
      CX,
      650,
      260,
      52,
      t(this.lang, "challenge"),
      () => this.startSession("challenge"),
      {
        fontSize: "16px",
      },
    );
    const practiceBtn = makeButton(
      this,
      CX,
      716,
      260,
      48,
      t(this.lang, "practice"),
      () => this.startPractice(),
      {
        fontSize: "15px",
      },
    );

    this.titleGroup.add([best, startBtn.container, practiceBtn.container]);
    this.titleGroup.setData("bestText", best);
  }

  private buildWritingModeSelector(): void {
    const buttonW = 150;
    const buttonH = 40;
    const gapX = 20;
    const gapY = 12;
    const cols = 2;
    const totalW = cols * buttonW + (cols - 1) * gapX;
    const startX = CX - totalW / 2 + buttonW / 2;
    const startY = 470;

    WRITING_MODES.forEach((mode, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (buttonW + gapX);
      const y = startY + row * (buttonH + gapY);

      const bg = this.add.graphics();
      const label = this.add
        .text(0, 0, writingModeLabel(this.lang, mode), {
          ...TYPE.small,
          fontStyle: "700",
          color: THEME.textPrimary,
        })
        .setOrigin(0.5);
      const container = this.add
        .container(x, y, [bg, label])
        .setSize(buttonW, buttonH);
      container.setInteractive({ useHandCursor: true });
      container.on("pointerdown", () => this.setWritingMode(mode));
      this.titleGroup.add(container);
      this.modeButtons.push({ mode, bg, label, container });
    });

    this.refreshWritingModeButtons();
  }

  private setWritingMode(mode: WritingMode): void {
    this.writingMode = mode;
    saveWritingMode(mode);
    this.refreshWritingModeButtons();
    this.refreshTargetBoxLabels();
  }

  private refreshWritingModeButtons(): void {
    const buttonW = 150;
    const buttonH = 40;
    for (const view of this.modeButtons) {
      const selected = view.mode === this.writingMode;
      view.bg.clear();
      view.bg.fillStyle(
        selected ? TURBO_COLOR : THEME.panelFill,
        selected ? 1 : 0.95,
      );
      view.bg.fillRoundedRect(-buttonW / 2, -buttonH / 2, buttonW, buttonH, 8);
      view.bg.lineStyle(
        selected ? 2.5 : 1.5,
        selected ? TURBO_COLOR : THEME.panelBorder,
        selected ? 1 : 0.7,
      );
      view.bg.strokeRoundedRect(
        -buttonW / 2,
        -buttonH / 2,
        buttonW,
        buttonH,
        8,
      );
      view.label.setColor(selected ? "#ffffff" : THEME.textPrimary);
    }
  }

  private buildPlayScreen(): void {
    this.playGroup = this.add.container(0, 0);

    this.progressText = this.add
      .text(CX, 40, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);

    this.judgeModeText = this.add
      .text(CX, 80, "", {
        ...TYPE.h2,
        color: THEME.textPrimary,
        align: "center",
      })
      .setOrigin(0.5);

    this.timerBarBg = this.add.graphics();
    this.timerBarBg.fillStyle(THEME.panelBorder, 0.4);
    this.timerBarBg.fillRoundedRect(CX - 130, 130, 260, 8, 4);
    this.timerBarFill = this.add.graphics();
    this.timerText = this.add
      .text(CX, 155, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);

    this.turboText = this.add
      .text(CX, 185, "", {
        ...TYPE.body,
        color: hexToCss(TURBO_COLOR),
        fontStyle: "800",
      })
      .setOrigin(0.5)
      .setVisible(false);
    if (this.textures.exists(TURBO_BADGE_KEY)) {
      // ターボ中の常時表示バッジ（テキストの左隣）。入力は受け取らない
      this.turboHudBadge = this.add
        .image(CX - 110, 185, TURBO_BADGE_KEY)
        .setDisplaySize(36, 36)
        .setVisible(false);
    }

    this.promptBg = this.add.graphics();
    this.promptText = this.add
      .text(0, 0, "", { ...TYPE.numeric })
      .setOrigin(0.5);
    this.promptCard = this.add.container(CARD_HOME_X, CARD_HOME_Y, [
      this.promptBg,
      this.promptText,
    ]);
    this.promptCard.setSize(CARD_W, CARD_H);
    this.drawPromptBg(THEME.panelBorder);

    this.buildTargetBoxes();

    this.playGroup.add([
      this.progressText,
      this.judgeModeText,
      this.timerBarBg,
      this.timerBarFill,
      this.timerText,
      this.turboText,
      this.promptCard,
    ]);
    if (this.turboHudBadge) this.playGroup.add(this.turboHudBadge);

    this.switchHint = this.add
      .text(CX, 735, "", {
        fontSize: "13px",
        color: "#675c4b",
        align: "center",
        wordWrap: { width: 380, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.playGroup.add(this.switchHint);
    this.setupDrag();
  }

  private buildTargetBoxes(): void {
    if (this.textures.exists(ANSWER_BUTTONS_KEY)) {
      const answerArt = this.add
        .image(CX, 526, ANSWER_BUTTONS_KEY)
        .setDisplaySize(370, 282)
        .setAlpha(0.96);
      this.playGroup.add(answerArt);
    }

    const cols = 2;
    const gapX = 20;
    const gapY = 16;
    const totalW = cols * BOX_W + (cols - 1) * gapX;
    const startX = CX - totalW / 2 + BOX_W / 2;
    const startY = 430;

    COLORS.forEach((color, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (BOX_W + gapX);
      const y = startY + row * (BOX_H + gapY);

      const bg = this.add.graphics();
      this.drawTargetBox(bg, color.hex, false);

      const label = this.add
        .text(0, 0, nameForColorId(color.id, this.writingMode), {
          ...TYPE.body,
          fontStyle: "700",
        })
        .setOrigin(0.5)
        .setColor(hexToCss(color.hex));

      const container = this.add
        .container(x, y, [bg, label])
        .setSize(BOX_W, BOX_H);
      this.playGroup.add(container);

      this.targetBoxes.push({
        colorId: color.id,
        container,
        bg,
        label,
        bounds: new Phaser.Geom.Rectangle(
          x - BOX_W / 2,
          y - BOX_H / 2,
          BOX_W,
          BOX_H,
        ),
      });
    });
  }

  private refreshTargetBoxLabels(): void {
    for (const view of this.targetBoxes) {
      view.label.setText(nameForColorId(view.colorId, this.writingMode));
    }
  }

  private drawTargetBox(
    g: Phaser.GameObjects.Graphics,
    colorHex: number,
    highlight: boolean,
  ): void {
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
    this.promptBg.lineStyle(
      2.5,
      typeof borderColor === "number" ? borderColor : THEME.panelBorder,
      0.9,
    );
    this.promptBg.strokeRoundedRect(
      -CARD_W / 2,
      -CARD_H / 2,
      CARD_W,
      CARD_H,
      16,
    );
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

    this.promptCard.on("dragend", () => {
      if (!this.accepting) return;
      // Phaser の dragend イベントは dragX/dragY を渡さない（常に0）ため、
      // drag イベントで随時更新しているカードの現在位置を使う
      const dropX = this.promptCard.x;
      const dropY = this.promptCard.y;
      const dropped = this.targetBoxes.find((box) =>
        box.bounds.contains(dropX, dropY),
      );
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
    const panel = drawPanel(this, CX, 400, 380, 460, { depth: 0 });

    // スコア見出しの右隣に小さなマスコット。画像が無ければ見出しは従来通り中央揃え
    const hasMascot = this.textures.exists(MASCOT_KEY);
    const heading = this.add
      .text(hasMascot ? CX - 35 : CX, 260, "", {
        ...TYPE.h1,
        color: THEME.textPrimary,
      })
      .setOrigin(0.5)
      .setName("heading");
    const resultMascot = hasMascot
      ? this.add.image(CX + 120, 255, MASCOT_KEY).setDisplaySize(72, 72)
      : null;
    const stats = this.add
      .text(CX, 350, "", {
        ...TYPE.body,
        color: THEME.textMuted,
        align: "center",
      })
      .setOrigin(0.5)
      .setName("stats");
    const bestLine = this.add
      .text(CX, 430, "", {
        ...TYPE.small,
        color: THEME.textMuted,
        align: "center",
      })
      .setOrigin(0.5)
      .setName("bestLine");

    const retryBtn = makeButton(
      this,
      CX,
      510,
      280,
      52,
      t(this.lang, "retry"),
      () => this.startSession(),
      {
        fontSize: "15px",
      },
    );

    this.resultGroup.add([panel, heading, stats, bestLine, retryBtn.container]);
    if (resultMascot) this.resultGroup.add(resultMascot);
    this.resultGroup.setVisible(false);
  }

  private showTitle(): void {
    this.phase = "title";
    this.titleGroup.setVisible(true);
    this.playGroup.setVisible(false);
    this.resultGroup.setVisible(false);
    const bestText = this.titleGroup.getData(
      "bestText",
    ) as Phaser.GameObjects.Text;
    bestText.setText(
      `${t(this.lang, "bestScore")}: ${loadBestScore()}\n${t(this.lang, "bestTurbo")}: ${loadBestTurbo()}pt`,
    );
  }

  private startPractice(): void {
    this.practiceJudgeMode = weakestJudgeMode();
    this.startSession("practice");
  }

  private startSession(mode: SessionMode = "challenge"): void {
    this.pendingRound?.remove(false);
    this.sessionMode = mode;
    this.sessionDurationMs = mode === "practice" ? PRACTICE_MS : CHALLENGE_MS;
    this.sessionRemaining = this.sessionDurationMs;
    if (mode === "practice") this.practiceJudgeMode = weakestJudgeMode();
    this.previousMode = null;
    this.phase = "playing";
    this.level = 0;
    this.roundIndex = 0;
    this.results = [];
    this.turboStreak = 0;
    this.turboPoints = 0;
    this.turboText.setVisible(false);
    this.turboHudBadge?.setVisible(false);
    this.titleGroup.setVisible(false);
    this.resultGroup.setVisible(false);
    this.playGroup.setVisible(true);
    this.nextRound();
  }

  private nextRound(): void {
    if (this.phase !== "playing") return;
    if (this.sessionRemaining <= 0) {
      this.endSession();
      return;
    }
    const round = this.sessionMode === "practice"
      ? (() => {
          const base = generateRound();
          return {
            ...base,
            judgeMode: this.practiceJudgeMode,
            correctColorId: this.practiceJudgeMode === "content" ? base.promptWord : base.promptInk,
          };
        })()
      : challengeRound(CHALLENGE_MS - this.sessionRemaining);
    this.switched =
      this.previousMode !== null && this.previousMode !== round.judgeMode;
    this.previousMode = round.judgeMode;
    this.currentRound = round;
    this.timeLimitMs = timeLimitMsForLevel(this.level);
    this.timeRemainingMs = this.timeLimitMs;
    this.level += 1;
    this.roundIndex += 1;
    this.accepting = true;

    this.progressText.setText(
      this.sessionMode === "practice"
        ? `${t(this.lang, "practice")} · ${this.practiceJudgeMode === "content" ? t(this.lang, "contentMeaning") : t(this.lang, "inkColor")} · ${this.roundIndex}${t(this.lang, "questions")}`
        : `${t(this.lang, "challenge")} · ${this.roundIndex}${t(this.lang, "questions")}`,
    );
    this.judgeModeText.setText(
      round.judgeMode === "content"
        ? t(this.lang, "dragContent")
        : t(this.lang, "dragColor"),
    );
    const word = nameForColorId(round.promptWord, this.writingMode);
    this.promptText
      .setText(word)
      .setFontSize(promptFontSizeFor(word))
      .setColor(hexToCss(hexForColorId(round.promptInk)));
    this.drawPromptBg(THEME.panelBorder);
    this.promptCard
      .setPosition(CARD_HOME_X, CARD_HOME_Y)
      .setScale(1)
      .setDepth(1)
      .setAlpha(1);
    this.clearHoverHighlight();
    this.updateTimerVisual();

    this.roundStartedAt = performance.now();
  }

  private updateTimerVisual(): void {
    const ratio =
      this.timeLimitMs > 0
        ? Phaser.Math.Clamp(this.timeRemainingMs / this.timeLimitMs, 0, 1)
        : 0;
    this.timerBarFill.clear();
    const color = ratio < 0.25 ? 0xd1495b : ratio < 0.5 ? 0xd6a71a : 0x3fae6a;
    this.timerBarFill.fillStyle(color, 0.9);
    this.timerBarFill.fillRoundedRect(CX - 130, 130, 260 * ratio, 8, 4);
    this.timerText.setText(
      `${t(this.lang, "remaining")} ${(this.timeRemainingMs / 1000).toFixed(1)}s`,
    );
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
    this.results.push({
      correct,
      timedOut,
      reactionMs: timedOut ? this.timeLimitMs : reactionMs,
      mode: this.currentRound.judgeMode,
      switched: this.switched,
    });

    const feedbackColor = correct ? 0x3fae6a : 0xd1495b;
    this.drawPromptBg(feedbackColor);
    this.spawnRoundFeedbackFx(correct, timedOut);
    if (correct) sfx.correct();
    else sfx.miss();
    if (correct) {
      this.tweens.add({
        targets: this.promptCard,
        scale: 1.15,
        duration: 120,
        yoyo: true,
      });
    } else {
      this.cameras.main.shake(120, 0.006);
      this.tweens.add({
        targets: this.promptCard,
        x: CARD_HOME_X,
        y: CARD_HOME_Y,
        duration: 120,
      });
    }

    this.applyTurboResult(correct && !timedOut && reactionMs < TURBO_FAST_MS);

    this.pendingRound = this.time.delayedCall(FEEDBACK_DELAY_MS, () =>
      this.nextRound(),
    );
  }

  /** 1秒以内の正解が続く限りターボ連続数を伸ばし、段階表に応じたポイントを加算する */
  private applyTurboResult(fastCorrect: boolean): void {
    if (!fastCorrect) {
      if (this.turboStreak >= TURBO_ENTRY_STREAK) {
        this.turboText.setVisible(false);
        this.turboHudBadge?.setVisible(false);
        sfx.flowBreak();
      }
      this.turboStreak = 0;
      return;
    }

    this.turboStreak += 1;
    const points = pointsForStreak(this.turboStreak);
    this.turboPoints += points;
    this.spawnPointsPopup(`+${points}pt`);

    if (this.turboStreak >= TURBO_ENTRY_STREAK) {
      this.turboText
        .setText(`🔥 ${t(this.lang, "turbo")} ×${this.turboStreak}`)
        .setVisible(true);
      this.tweens.add({
        targets: this.turboText,
        scale: 1.25,
        duration: 100,
        yoyo: true,
      });
      this.turboHudBadge?.setVisible(true);
      if (this.turboStreak === TURBO_ENTRY_STREAK) {
        cg.happytime();
        sfx.flowEnter();
        this.spawnTurboBadge();
        this.spawnFlowEntryFx();
      } else {
        sfx.flowPulse(this.turboStreak);
      }
    }
  }

  private spawnRoundFeedbackFx(correct: boolean, timedOut: boolean): void {
    const color = correct ? 0x4de79d : timedOut ? 0x7b7f94 : 0xff6b7c;
    const centerX = CARD_HOME_X;
    const centerY = CARD_HOME_Y;
    const ring = this.add.circle(centerX, centerY, 62, color, 0)
      .setStrokeStyle(correct ? 6 : 4, color, 0.82)
      .setDepth(18);
    this.playGroup.add(ring);
    this.tweens.add({
      targets: ring,
      scale: correct ? 2.1 : 1.55,
      alpha: 0,
      duration: correct ? 280 : 220,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    if (correct) {
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const mote = this.add.circle(centerX, centerY, 4, i % 2 ? 0xffd45c : 0x7ae7ff, 0.9).setDepth(18);
        this.playGroup.add(mote);
        this.tweens.add({
          targets: mote,
          x: centerX + Math.cos(angle) * 92,
          y: centerY + Math.sin(angle) * 68,
          alpha: 0,
          scale: 0.3,
          duration: 300,
          onComplete: () => mote.destroy(),
        });
      }
    } else {
      this.cameras.main.flash(80, 190, 42, 62);
    }
  }

  private spawnFlowEntryFx(): void {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const wash = this.add.rectangle(width / 2, height / 2, width, height, 0xff7a3d, 0.12)
      .setScrollFactor(0)
      .setDepth(17);
    this.playGroup.add(wash);
    const label = this.add.text(CX, 238, "FLOW MODE!", {
      fontSize: "42px",
      fontStyle: "900",
      color: "#fff3b0",
      stroke: "#c53f29",
      strokeThickness: 8,
      letterSpacing: 4,
    }).setOrigin(0.5).setDepth(19).setScale(0.7);
    this.playGroup.add(label);
    this.tweens.add({
      targets: label,
      scale: 1.16,
      yoyo: true,
      duration: 180,
      hold: 260,
      onComplete: () => label.destroy(),
    });
    this.tweens.add({
      targets: wash,
      alpha: 0,
      duration: 520,
      onComplete: () => wash.destroy(),
    });
  }

  /**
   * ターボモード突入時の演出バッジ。ゲーム盤より後に生成するので最前面に描画される。
   * 画像が無ければ何もしない（従来の turboText の演出はそのまま残る）。入力は受け取らない
   */
  private spawnTurboBadge(): void {
    if (!this.textures.exists(TURBO_BADGE_KEY)) return;
    const badge = this.add
      .image(CX + 158, 270, TURBO_BADGE_KEY)
      .setDisplaySize(64, 64)
      .setScale(0.2 * (64 / 256))
      .setDepth(20);
    this.playGroup.add(badge);
    this.tweens.add({
      targets: badge,
      scale: 64 / 256,
      duration: 250,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: badge,
          alpha: 0,
          y: badge.y - 20,
          delay: 700,
          duration: 300,
          ease: "Cubic.easeIn",
          onComplete: () => badge.destroy(),
        });
      },
    });
  }

  private spawnPointsPopup(label: string): void {
    const popup = this.add
      .text(CARD_HOME_X, CARD_HOME_Y - CARD_H / 2 - 8, label, {
        ...TYPE.h2,
        color: hexToCss(TURBO_COLOR),
      })
      .setOrigin(0.5);
    this.playGroup.add(popup);
    this.tweens.add({
      targets: popup,
      y: popup.y - 30,
      alpha: 0,
      duration: 500,
      ease: "Cubic.easeOut",
      onComplete: () => popup.destroy(),
    });
  }

  private endSession(): void {
    if (this.phase !== "playing") return;
    this.accepting = false;
    this.pendingRound?.remove(false);
    this.phase = "result";
    this.playGroup.setVisible(false);

    const summary = summarizeSession(this.results);
    const performance = recordPerformance(this.results);
    if (this.sessionMode === "challenge") {
      saveBestScore(summary.score);
      saveBestTurbo(this.turboPoints);
    }
    const best = loadBestScore();
    const bestTurbo = loadBestTurbo();

    const heading = this.resultGroup.getByName(
      "heading",
    ) as Phaser.GameObjects.Text;
    const stats = this.resultGroup.getByName(
      "stats",
    ) as Phaser.GameObjects.Text;
    const bestLine = this.resultGroup.getByName(
      "bestLine",
    ) as Phaser.GameObjects.Text;

    const accuracyPct = Math.round(summary.accuracy * 100);
    const grade = accuracyPct >= 95 && summary.avgReactionMs <= 900
      ? "S"
      : accuracyPct >= 85
        ? "A"
        : accuracyPct >= 70
          ? "B"
          : "C";
    heading.setText(
      this.sessionMode === "practice"
        ? `${t(this.lang, "practice")} ${this.practiceJudgeMode === "content" ? t(this.lang, "practiceShortContent") : t(this.lang, "practiceShortColor")} · ${grade} · ${summary.score}`
        : `${grade} · ${t(this.lang, "score")} ${summary.score}`,
    );
    heading.setColor(grade === "S" ? "#ffd75e" : grade === "A" ? "#7ee9ff" : "#ffffff");
    heading.setScale(0.78);
    this.tweens.add({ targets: heading, scale: 1, duration: 260, ease: "Back.easeOut" });
    if (grade === "S" || grade === "A") this.cameras.main.flash(120, 255, 222, 110);
    stats.setText(
      `${t(this.lang, "accuracy")}: ${Math.round(summary.accuracy * 100)}%\n${t(this.lang, "avgReaction")}: ${Math.round(summary.avgReactionMs)}ms\n${t(this.lang, "turboBonus")}: ${this.turboPoints}pt`,
    );
    const metricText = (key: "content" | "color" | "switch", label: string) => {
      const metric = performance[key];
      const accuracy = metric.total ? Math.round(metricAccuracy(metric) * 100) : 0;
      const reaction = metric.reactionSamples ? Math.round(metricAvgReaction(metric)) : 0;
      const bars = Math.round(accuracy / 10);
      return `${label} ${"■".repeat(bars)}${"·".repeat(10 - bars)} ${accuracy}%${reaction ? ` · ${reaction}ms` : ""}`;
    };
    bestLine
      .setPosition(CX, 438)
      .setText(
        `${metricText("content", t(this.lang, "metricContent"))}\n${metricText("color", t(this.lang, "metricColor"))}\n${metricText("switch", t(this.lang, "metricSwitch"))}\n${t(this.lang, "best60")} ${best} · ${t(this.lang, "turbo")} ${bestTurbo}pt`,
      );

    this.resultGroup.setVisible(true);
  }
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/** 英語表記など長い文字列でもカードからはみ出さないよう文字数に応じて縮小する */
function promptFontSizeFor(text: string): number {
  if (text.length <= 4) return 40;
  if (text.length === 5) return 34;
  return 28;
}

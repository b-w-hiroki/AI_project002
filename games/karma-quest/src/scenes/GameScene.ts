import Phaser from "phaser";
import { BattleResult, autoBattle } from "../logic/battle";
import { Encounter, applyEncounterChoice, rollEncounter, rollEncounterOccurs } from "../logic/encounter";
import {
  FACTION_LABEL,
  KarmaRequest,
  KarmaState,
  applyKarmaChoice,
  deriveStats,
  dominantFaction,
  initialKarma,
  rollRequest,
} from "../logic/karma";
import { addTotalEvaluation, loadBestStage, loadTotalEvaluation, saveBestStage } from "../logic/progress";
import { Highlight, evaluateReport, rollHighlights } from "../logic/report";
import { sfx } from "../platform/audio";
import { cg } from "../platform/crazygames";
import { drawPanel, drawSpeakerIcon, makeButton, THEME, TYPE } from "../ui/theme";

const SOUND_PREF_KEY = "karma_quest_sound_v1";
const TOTAL_STAGES = 12;
const BATTLE_CHEER_WINDOW_MS = 1800;
/** スマホでの片手持ちを想定した縦持ちレイアウト。中央X座標 */
const CX = 225;

type Phase = "title" | "karma" | "encounter" | "battle" | "report" | "final";

interface HighlightRow {
  highlight: Highlight;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  selected: boolean;
}

export class GameScene extends Phaser.Scene {
  private phase: Phase = "title";
  private stage = 0;
  private karma: KarmaState = initialKarma();
  private runEvaluation = 0;
  private currentRequest: KarmaRequest | null = null;
  private currentEncounter: Encounter | null = null;
  private encounterBonus = 0;
  private currentBattleResult: BattleResult | null = null;
  private cheerCount = 0;
  private highlightRows: HighlightRow[] = [];

  private soundOn = typeof localStorage !== "undefined" ? localStorage.getItem(SOUND_PREF_KEY) !== "off" : true;
  private soundIcon!: Phaser.GameObjects.Graphics;

  private titleGroup!: Phaser.GameObjects.Container;
  private karmaGroup!: Phaser.GameObjects.Container;
  private encounterGroup!: Phaser.GameObjects.Container;
  private battleGroup!: Phaser.GameObjects.Container;
  private reportGroup!: Phaser.GameObjects.Container;
  private finalGroup!: Phaser.GameObjects.Container;

  constructor() {
    super("GameScene");
  }

  create(): void {
    cg.gameplayStart();
    this.cameras.main.setBackgroundColor(0x14201c);
    this.buildTitleScreen();
    this.buildKarmaScreen();
    this.buildEncounterScreen();
    this.buildBattleScreen();
    this.buildReportScreen();
    this.buildFinalScreen();
    this.showTitle();
  }

  // ---------- タイトル ----------

  private buildTitleScreen(): void {
    this.titleGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 380, 400, 600, { depth: 0 });

    const title = this.add
      .text(CX, 110, "カルマクエスト", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const rules = this.add
      .text(
        CX,
        280,
        "勇者を育て、討伐に送り出し、\n神様に戦果を報告する。\n\n派閥の要望に応えると\nカルマが傾き、勇者の力が変化する。\n\n報告は良い場面だけを選ぶのがコツ、\n悪い場面まで報告すると評価が下がる。\n\n12回の討伐（3年分）を乗り越えて、\n最強の勇者伝説を作ろう！",
        { ...TYPE.body, color: THEME.textMuted, align: "center" },
      )
      .setOrigin(0.5);

    const best = this.add
      .text(CX, 480, "", { ...TYPE.small, color: THEME.textMuted, align: "center" })
      .setOrigin(0.5);

    const startBtn = makeButton(this, CX, 560, 260, 52, "旅を始める", () => { this.playSound(sfx.buttonTap); this.startRun(); }, {
      fontSize: "16px",
    });

    this.soundIcon = drawSpeakerIcon(this, 395, 100, this.soundOn, 18);
    const soundHit = this.add
      .rectangle(395, 100, 40, 40, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.soundOn = !this.soundOn;
        localStorage.setItem(SOUND_PREF_KEY, this.soundOn ? "on" : "off");
        this.soundIcon.destroy();
        this.soundIcon = drawSpeakerIcon(this, 395, 100, this.soundOn, 18);
        this.titleGroup.add(this.soundIcon);
        this.playSound(sfx.buttonTap);
      });

    this.titleGroup.add([panel, title, rules, best, startBtn.container, this.soundIcon, soundHit]);
    this.titleGroup.setData("bestText", best);
  }

  private playSound(fn: () => void): void {
    if (this.soundOn) fn();
  }

  private showTitle(): void {
    this.phase = "title";
    this.titleGroup.setVisible(true);
    this.karmaGroup.setVisible(false);
    this.encounterGroup.setVisible(false);
    this.battleGroup.setVisible(false);
    this.reportGroup.setVisible(false);
    this.finalGroup.setVisible(false);
    const bestText = this.titleGroup.getData("bestText") as Phaser.GameObjects.Text;
    bestText.setText(`最高到達: ${loadBestStage()}回目\n累計評価: ${loadTotalEvaluation()}`);
  }

  private startRun(): void {
    this.stage = 0;
    this.karma = initialKarma();
    this.runEvaluation = 0;
    this.titleGroup.setVisible(false);
    this.finalGroup.setVisible(false);
    this.nextStage();
  }

  private nextStage(): void {
    this.stage += 1;
    if (this.stage > TOTAL_STAGES) {
      this.showFinal();
      return;
    }
    this.showKarmaPhase();
  }

  // ---------- 育成（カルマ） ----------

  private buildKarmaScreen(): void {
    this.karmaGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 480, { depth: 0 });

    const progress = this.add
      .text(CX, 210, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("progress");
    const factionLabel = this.add
      .text(CX, 260, "", { ...TYPE.h2, color: hexToCss(THEME.accent) })
      .setOrigin(0.5)
      .setName("factionLabel");
    const requestText = this.add
      .text(CX, 340, "", {
        ...TYPE.body,
        color: THEME.textPrimary,
        align: "center",
        wordWrap: { width: 340, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setName("requestText");

    const acceptBtn = makeButton(this, CX, 500, 320, 52, "力を貸す", () => this.onKarmaChoice(true), {
      fontSize: "16px",
    });
    const declineBtn = makeButton(this, CX, 570, 320, 48, "断る", () => this.onKarmaChoice(false), {
      fontSize: "15px",
    });

    this.karmaGroup.add([panel, progress, factionLabel, requestText, acceptBtn.container, declineBtn.container]);
    this.karmaGroup.setVisible(false);
  }

  private showKarmaPhase(): void {
    this.phase = "karma";
    this.encounterGroup.setVisible(false);
    this.battleGroup.setVisible(false);
    this.reportGroup.setVisible(false);
    this.karmaGroup.setVisible(true);

    this.currentRequest = rollRequest();
    const progress = this.karmaGroup.getByName("progress") as Phaser.GameObjects.Text;
    const factionLabel = this.karmaGroup.getByName("factionLabel") as Phaser.GameObjects.Text;
    const requestText = this.karmaGroup.getByName("requestText") as Phaser.GameObjects.Text;

    progress.setText(`${this.stage} / ${TOTAL_STAGES} 年目`);
    factionLabel.setText(`【${FACTION_LABEL[this.currentRequest.faction]}】`);
    requestText.setText(this.currentRequest.text);
  }

  private onKarmaChoice(accepted: boolean): void {
    if (this.phase !== "karma" || !this.currentRequest) return;
    this.playSound(accepted ? sfx.karmaUp : sfx.karmaDown);
    this.karma = applyKarmaChoice(this.karma, this.currentRequest, accepted);

    this.encounterBonus = 0;
    if (rollEncounterOccurs()) {
      this.showEncounterPhase();
    } else {
      this.showBattlePhase();
    }
  }

  // ---------- 遭遇イベント ----------

  private buildEncounterScreen(): void {
    this.encounterGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 420, { depth: 0 });

    const heading = this.add
      .text(CX, 260, "道中の出来事", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const encounterText = this.add
      .text(CX, 320, "", {
        ...TYPE.body,
        color: THEME.textPrimary,
        align: "center",
        wordWrap: { width: 340, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setName("encounterText");

    const choiceABtn = makeButton(this, CX, 460, 320, 52, "", () => this.onEncounterChoice("A"), {
      fontSize: "16px",
    });
    const choiceBBtn = makeButton(this, CX, 530, 320, 48, "", () => this.onEncounterChoice("B"), {
      fontSize: "15px",
    });

    this.encounterGroup.add([panel, heading, encounterText, choiceABtn.container, choiceBBtn.container]);
    this.encounterGroup.setData("choiceABtn", choiceABtn);
    this.encounterGroup.setData("choiceBBtn", choiceBBtn);
    this.encounterGroup.setVisible(false);
  }

  private showEncounterPhase(): void {
    this.phase = "encounter";
    this.karmaGroup.setVisible(false);
    this.encounterGroup.setVisible(true);

    this.currentEncounter = rollEncounter();
    const encounterText = this.encounterGroup.getByName("encounterText") as Phaser.GameObjects.Text;
    encounterText.setText(this.currentEncounter.text);

    const choiceABtn = this.encounterGroup.getData("choiceABtn") as ReturnType<typeof makeButton>;
    const choiceBBtn = this.encounterGroup.getData("choiceBBtn") as ReturnType<typeof makeButton>;
    choiceABtn.setLabel(this.currentEncounter.choiceA.label);
    choiceBBtn.setLabel(this.currentEncounter.choiceB.label);
  }

  private onEncounterChoice(slot: "A" | "B"): void {
    if (this.phase !== "encounter" || !this.currentEncounter) return;
    const choice = slot === "A" ? this.currentEncounter.choiceA : this.currentEncounter.choiceB;
    this.playSound(sfx.buttonTap);
    this.karma = applyEncounterChoice(this.karma, choice);
    this.encounterBonus = choice.powerBonus;
    this.showBattlePhase();
  }

  // ---------- 討伐（オートバトル） ----------

  private buildBattleScreen(): void {
    this.battleGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 400, { depth: 0 });

    const heading = this.add
      .text(CX, 300, "討伐へ出発！", { ...TYPE.h1, color: THEME.textPrimary, align: "center" })
      .setOrigin(0.5)
      .setName("battleHeading");
    const statsText = this.add
      .text(CX, 400, "", { ...TYPE.body, color: THEME.textMuted, align: "center" })
      .setOrigin(0.5)
      .setName("battleStats");
    const resultText = this.add
      .text(CX, 470, "", { ...TYPE.h2, color: hexToCss(THEME.accent) })
      .setOrigin(0.5)
      .setName("battleResult");

    const cheerCountText = this.add
      .text(CX, 520, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("cheerCountText");
    const cheerBtn = makeButton(this, CX, 560, 220, 48, "おうえん！", () => this.onCheerTap(), {
      fontSize: "16px",
    });

    this.battleGroup.add([panel, heading, statsText, resultText, cheerCountText, cheerBtn.container]);
    this.battleGroup.setData("cheerBtn", cheerBtn);
    this.battleGroup.setVisible(false);
  }

  private showBattlePhase(): void {
    this.phase = "battle";
    this.karmaGroup.setVisible(false);
    this.encounterGroup.setVisible(false);
    this.battleGroup.setVisible(true);

    const stats = deriveStats(this.karma);
    const heading = this.battleGroup.getByName("battleHeading") as Phaser.GameObjects.Text;
    const statsText = this.battleGroup.getByName("battleStats") as Phaser.GameObjects.Text;
    const resultText = this.battleGroup.getByName("battleResult") as Phaser.GameObjects.Text;

    heading.setText("討伐中…");
    statsText.setText(`ATK ${stats.atk}  DEF ${stats.def}\nHP ${stats.hp}  MAGIC ${stats.magic}`);
    resultText.setText("");

    const cheerCountText = this.battleGroup.getByName("cheerCountText") as Phaser.GameObjects.Text;
    const cheerBtn = this.battleGroup.getData("cheerBtn") as ReturnType<typeof makeButton>;
    this.cheerCount = 0;
    cheerCountText.setText("タップして応援しよう！（0回）");
    cheerBtn.setEnabled(true);

    this.time.delayedCall(BATTLE_CHEER_WINDOW_MS, () => {
      cheerBtn.setEnabled(false);
      const result = autoBattle(stats, this.stage, Math.random, this.cheerCount, this.encounterBonus);
      this.currentBattleResult = result;
      this.playSound(result.win ? sfx.battleWin : sfx.battleLose);
      if (result.win) cg.happytime();
      heading.setText(result.win ? "魔物を討伐した！" : "退却を余儀なくされた…");
      resultText.setText(`残りHP割合: ${Math.round(result.hpRatioRemaining * 100)}%`);
      cheerCountText.setText(this.cheerCount > 0 ? `おうえん ${this.cheerCount}回！` : "");
      this.time.delayedCall(700, () => this.showReportPhase(result));
    });
  }

  private onCheerTap(): void {
    if (this.phase !== "battle") return;
    this.cheerCount += 1;
    this.playSound(sfx.buttonTap);
    const cheerCountText = this.battleGroup.getByName("cheerCountText") as Phaser.GameObjects.Text;
    cheerCountText.setText(`タップして応援しよう！（${this.cheerCount}回）`);
  }

  // ---------- 報告 ----------

  private buildReportScreen(): void {
    this.reportGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 700, { depth: 0 });

    const heading = this.add
      .text(CX, 110, "神様への報告", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const hint = this.add
      .text(CX, 155, "良い場面だけを選んで報告しよう\n（悪い場面は評価を下げる）", {
        ...TYPE.small,
        color: THEME.textMuted,
        align: "center",
      })
      .setOrigin(0.5);

    const submitBtn = makeButton(this, CX, 680, 260, 52, "報告する", () => this.onSubmitReport(), {
      fontSize: "16px",
    });

    this.reportGroup.add([panel, heading, hint, submitBtn.container]);
    this.reportGroup.setVisible(false);
  }

  private showReportPhase(result: BattleResult): void {
    this.phase = "report";
    this.battleGroup.setVisible(false);
    this.reportGroup.setVisible(true);
    this.clearHighlightRows();

    const highlights = rollHighlights(result);
    const rowH = 56;
    const startY = 250;
    highlights.forEach((highlight, i) => {
      const y = startY + i * (rowH + 12);
      const bg = this.add.graphics();
      const label = this.add
        .text(0, 0, highlight.label, {
          ...TYPE.body,
          color: THEME.textPrimary,
          align: "center",
          wordWrap: { width: 320, useAdvancedWrap: true },
        })
        .setOrigin(0.5);
      const container = this.add.container(CX, y, [bg, label]).setSize(360, rowH);
      container.setInteractive({ useHandCursor: true });

      const row: HighlightRow = { highlight, container, bg, selected: false };
      this.drawHighlightRow(row);
      container.on("pointerdown", () => {
        row.selected = !row.selected;
        this.playSound(sfx.buttonTap);
        this.drawHighlightRow(row);
      });

      this.reportGroup.add(container);
      this.highlightRows.push(row);
    });
  }

  private drawHighlightRow(row: HighlightRow): void {
    const w = 360;
    const h = 56;
    row.bg.clear();
    row.bg.fillStyle(row.selected ? THEME.accent : THEME.panelFill, row.selected ? 0.3 : 0.6);
    row.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    row.bg.lineStyle(row.selected ? 2.5 : 1.5, row.selected ? THEME.accent : THEME.panelBorder, row.selected ? 1 : 0.5);
    row.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  }

  private clearHighlightRows(): void {
    for (const row of this.highlightRows) row.container.destroy();
    this.highlightRows = [];
  }

  private onSubmitReport(): void {
    if (this.phase !== "report") return;
    this.playSound(sfx.reportSubmit);
    const selected = this.highlightRows.filter((r) => r.selected).map((r) => r.highlight);
    const evaluation = evaluateReport(selected);
    this.runEvaluation += evaluation;
    addTotalEvaluation(evaluation);
    this.spawnFloatingText(CX, 630, `評価 +${evaluation}`, hexToCss(THEME.accent));
    this.time.delayedCall(500, () => this.nextStage());
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    const obj = this.add
      .text(x, y, text, { fontSize: "20px", color, fontStyle: "800", stroke: "#14201c", strokeThickness: 4 })
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

  // ---------- 最終結果 ----------

  private buildFinalScreen(): void {
    this.finalGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 380, 460, { depth: 0 });

    const heading = this.add
      .text(CX, 260, "", { ...TYPE.h1, color: THEME.textPrimary, align: "center" })
      .setOrigin(0.5)
      .setName("finalHeading");
    const stats = this.add
      .text(CX, 350, "", { ...TYPE.body, color: THEME.textMuted, align: "center" })
      .setOrigin(0.5)
      .setName("finalStats");

    const retryBtn = makeButton(this, CX, 470, 300, 52, "もう一度旅に出る", () => this.startRun(), {
      fontSize: "15px",
    });
    const titleBtn = makeButton(this, CX, 540, 300, 46, "タイトルへ戻る", () => this.showTitle(), {
      fontSize: "14px",
    });

    this.finalGroup.add([panel, heading, stats, retryBtn.container, titleBtn.container]);
    this.finalGroup.setVisible(false);
  }

  private showFinal(): void {
    this.phase = "final";
    this.karmaGroup.setVisible(false);
    this.battleGroup.setVisible(false);
    this.reportGroup.setVisible(false);

    saveBestStage(TOTAL_STAGES);
    const faction = dominantFaction(this.karma);

    const heading = this.finalGroup.getByName("finalHeading") as Phaser.GameObjects.Text;
    const stats = this.finalGroup.getByName("finalStats") as Phaser.GameObjects.Text;
    heading.setText("3年間の旅、完結");
    stats.setText(
      `累計評価: ${this.runEvaluation}\n最も応えた派閥: ${FACTION_LABEL[faction]}\n通算評価: ${loadTotalEvaluation()}`,
    );

    this.finalGroup.setVisible(true);
  }
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

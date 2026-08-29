import Phaser from "phaser";
import { EquipRarity, breedEquipment, breedRateTable, BREED_COST } from "../logic/breeding";
import { General, GACHA_COST, canAffordGacha, drawGeneral } from "../logic/general";
import {
  addCurrency,
  loadBestDistance,
  loadCurrency,
  saveBestDistance,
  spendCurrency,
} from "../logic/progress";
import { QuestEvent, resolveQuestTap } from "../logic/quest";
import { sfx } from "../platform/audio";
import { drawPanel, drawSpeakerIcon, makeButton, THEME, TYPE } from "../ui/theme";

/** スマホでの片手持ちを想定した縦持ちレイアウト。中央X座標 */
const CX = 225;
const SOUND_PREF_KEY = "sangoku_tap_sound_v1";

const RARITY_COLOR: Readonly<Record<string, number>> = {
  SSR: 0xffc94a,
  SR: 0xc9a4ff,
  R: 0x7fc4ff,
  N: 0xb8a888,
  Epic: 0xc9a4ff,
  Rare: 0x7fc4ff,
  Common: 0xb8a888,
};

const RARITIES: readonly EquipRarity[] = ["Common", "Rare", "Epic"] as const;

type Phase = "title" | "quest" | "gacha" | "breeding";

export class GameScene extends Phaser.Scene {
  private phase: Phase = "title";
  private distance = 0;

  private titleGroup!: Phaser.GameObjects.Container;
  private questGroup!: Phaser.GameObjects.Container;
  private gachaGroup!: Phaser.GameObjects.Container;
  private breedingGroup!: Phaser.GameObjects.Container;

  private breedA: EquipRarity = "Common";
  private breedB: EquipRarity = "Common";
  private breedButtonsA: Partial<Record<EquipRarity, ReturnType<typeof makeButton>>> = {};
  private breedButtonsB: Partial<Record<EquipRarity, ReturnType<typeof makeButton>>> = {};

  private soundOn = typeof localStorage !== "undefined" ? localStorage.getItem(SOUND_PREF_KEY) !== "off" : true;
  private soundIcon!: Phaser.GameObjects.Graphics;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x2a1a14);
    this.buildTitleScreen();
    this.buildQuestScreen();
    this.buildGachaScreen();
    this.buildBreedingScreen();
    this.showTitle();
  }

  // ---------- タイトル ----------

  private buildTitleScreen(): void {
    this.titleGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 700, { depth: 0 });

    const title = this.add
      .text(CX, 110, "三国ポチポチ", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const rules = this.add
      .text(
        CX,
        250,
        "タップして部隊を進撃させよう。\n宝箱・出会い・小競り合いが\nランダムに発生する。\n\n貯めたコインで武将ガチャや\n装備合成（ブリーディング）も楽しめる。",
        { ...TYPE.body, color: THEME.textMuted, align: "center" },
      )
      .setOrigin(0.5);

    const best = this.add
      .text(CX, 400, "", { ...TYPE.small, color: THEME.textMuted, align: "center" })
      .setOrigin(0.5);

    const questBtn = makeButton(this, CX, 470, 280, 52, "進撃へ出発", () => { this.playSound(sfx.tap); this.showQuest(); }, {
      fontSize: "16px",
    });
    const gachaBtn = makeButton(this, CX, 540, 280, 48, "武将ガチャ", () => { this.playSound(sfx.tap); this.showGacha(); }, {
      fontSize: "15px",
    });
    const breedBtn = makeButton(this, CX, 600, 280, 48, "装備合成", () => { this.playSound(sfx.tap); this.showBreeding(); }, {
      fontSize: "15px",
    });

    this.soundIcon = drawSpeakerIcon(this, 390, 65, this.soundOn, 18);
    const soundHit = this.add
      .rectangle(390, 65, 40, 40, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.soundOn = !this.soundOn;
        localStorage.setItem(SOUND_PREF_KEY, this.soundOn ? "on" : "off");
        this.soundIcon.destroy();
        this.soundIcon = drawSpeakerIcon(this, 390, 65, this.soundOn, 18);
        this.titleGroup.add(this.soundIcon);
        this.playSound(sfx.tap);
      });

    this.titleGroup.add([
      panel,
      title,
      rules,
      best,
      questBtn.container,
      gachaBtn.container,
      breedBtn.container,
      this.soundIcon,
      soundHit,
    ]);
    this.titleGroup.setData("bestText", best);
  }

  private playSound(fn: () => void): void {
    if (this.soundOn) fn();
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    const obj = this.add
      .text(x, y, text, { fontSize: "20px", color, fontStyle: "800", stroke: "#2a1a14", strokeThickness: 4 })
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

  private showTitle(): void {
    this.phase = "title";
    this.titleGroup.setVisible(true);
    this.questGroup.setVisible(false);
    this.gachaGroup.setVisible(false);
    this.breedingGroup.setVisible(false);
    const bestText = this.titleGroup.getData("bestText") as Phaser.GameObjects.Text;
    bestText.setText(`所持コイン: ${loadCurrency()}\n最高進撃距離: ${loadBestDistance()}`);
  }

  // ---------- クエスト（タップ進撃） ----------

  private buildQuestScreen(): void {
    this.questGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 700, { depth: 0 });

    const currencyText = this.add
      .text(CX, 90, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("currencyText");
    const distanceText = this.add
      .text(CX, 130, "", { ...TYPE.h2, color: THEME.textPrimary })
      .setOrigin(0.5)
      .setName("distanceText");

    const eventText = this.add
      .text(CX, 260, "タップして進撃しよう！", {
        ...TYPE.body,
        color: THEME.textPrimary,
        align: "center",
        wordWrap: { width: 340, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setName("eventText");
    const rewardText = this.add
      .text(CX, 310, "", { ...TYPE.h2, color: hexToCss(THEME.accent) })
      .setOrigin(0.5)
      .setName("rewardText");

    const tapBtn = makeButton(this, CX, 470, 220, 220, "進撃\nTAP!", () => this.onTapAdvance(), {
      fontSize: "22px",
      radius: 110,
    });

    const backBtn = makeButton(this, CX, 660, 260, 48, "タイトルへ戻る", () => this.showTitle(), {
      fontSize: "14px",
    });

    this.questGroup.add([panel, currencyText, distanceText, eventText, rewardText, tapBtn.container, backBtn.container]);
    this.questGroup.setVisible(false);
  }

  private showQuest(): void {
    this.phase = "quest";
    this.titleGroup.setVisible(false);
    this.questGroup.setVisible(true);
    this.distance = 0;
    this.refreshQuestVisual();

    const eventText = this.questGroup.getByName("eventText") as Phaser.GameObjects.Text;
    const rewardText = this.questGroup.getByName("rewardText") as Phaser.GameObjects.Text;
    eventText.setText("タップして進撃しよう！");
    rewardText.setText("");
  }

  private onTapAdvance(): void {
    if (this.phase !== "quest") return;
    this.distance += 1;
    const troopLevel = 1 + Math.floor(this.distance / 25);
    const event: QuestEvent = resolveQuestTap(this.distance, troopLevel);
    if (event.reward > 0) addCurrency(event.reward);
    saveBestDistance(this.distance);

    if (event.reward > 0) this.spawnFloatingText(CX, 370, `+${event.reward}`, hexToCss(THEME.accent));

    if (event.type === "encounter") this.playSound(sfx.encounter);
    else if (event.type === "treasure") this.playSound(sfx.treasure);
    else this.playSound(event.won ? sfx.battleWin : sfx.battleLose);

    const eventText = this.questGroup.getByName("eventText") as Phaser.GameObjects.Text;
    const rewardText = this.questGroup.getByName("rewardText") as Phaser.GameObjects.Text;
    eventText.setText(event.message);
    rewardText.setText(event.reward > 0 ? `+${event.reward} コイン` : event.won === false ? "報酬なし…" : "");
    rewardText.setColor(event.won === false ? THEME.textMuted : hexToCss(THEME.accent));

    this.refreshQuestVisual();
  }

  private refreshQuestVisual(): void {
    const currencyText = this.questGroup.getByName("currencyText") as Phaser.GameObjects.Text;
    const distanceText = this.questGroup.getByName("distanceText") as Phaser.GameObjects.Text;
    currencyText.setText(`所持コイン: ${loadCurrency()}`);
    distanceText.setText(`進撃距離 ${this.distance}`);
  }

  // ---------- 武将ガチャ ----------

  private buildGachaScreen(): void {
    this.gachaGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 500, { depth: 0 });

    const heading = this.add
      .text(CX, 260, "武将ガチャ", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const costText = this.add
      .text(CX, 310, `1回 ${GACHA_COST} コイン`, { ...TYPE.body, color: THEME.textMuted })
      .setOrigin(0.5);
    const resultText = this.add
      .text(CX, 400, "", { ...TYPE.h2, color: THEME.textPrimary })
      .setOrigin(0.5)
      .setName("gachaResult");
    const balanceText = this.add
      .text(CX, 450, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("gachaBalance");

    const drawBtn = makeButton(this, CX, 540, 260, 52, "引く", () => this.rollGacha(), { fontSize: "16px" });
    const backBtn = makeButton(this, CX, 610, 260, 48, "タイトルへ戻る", () => this.showTitle(), {
      fontSize: "14px",
    });

    this.gachaGroup.add([panel, heading, costText, resultText, balanceText, drawBtn.container, backBtn.container]);
    this.gachaGroup.setVisible(false);
  }

  private showGacha(): void {
    this.phase = "gacha";
    this.titleGroup.setVisible(false);
    this.gachaGroup.setVisible(true);
    const resultText = this.gachaGroup.getByName("gachaResult") as Phaser.GameObjects.Text;
    resultText.setText("");
    this.refreshGachaBalance();
  }

  private refreshGachaBalance(): void {
    const balanceText = this.gachaGroup.getByName("gachaBalance") as Phaser.GameObjects.Text;
    balanceText.setText(`所持コイン: ${loadCurrency()}`);
  }

  private rollGacha(): void {
    const balance = loadCurrency();
    const resultText = this.gachaGroup.getByName("gachaResult") as Phaser.GameObjects.Text;
    if (!canAffordGacha(balance)) {
      resultText.setText("コインが足りません…").setColor(THEME.textMuted);
      return;
    }
    spendCurrency(GACHA_COST);
    const general: General = drawGeneral();
    const isRare = general.rarity === "SSR" || general.rarity === "SR";
    this.playSound(isRare ? sfx.gachaRare : sfx.gachaDraw);
    resultText
      .setText(`【${general.rarity}】${general.name}\nATK ${general.atk}`)
      .setColor(hexToCss(RARITY_COLOR[general.rarity] ?? 0xffffff));
    this.tweens.add({ targets: resultText, scale: isRare ? 1.4 : 1.2, duration: isRare ? 180 : 120, yoyo: true });
    if (isRare) this.cameras.main.flash(200, 255, 220, 140);
    this.refreshGachaBalance();
  }

  // ---------- 装備合成（ブリーディング） ----------

  private buildBreedingScreen(): void {
    this.breedingGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 660, { depth: 0 });

    const heading = this.add
      .text(CX, 110, "装備合成", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const hint = this.add
      .text(CX, 145, `2つの親装備のレアリティを選んで合成（${BREED_COST}コイン）`, {
        ...TYPE.small,
        color: THEME.textMuted,
        align: "center",
        wordWrap: { width: 340, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    const labelA = this.add.text(CX, 200, "親装備A", { ...TYPE.small, color: THEME.textMuted }).setOrigin(0.5);
    this.buildRaritySelector(230, "A");
    const labelB = this.add.text(CX, 300, "親装備B", { ...TYPE.small, color: THEME.textMuted }).setOrigin(0.5);
    this.buildRaritySelector(330, "B");

    const rateText = this.add
      .text(CX, 400, "", { ...TYPE.body, color: THEME.textMuted, align: "center" })
      .setOrigin(0.5)
      .setName("rateText");
    const resultText = this.add
      .text(CX, 460, "", { ...TYPE.h2, color: THEME.textPrimary })
      .setOrigin(0.5)
      .setName("breedResult");
    const balanceText = this.add
      .text(CX, 500, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("breedBalance");

    const breedBtn = makeButton(this, CX, 570, 260, 52, "合成する", () => this.onBreed(), { fontSize: "16px" });
    const backBtn = makeButton(this, CX, 640, 260, 48, "タイトルへ戻る", () => this.showTitle(), {
      fontSize: "14px",
    });

    this.breedingGroup.add([
      panel,
      heading,
      hint,
      labelA,
      labelB,
      rateText,
      resultText,
      balanceText,
      breedBtn.container,
      backBtn.container,
    ]);
    this.breedingGroup.setVisible(false);
  }

  private buildRaritySelector(y: number, slot: "A" | "B"): void {
    const buttonW = 110;
    const buttonH = 40;
    const gap = 10;
    const totalW = RARITIES.length * buttonW + (RARITIES.length - 1) * gap;
    const startX = CX - totalW / 2 + buttonW / 2;

    RARITIES.forEach((rarity, i) => {
      const x = startX + i * (buttonW + gap);
      const btn = makeButton(this, x, y, buttonW, buttonH, rarity, () => this.setBreedRarity(slot, rarity), {
        fontSize: "13px",
      });
      this.breedingGroup.add(btn.container);
      if (slot === "A") this.breedButtonsA[rarity] = btn;
      else this.breedButtonsB[rarity] = btn;
    });

    this.refreshRaritySelector(slot);
  }

  private setBreedRarity(slot: "A" | "B", rarity: EquipRarity): void {
    if (slot === "A") this.breedA = rarity;
    else this.breedB = rarity;
    this.refreshRaritySelector(slot);
    this.refreshBreedRatePreview();
  }

  private refreshRaritySelector(slot: "A" | "B"): void {
    const buttons = slot === "A" ? this.breedButtonsA : this.breedButtonsB;
    const selected = slot === "A" ? this.breedA : this.breedB;
    for (const rarity of RARITIES) {
      const btn = buttons[rarity];
      if (!btn) continue;
      btn.setEnabled(true);
      btn.container.setAlpha(rarity === selected ? 1 : 0.55);
    }
  }

  private refreshBreedRatePreview(): void {
    const rates = breedRateTable(this.breedA, this.breedB);
    const rateText = this.breedingGroup.getByName("rateText") as Phaser.GameObjects.Text;
    rateText.setText(`排出率: Common ${rates.Common}% / Rare ${rates.Rare}% / Epic ${rates.Epic}%`);
  }

  private showBreeding(): void {
    this.phase = "breeding";
    this.titleGroup.setVisible(false);
    this.breedingGroup.setVisible(true);
    const resultText = this.breedingGroup.getByName("breedResult") as Phaser.GameObjects.Text;
    resultText.setText("");
    this.refreshBreedRatePreview();
    this.refreshBreedBalance();
  }

  private refreshBreedBalance(): void {
    const balanceText = this.breedingGroup.getByName("breedBalance") as Phaser.GameObjects.Text;
    balanceText.setText(`所持コイン: ${loadCurrency()}`);
  }

  private onBreed(): void {
    const balance = loadCurrency();
    const resultText = this.breedingGroup.getByName("breedResult") as Phaser.GameObjects.Text;
    if (balance < BREED_COST) {
      resultText.setText("コインが足りません…").setColor(THEME.textMuted);
      return;
    }
    spendCurrency(BREED_COST);
    const rarity = breedEquipment(this.breedA, this.breedB);
    this.playSound(sfx.breed);
    resultText.setText(`【${rarity}】装備を入手！`).setColor(hexToCss(RARITY_COLOR[rarity] ?? 0xffffff));
    this.tweens.add({ targets: resultText, scale: 1.2, duration: 120, yoyo: true });
    this.refreshBreedBalance();
  }
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

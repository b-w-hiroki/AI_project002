import Phaser from "phaser";
import { EquipRarity, breedEquipment, breedRateTable, BREED_COST } from "../logic/breeding";
import { General, GACHA_COST, GENERAL_POOL, canAffordGacha, drawGeneral } from "../logic/general";
import {
  addCurrency,
  addEquipment,
  loadBestDistance,
  loadCurrency,
  loadEquipmentInventory,
  loadEquippedMap,
  loadOwnedGenerals,
  saveBestDistance,
  saveEquippedMap,
  saveOwnedGeneral,
  spendCurrency,
  spendEquipment,
} from "../logic/progress";
import { QuestEvent, resolveQuestTap } from "../logic/quest";
import { sfx } from "../platform/audio";
import { EquippedMap, effectiveAtk, equipToGeneral, isOwned, unequipGeneral } from "../logic/roster";
import { cg } from "../platform/crazygames";
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

/**
 * 立ち絵アセット（docs/art-assets.md 参照）。武将id → テクスチャキー。
 * 立ち絵が無い武将、または画像の読み込みに失敗した場合は Graphics/テキストのフォールバック表示になる。
 */
const GENERAL_ART: Readonly<Record<string, string>> = {
  gen_hakuen: "st-general-hakuen",
  gen_soujin: "st-general-soujin",
};
const BG_KEY = "st-bg-battlefield";
/** 立ち絵の縦横比（384:512） */
const ART_ASPECT = 384 / 512;

type Phase = "title" | "quest" | "gacha" | "breeding" | "roster";

interface RosterRow {
  general: General;
  container: Phaser.GameObjects.Container;
}

export class GameScene extends Phaser.Scene {
  private phase: Phase = "title";
  private distance = 0;

  private titleGroup!: Phaser.GameObjects.Container;
  private questGroup!: Phaser.GameObjects.Container;
  private gachaGroup!: Phaser.GameObjects.Container;
  private breedingGroup!: Phaser.GameObjects.Container;
  private rosterGroup!: Phaser.GameObjects.Container;
  private rosterRows: RosterRow[] = [];

  private breedA: EquipRarity = "Common";
  private breedB: EquipRarity = "Common";
  private breedButtonsA: Partial<Record<EquipRarity, ReturnType<typeof makeButton>>> = {};
  private breedButtonsB: Partial<Record<EquipRarity, ReturnType<typeof makeButton>>> = {};

  private soundOn = typeof localStorage !== "undefined" ? localStorage.getItem(SOUND_PREF_KEY) !== "off" : true;
  private soundIcon!: Phaser.GameObjects.Graphics;
  private bgOverlay?: Phaser.GameObjects.Rectangle;

  constructor() {
    super("GameScene");
  }

  preload(): void {
    // 画像はすべて任意。404 でも Phaser は警告を出すだけでゲームは続行し、各利用箇所で
    // textures.exists() を確認して Graphics 描画にフォールバックする
    this.load.image(BG_KEY, "images/st-bg-battlefield.png");
    for (const key of Object.values(GENERAL_ART)) this.load.image(key, `images/${key}.png`);
  }

  create(): void {
    cg.gameplayStart();
    this.cameras.main.setBackgroundColor(0x2a1a14);
    this.buildBackground();
    this.buildTitleScreen();
    this.buildQuestScreen();
    this.buildGachaScreen();
    this.buildBreedingScreen();
    this.buildRosterScreen();
    this.showTitle();
  }

  // ---------- 背景 ----------

  /**
   * 画面全体の背景。戦場イラストがあれば全画面（450×800）にカバー表示し、その上に
   * 画面ごとに濃さを変える暗幕（bgOverlay）を重ねて文字の可読性を確保する。
   * イラストが無い場合はカメラ背景色（既存挙動）のままにする。
   */
  private buildBackground(): void {
    if (!this.textures.exists(BG_KEY)) return;
    const src = this.textures.get(BG_KEY).getSourceImage();
    const scale = Math.max(450 / src.width, 800 / src.height);
    this.add.image(CX, 400, BG_KEY).setDisplaySize(src.width * scale, src.height * scale);
    this.bgOverlay = this.add.rectangle(CX, 400, 450, 800, 0x1a0e0a, 0.55);
  }

  /** 画面ごとの暗幕の濃さ。進撃画面はイラストを見せ、それ以外は文字を優先して暗めにする */
  private setBackgroundDim(alpha: number): void {
    this.bgOverlay?.setFillStyle(0x1a0e0a, alpha);
  }

  // ---------- タイトル ----------

  private buildTitleScreen(): void {
    this.titleGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 700, { depth: 0, fillAlpha: this.textures.exists(BG_KEY) ? 0.72 : 0.95 });

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
    const rosterBtn = makeButton(this, CX, 660, 280, 48, "武将一覧・装備", () => { this.playSound(sfx.tap); this.showRoster(); }, {
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
      rosterBtn.container,
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
    this.setBackgroundDim(0.55);
    this.titleGroup.setVisible(true);
    this.questGroup.setVisible(false);
    this.gachaGroup.setVisible(false);
    this.breedingGroup.setVisible(false);
    this.rosterGroup.setVisible(false);
    const bestText = this.titleGroup.getData("bestText") as Phaser.GameObjects.Text;
    bestText.setText(`所持コイン: ${loadCurrency()}\n最高進撃距離: ${loadBestDistance()}`);
  }

  // ---------- クエスト（タップ進撃） ----------

  private buildQuestScreen(): void {
    this.questGroup = this.add.container(0, 0);
    // 進撃画面は背景イラストを主役にするため、パネルは薄くしてイラストを透かす
    const panel = drawPanel(this, CX, 400, 400, 700, { depth: 0, fillAlpha: this.textures.exists(BG_KEY) ? 0.35 : 0.95 });

    const currencyText = this.add
      .text(CX, 90, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("currencyText");
    const distanceText = this.add
      .text(CX, 130, "", { ...TYPE.h2, color: THEME.textPrimary, stroke: "#1a0e0a", strokeThickness: 3 })
      .setOrigin(0.5)
      .setName("distanceText");

    const eventText = this.add
      .text(CX, 260, "タップして進撃しよう！", {
        ...TYPE.body,
        color: THEME.textPrimary,
        align: "center",
        stroke: "#1a0e0a",
        strokeThickness: 3,
        wordWrap: { width: 340, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setName("eventText");
    const rewardText = this.add
      .text(CX, 310, "", { ...TYPE.h2, color: hexToCss(THEME.accent), stroke: "#1a0e0a", strokeThickness: 3 })
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
    this.setBackgroundDim(0.2);
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

    if (event.reward > 0) this.spawnFloatingText(CX, 400, `+${event.reward}`, hexToCss(THEME.accent));

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
    const panel = drawPanel(this, CX, 400, 400, 620, { depth: 0, fillAlpha: this.textures.exists(BG_KEY) ? 0.85 : 0.95 });

    const heading = this.add
      .text(CX, 125, "武将ガチャ", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const costText = this.add
      .text(CX, 162, `1回 ${GACHA_COST} コイン`, { ...TYPE.body, color: THEME.textMuted })
      .setOrigin(0.5);

    // 排出武将の立ち絵枠（立ち絵が無い武将はレアリティ色の枠＋名前だけを表示）
    const artFrame = this.add.graphics().setName("gachaArtFrame");
    const artSlot = this.add.container(CX, 320).setName("gachaArt");

    const resultText = this.add
      .text(CX, 470, "", { ...TYPE.h2, color: THEME.textPrimary, align: "center" })
      .setOrigin(0.5)
      .setName("gachaResult");
    const balanceText = this.add
      .text(CX, 520, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("gachaBalance");

    const drawBtn = makeButton(this, CX, 580, 260, 52, "引く", () => this.rollGacha(), { fontSize: "16px" });
    const backBtn = makeButton(this, CX, 650, 260, 48, "タイトルへ戻る", () => this.showTitle(), {
      fontSize: "14px",
    });

    this.gachaGroup.add([
      panel,
      heading,
      costText,
      artFrame,
      artSlot,
      resultText,
      balanceText,
      drawBtn.container,
      backBtn.container,
    ]);
    this.gachaGroup.setVisible(false);
    this.renderGachaArt(null);
  }

  /**
   * ガチャ結果の立ち絵表示。general が null のときは空の枠だけ描く。
   * 立ち絵テクスチャが無い場合はレアリティ色の枠内に名前の頭文字を大きく出すフォールバック。
   */
  private renderGachaArt(general: General | null): void {
    const frameW = 180;
    const frameH = frameW / ART_ASPECT; // 240
    const cx = CX;
    const cy = 320;
    const frame = this.gachaGroup.getByName("gachaArtFrame") as Phaser.GameObjects.Graphics;
    const slot = this.gachaGroup.getByName("gachaArt") as Phaser.GameObjects.Container;
    slot.removeAll(true);

    const color = general ? (RARITY_COLOR[general.rarity] ?? 0xffffff) : THEME.panelBorder;
    frame.clear();
    frame.fillStyle(0x1a0e0a, 0.6);
    frame.fillRoundedRect(cx - frameW / 2, cy - frameH / 2, frameW, frameH, 12);
    frame.lineStyle(general ? 3 : 1.5, color, general ? 0.95 : 0.5);
    frame.strokeRoundedRect(cx - frameW / 2, cy - frameH / 2, frameW, frameH, 12);

    if (!general) {
      slot.add(this.add.text(0, 0, "？", { ...TYPE.h1, color: THEME.textMuted }).setOrigin(0.5).setAlpha(0.5));
      return;
    }
    const artKey = GENERAL_ART[general.id];
    if (artKey && this.textures.exists(artKey)) {
      const pad = 8;
      const img = this.add.image(0, 0, artKey).setDisplaySize(frameW - pad * 2, frameH - pad * 2);
      slot.add(img);
      return;
    }
    // フォールバック: 頭文字＋レアリティ
    const initial = this.add
      .text(0, -16, general.name.charAt(0), { ...TYPE.h1, fontSize: "64px", color: hexToCss(color) })
      .setOrigin(0.5);
    const rarity = this.add.text(0, 48, general.rarity, { ...TYPE.h2, color: hexToCss(color) }).setOrigin(0.5);
    slot.add([initial, rarity]);
  }

  private showGacha(): void {
    this.phase = "gacha";
    this.setBackgroundDim(0.6);
    this.titleGroup.setVisible(false);
    this.gachaGroup.setVisible(true);
    const resultText = this.gachaGroup.getByName("gachaResult") as Phaser.GameObjects.Text;
    resultText.setText("");
    this.renderGachaArt(null);
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
    saveOwnedGeneral(general.id);
    const isRare = general.rarity === "SSR" || general.rarity === "SR";
    this.playSound(isRare ? sfx.gachaRare : sfx.gachaDraw);
    resultText
      .setText(`【${general.rarity}】${general.name}\nATK ${general.atk}`)
      .setColor(hexToCss(RARITY_COLOR[general.rarity] ?? 0xffffff));
    this.tweens.add({ targets: resultText, scale: isRare ? 1.4 : 1.2, duration: isRare ? 180 : 120, yoyo: true });
    this.renderGachaArt(general);
    const artSlot = this.gachaGroup.getByName("gachaArt") as Phaser.GameObjects.Container;
    artSlot.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: artSlot, scale: 1, alpha: 1, duration: isRare ? 320 : 180, ease: "Back.easeOut" });
    if (isRare) {
      this.cameras.main.flash(200, 255, 220, 140);
      cg.happytime();
    }
    this.refreshGachaBalance();
  }

  // ---------- 装備合成（ブリーディング） ----------

  private buildBreedingScreen(): void {
    this.breedingGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 660, { depth: 0, fillAlpha: this.textures.exists(BG_KEY) ? 0.85 : 0.95 });

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
    const inventoryText = this.add
      .text(CX, 530, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("breedInventory");

    const breedBtn = makeButton(this, CX, 590, 260, 52, "合成する", () => this.onBreed(), { fontSize: "16px" });
    const backBtn = makeButton(this, CX, 655, 260, 48, "タイトルへ戻る", () => this.showTitle(), {
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
      inventoryText,
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
    this.setBackgroundDim(0.6);
    this.titleGroup.setVisible(false);
    this.breedingGroup.setVisible(true);
    const resultText = this.breedingGroup.getByName("breedResult") as Phaser.GameObjects.Text;
    resultText.setText("");
    this.refreshBreedRatePreview();
    this.refreshBreedBalance();
    this.refreshBreedInventory();
  }

  private refreshBreedBalance(): void {
    const balanceText = this.breedingGroup.getByName("breedBalance") as Phaser.GameObjects.Text;
    balanceText.setText(`所持コイン: ${loadCurrency()}`);
  }

  private refreshBreedInventory(): void {
    const inventoryText = this.breedingGroup.getByName("breedInventory") as Phaser.GameObjects.Text;
    const inv = loadEquipmentInventory();
    inventoryText.setText(`所持装備: Common ${inv.Common} / Rare ${inv.Rare} / Epic ${inv.Epic}`);
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
    addEquipment(rarity);
    this.playSound(sfx.breed);
    resultText.setText(`【${rarity}】装備を入手！`).setColor(hexToCss(RARITY_COLOR[rarity] ?? 0xffffff));
    this.tweens.add({ targets: resultText, scale: 1.2, duration: 120, yoyo: true });
    this.refreshBreedBalance();
    this.refreshBreedInventory();
  }

  // ---------- 武将一覧・装備 ----------

  private buildRosterScreen(): void {
    this.rosterGroup = this.add.container(0, 0);
    const panel = drawPanel(this, CX, 400, 400, 700, { depth: 0, fillAlpha: this.textures.exists(BG_KEY) ? 0.85 : 0.95 });

    const heading = this.add
      .text(CX, 90, "武将一覧・装備", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    const hint = this.add
      .text(CX, 125, "タップで装備を切り替え\n（所持装備からなし→Common→Rare→Epicの順）", {
        ...TYPE.small,
        color: THEME.textMuted,
        align: "center",
        wordWrap: { width: 340, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const inventoryText = this.add
      .text(CX, 160, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5)
      .setName("rosterInventory");

    const backBtn = makeButton(this, CX, 690, 260, 48, "タイトルへ戻る", () => this.showTitle(), {
      fontSize: "14px",
    });

    this.rosterGroup.add([panel, heading, hint, inventoryText, backBtn.container]);
    this.rosterGroup.setVisible(false);
  }

  private showRoster(): void {
    this.phase = "roster";
    this.setBackgroundDim(0.6);
    this.titleGroup.setVisible(false);
    this.rosterGroup.setVisible(true);
    this.refreshRoster();
  }

  private refreshRoster(): void {
    const inventoryText = this.rosterGroup.getByName("rosterInventory") as Phaser.GameObjects.Text;
    const inv = loadEquipmentInventory();
    inventoryText.setText(`所持装備: Common ${inv.Common} / Rare ${inv.Rare} / Epic ${inv.Epic}`);

    for (const row of this.rosterRows) row.container.destroy();
    this.rosterRows = [];

    const owned = loadOwnedGenerals();
    const equipped = loadEquippedMap();
    const rowH = 52;
    const rowGap = 6;
    const startY = 195;

    GENERAL_POOL.forEach((general, i) => {
      const y = startY + i * (rowH + rowGap);
      const has = isOwned(owned, general.id);
      const bg = this.add.graphics();
      bg.fillStyle(THEME.panelFill, has ? 0.7 : 0.35);
      bg.fillRoundedRect(-180, -rowH / 2, 360, rowH, 8);
      bg.lineStyle(1.5, THEME.panelBorder, has ? 0.7 : 0.3);
      bg.strokeRoundedRect(-180, -rowH / 2, 360, rowH, 8);

      // 立ち絵があれば行左端にポートレート表示（未所持はシルエット風に暗くする）
      const portraitH = rowH - 8;
      const portraitW = portraitH * ART_ASPECT;
      const portraitX = -180 + 8 + portraitW / 2;
      const rowChildren: Phaser.GameObjects.GameObject[] = [bg];
      const artKey = GENERAL_ART[general.id];
      if (artKey && this.textures.exists(artKey)) {
        const portrait = this.add.image(portraitX, 0, artKey).setDisplaySize(portraitW, portraitH);
        if (!has) portrait.setTint(0x222222).setAlpha(0.6);
        rowChildren.push(portrait);
      }
      const textX = artKey && this.textures.exists(artKey) ? portraitX + portraitW / 2 + 8 : -165;

      const count = owned[general.id] ?? 0;
      const nameText = this.add
        .text(textX, -14, `【${general.rarity}】${general.name}`, {
          ...TYPE.body,
          color: has ? hexToCss(RARITY_COLOR[general.rarity] ?? 0xffffff) : THEME.textMuted,
        })
        .setOrigin(0, 0.5);
      const statusText = this.add
        .text(
          textX,
          14,
          has
            ? `所持×${count}  ATK ${effectiveAtk(general, equipped)}  装備:${equipped[general.id] ?? "なし"}`
            : "未所持",
          { ...TYPE.small, color: THEME.textMuted },
        )
        .setOrigin(0, 0.5);

      rowChildren.push(nameText, statusText);
      const container = this.add.container(CX, y, rowChildren).setSize(360, rowH);
      if (has) {
        container.setInteractive({ useHandCursor: true });
        container.on("pointerdown", () => this.onCycleEquip(general));
      }

      this.rosterGroup.add(container);
      this.rosterRows.push({ general, container });
    });
  }

  /** なし→Common→Rare→Epic→なし…の順に切り替える。所持数0のレアリティは自動でスキップする */
  private onCycleEquip(general: General): void {
    const equipped = loadEquippedMap();
    const current = equipped[general.id];

    let updated: EquippedMap = equipped;
    if (current) {
      addEquipment(current);
      updated = unequipGeneral(updated, general.id);
    }

    const inventory = loadEquipmentInventory();
    const cycle: readonly (EquipRarity | undefined)[] = [undefined, "Common", "Rare", "Epic"];
    const startIndex = (cycle.indexOf(current) + 1) % cycle.length;
    let chosen: EquipRarity | undefined;
    for (let step = 0; step < cycle.length; step++) {
      const candidate = cycle[(startIndex + step) % cycle.length];
      if (candidate === undefined || inventory[candidate] > 0) {
        chosen = candidate;
        break;
      }
    }

    if (chosen) {
      spendEquipment(chosen);
      updated = equipToGeneral(updated, general.id, chosen);
    }
    saveEquippedMap(updated);
    this.playSound(sfx.tap);
    this.refreshRoster();
  }
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

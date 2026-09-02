import Phaser from "phaser";
import { ACHIEVEMENTS, checkNewAchievements, unlockAchievements } from "../logic/achievements";
import {
  applyOfflineProgress,
  buyClickUpgrades,
  buyGenerator,
  buyOfflineExtension,
  click,
  CLICK_UPGRADE_QUANTITIES,
  clickUpgradeCostForQuantity,
  essenceMultiplier,
  essenceOnPrestige,
  formatNumber,
  GameState,
  GENERATORS,
  generatorCost,
  maxAffordableClickUpgrades,
  newGame,
  offlineCapSec,
  offlineExtensionCost,
  prestige,
  PRESTIGE_UNLOCK,
  productionPerSec,
  tick,
} from "../logic/economy";
import { achievementName, detectLang, generatorName, Lang, t, toggleLang } from "../logic/i18n";
import {
  AnalyticsData,
  loadAnalytics,
  newAnalytics,
  recordPlaytime,
  recordPrestige,
  recordSessionStart,
  saveAnalytics,
} from "../logic/analytics";
import { exportSaveJson, load, parseSaveJson, save } from "../logic/save";
import { townForPrestige } from "../logic/towns";
import { sfx } from "../platform/audio";
import { cg } from "../platform/crazygames";
import {
  ELEVATION,
  ProgressBar,
  RoundedRect,
  SmoothedCounter,
  THEME,
  TYPE,
  ActionCard,
  drawBoltIcon,
  drawFlaskIcon,
  drawHourglassIcon,
  drawPanel,
  drawProgressBar,
  drawSparkleIcon,
  drawSpeakerIcon,
  makeActionCard,
  makeRoundedRect,
  popOnChange,
} from "../ui/theme";

const SAVE_INTERVAL_MS = 5_000;
const SOUND_PREF_KEY = "ai_project002_sound_v1";

/** ポーション工房 — メイン画面 */
export class IdleScene extends Phaser.Scene {
  private state: GameState = newGame();
  private analytics: AnalyticsData = newAnalytics();
  private lang: Lang = detectLang(navigator.language);
  private soundOn = localStorage.getItem(SOUND_PREF_KEY) !== "off";

  private titleText!: Phaser.GameObjects.Text;
  private titleIcon!: Phaser.GameObjects.Graphics;
  private potionText!: Phaser.GameObjects.Text;
  private rateText!: Phaser.GameObjects.Text;
  private essenceText!: Phaser.GameObjects.Text;
  private brewText: Phaser.GameObjects.Text | null = null;
  private langText!: Phaser.GameObjects.Text;
  private soundIcon!: Phaser.GameObjects.Graphics;
  private clickCard!: ActionCard;
  private offlineCard!: ActionCard;
  private prestigeCard!: ActionCard;
  private prestigeProgress!: ProgressBar;
  private prestigeGlow!: Phaser.GameObjects.Graphics;
  private prestigeGlowTween?: Phaser.Tweens.Tween;
  private prestigeWasAffordable = false;
  private footerStatsText!: Phaser.GameObjects.Text;
  private townGlow!: Phaser.GameObjects.Graphics;
  private townText!: Phaser.GameObjects.Text;
  private lastTownIndex = -1;
  private buyQty = 1; // クリック強化の一括購入数。CLICK_UPGRADE_QUANTITIES のいずれか（Infinity = MAX）
  private qtyButtons: { qty: number; rect: RoundedRect; label: Phaser.GameObjects.Text }[] = [];
  private rows: {
    id: string;
    button: RoundedRect;
    label: Phaser.GameObjects.Text;
    rateLabel: Phaser.GameObjects.Text;
    costLabel: Phaser.GameObjects.Text;
  }[] = [];

  private welcomeGained = 0;
  private lastSave = 0;
  private potionCounter = new SmoothedCounter(0);

  constructor() {
    super("idle");
  }

  /**
   * ChatGPT等で生成したイラスト素材を読み込む。画像が無い/読み込みに失敗しても
   * 各所のGraphics描画フォールバックで従来通り動作する（`docs/art-assets.md`参照）。
   */
  preload(): void {
    this.load.image("pw-bg-workshop", "images/pw-bg-workshop.png");
    this.load.image("pw-hero-alchemist", "images/pw-hero-alchemist.png");
    this.load.image("pw-cauldron-icon", "images/pw-cauldron-icon.png");
    this.load.image("pw-dragon-icon", "images/pw-dragon-icon.png");
  }

  create(): void {
    this.analytics = recordSessionStart(loadAnalytics(localStorage), Date.now());
    saveAnalytics(this.analytics, localStorage);

    // セーブ復元＋オフライン進行
    const data = load(localStorage);
    if (data) {
      const elapsed = (Date.now() - data.savedAt) / 1000;
      const { state, gained } = applyOfflineProgress(data.state, elapsed);
      this.state = state;
      this.welcomeGained = gained;
    }
    this.potionCounter = new SmoothedCounter(this.state.potions);

    this.buildBackground();
    this.buildZonePanels();
    const mascot = this.buildAlchemistMascot();
    this.buildHeader();
    this.buildBrewArea(mascot);
    this.buildGeneratorList();
    this.buildSaveTools();

    this.refreshStaticTexts();
    this.refreshUI();
    cg.gameplayStart();

    if (this.welcomeGained >= 1) {
      this.showWelcomeModal(this.welcomeGained);
    }
  }

  update(_time: number, delta: number): void {
    this.state = tick(this.state, delta / 1000);
    this.checkAchievements();
    this.refreshUI(delta / 1000);

    this.lastSave += delta;
    if (this.lastSave >= SAVE_INTERVAL_MS) {
      this.lastSave = 0;
      save(this.state, localStorage, Date.now());
      this.analytics = recordPlaytime(this.analytics, SAVE_INTERVAL_MS / 1000, Date.now());
      saveAnalytics(this.analytics, localStorage);
    }
  }

  // ---- 画面構築 ----

  private buildBackground(): void {
    // イラスト背景（ChatGPT生成、docs/art-assets.md参照）があれば使い、無ければ
    // 淡い青空〜白のグラデーション（ソシャゲ調の明るいファンタジー基調）にフォールバックする
    if (this.textures.exists("pw-bg-workshop")) {
      this.add.image(400, 380, "pw-bg-workshop").setDisplaySize(800, 760);
      // イラストの色味を活かすため、既存グラデーションはごく薄い一枚だけ重ねてUIとの馴染みだけ取る
      const tint = this.add.graphics();
      tint.fillGradientStyle(0xaee0ff, 0xaee0ff, 0xf3fbff, 0xf3fbff, 0.08);
      tint.fillRect(0, 0, 800, 760);
    } else {
      const g = this.add.graphics();
      g.fillGradientStyle(0xaee0ff, 0xaee0ff, 0xf3fbff, 0xf3fbff, 1);
      g.fillRect(0, 0, 800, 760);
    }
    const glow = this.add.graphics();
    glow.fillStyle(0xffffff, 0.28);
    glow.fillCircle(160, 220, 200);

    // 転生と連動した「街」のアクセントカラーを淡く重ねる。実際の描画は refreshUI() 経由の
    // refreshTownGlow() が行う（townText 等ヘッダー要素の生成が buildBackground より後のため）
    this.townGlow = this.add.graphics();

    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(20, 780);
      const y = Phaser.Math.Between(140, 700);
      const bubble = this.add.circle(x, y, Phaser.Math.Between(2, 5), 0xffffff, 0.55);
      this.tweens.add({
        targets: bubble,
        y: y - Phaser.Math.Between(30, 80),
        alpha: 0,
        duration: Phaser.Math.Between(4000, 9000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 4000),
      });
    }
  }

  /**
   * ブリューエリアと設備リストをそれぞれ1枚のゾーンパネルで囲み、階層(背景/ゾーン/カード)を
   * 明確にする。カード側の色は既存の購入可否ロジックをそのまま使うため変更しない。
   */
  private buildZonePanels(): void {
    // 転生ボタン（y=525,h=64→下端557）とパネル下端の間に十分な余白を確保する
    drawPanel(this, 160, 360, 300, 450, {
      radius: 18,
      fillColor: ELEVATION.zone,
      fillAlpha: 0.9,
      borderColor: THEME.panelBorder,
      borderAlpha: 0.5,
    });
    drawPanel(this, 560, 348, 440, 508, {
      radius: 18,
      fillColor: ELEVATION.zone,
      fillAlpha: 0.9,
      borderColor: THEME.panelBorder,
      borderAlpha: 0.5,
    });
  }

  /**
   * 錬金術師キャラをブリューエリアの主役として、ゾーンパネルの上に配置する。
   * zonePanelは不透明(fillAlpha 0.9)で背景を覆うため、buildBackground側に置くと
   * ほぼ隠れてしまう——buildZonePanelsの後に呼ぶことで「パネルの上に乗る」正しい
   * 重なり順になる。実際のクリック円は buildBrewArea() が作るので、ここでは絵だけ用意する
   * （画像が無い場合は buildBrewArea() 側が単色円のフォールバックボタンを描く）
   */
  private buildAlchemistMascot(): Phaser.GameObjects.Image | null {
    if (!this.textures.exists("pw-hero-alchemist")) return null;
    return this.add.image(160, 200, "pw-hero-alchemist").setDisplaySize(220, 220);
  }

  private buildHeader(): void {
    this.titleText = this.add
      .text(400, 26, "", { ...TYPE.h1, color: THEME.textPrimary })
      .setOrigin(0.5);
    this.titleIcon = drawFlaskIcon(this, 400, 26, 22);
    this.potionText = this.add
      .text(400, 62, "", { ...TYPE.numeric, color: "#1f8a63" })
      .setOrigin(0.5);
    this.rateText = this.add
      .text(400, 88, "", { ...TYPE.small, color: THEME.textMuted })
      .setOrigin(0.5);
    // 転生と連動して切り替わる「現在の街」の表示
    this.townText = this.add
      .text(400, 105, "", { ...TYPE.small, color: THEME.textMuted, fontStyle: "600" })
      .setOrigin(0.5);
    this.essenceText = this.add
      .text(16, 14, "", { ...TYPE.body, color: "#8a4fd1" })
      .setOrigin(0, 0);

    // 右上ボタン群: 実績 / サウンド / 言語
    const achButton = this.makeSmallButton(600, 26, 90, "", () => this.showAchievementsModal());
    this.registerRefresh(() => achButton.label.setText(t(this.lang, "achievementsButton")));

    this.makeSmallButton(700, 26, 44, "", () => {
      this.soundOn = !this.soundOn;
      localStorage.setItem(SOUND_PREF_KEY, this.soundOn ? "on" : "off");
      this.refreshStaticTexts();
    });
    this.soundIcon = drawSpeakerIcon(this, 700, 26, this.soundOn, 18);

    const langButton = this.makeSmallButton(760, 26, 60, "", () => {
      this.lang = toggleLang(this.lang);
      this.refreshStaticTexts();
    });
    this.langText = langButton.label;
  }

  /**
   * ブリュー操作: キャラ画像がある場合は「ボタンを押す」ではなく「錬金術師本人をタップする」
   * 体験にする。ユーザーからの「ボタンやめてキャラタップにしたら？」というフィードバックを反映。
   * 画像が無い環境（未組み込み/読み込み失敗）では、従来通りの単色円ボタンにフォールバックする。
   */
  private buildBrewArea(mascot: Phaser.GameObjects.Image | null): void {
    if (!mascot) {
      // フォールバック: 画像が無い場合は従来通りの単色円ボタン
      const ring = this.add.circle(160, 230, 70, 0x9d5cff, 0).setStrokeStyle(2, 0xd9a7ff, 0.6);
      const brew = this.add
        .circle(160, 230, 65, 0x9d5cff)
        .setStrokeStyle(2, 0xffffff, 0.8)
        .setInteractive({ useHandCursor: true });
      this.brewText = this.add
        .text(160, 230, "", { fontSize: "22px", color: "#ffffff", fontStyle: "700" })
        .setOrigin(0.5);
      brew.on("pointerdown", () => this.onBrewTap([brew, ring]));
    } else {
      // 柔らかいグロー（背景の装飾のみ、ボタンの縁取りではない）
      const glow = this.add.circle(160, 220, 95, 0x9d5cff, 0.15);
      mascot.setInteractive({ useHandCursor: true });
      // タップ可能であることが伝わるよう、常時ゆっくり上下に揺れるアイドルアニメーションを付与
      this.tweens.add({ targets: mascot, y: mascot.y - 6, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      mascot.on("pointerdown", () => this.onBrewTap([mascot], glow));
    }

    // 購入数セレクター（クリック強化に使う一括購入数）。選択中はクリック強化カードと同じ金色で統一する
    const paintQty = () => {
      for (const b of this.qtyButtons) {
        const on = b.qty === this.buyQty;
        b.rect.setFillStyle(on ? 0xc98a12 : 0xffffff, on ? 1 : 0.85);
        b.label.setColor(on ? "#ffffff" : "#5a6a7a");
      }
    };
    CLICK_UPGRADE_QUANTITIES.forEach((qty, i) => {
      const bx = 40 + i * 60;
      const rect = makeRoundedRect(this, bx, 322, 52, 24, 0xffffff, {
        radius: 12,
        borderWidth: 1,
        borderColor: 0xc98a12,
        borderAlpha: 0.5,
      });
      const label = this.add
        .text(bx, 322, "", { ...TYPE.small, fontStyle: "700", color: "#5a6a7a" })
        .setOrigin(0.5);
      rect.on("pointerdown", () => {
        this.buyQty = qty;
        paintQty();
      });
      this.qtyButtons.push({ qty, rect, label });
      this.registerRefresh(() =>
        label.setText(qty === Infinity ? t(this.lang, "buyQtyMax") : `x${qty}`),
      );
    });
    paintQty();

    // クリック強化（購入数セレクターに応じて一括購入）
    this.clickCard = makeActionCard(this, 160, 376, 260, 58, 0xc98a12, drawBoltIcon);
    this.clickCard.container.on("pointerdown", () => {
      const before = this.state.clickPower;
      const next = buyClickUpgrades(this.state, this.buyQty);
      if (next) {
        const gained = next.clickPower - before;
        this.state = next;
        this.playSound(sfx.buy);
        this.clickCard.press();
        this.spawnFloatingText(160, 345, `+${gained} ⚡`, "#c98a12");
      }
    });

    // 放置上限拡張（essence消費、複数ソース加算式で将来の課金/バフ等にも対応できる設計）
    this.offlineCard = makeActionCard(this, 160, 442, 260, 52, 0x2f8fd1, drawHourglassIcon);
    this.offlineCard.container.on("pointerdown", () => {
      const next = buyOfflineExtension(this.state);
      if (next) {
        this.state = next;
        save(this.state, localStorage, Date.now());
        this.playSound(sfx.buy);
        this.offlineCard.press();
        this.spawnFloatingText(160, 415, "+6h ⏳", "#2f8fd1");
      }
    });

    // 転生: 解放中は背後にパルスするグロー（カードより先に追加し、必ずカードの背後に描画する）
    this.prestigeGlow = this.add.graphics({ x: 160, y: 527 });
    this.prestigeGlow.fillStyle(0xd9a7ff, 1);
    this.prestigeGlow.fillRoundedRect(-142, -46, 284, 92, 24);
    this.prestigeGlow.setAlpha(0);

    this.prestigeCard = makeActionCard(this, 160, 527, 260, 70, 0x8a4fd1, drawSparkleIcon, { radius: 16 });
    // 右側のコストピル（最大 "+999K ✨" 程度 ≒ 70px）と重ならない幅で折り返す
    this.prestigeCard.sub.setWordWrapWidth(this.prestigeCard.contentRight - this.prestigeCard.contentLeft - 76);
    // 転生解放（累計醸造数）までの進捗をカード下部に可視化する。解放後は非表示にする
    {
      const left = this.prestigeCard.contentLeft;
      const width = this.prestigeCard.contentRight - left;
      this.prestigeProgress = drawProgressBar(this, left + width / 2, 26, width, 6, 0, {
        trackColor: 0xe6dcf6,
        fillColor: 0x9d5cff,
      });
      // drawProgressBarはシーン直下に2枚のGraphicsを作るため、カードのContainerへ移してスケール演出に追従させる
      this.prestigeCard.container.add([this.prestigeProgress.track, this.prestigeProgress.graphics]);
    }
    this.prestigeCard.container.on("pointerdown", () => {
      const gained = essenceOnPrestige(this.state);
      if (gained <= 0) return;
      this.prestigeCard.press();
      if (!window.confirm(t(this.lang, "prestigeConfirm", { n: formatNumber(gained) }))) return;
      const next = prestige(this.state);
      if (next) {
        this.state = next;
        save(this.state, localStorage, Date.now());
        this.analytics = recordPrestige(this.analytics, this.state.prestigeCount);
        saveAnalytics(this.analytics, localStorage);
        this.playSound(sfx.prestige);
        this.cameras.main.flash(600, 217, 167, 255);
        cg.happytime();
      }
    });
  }

  private onBrewTap(bounceTargets: Phaser.GameObjects.GameObject[], glow?: Phaser.GameObjects.Arc): void {
    const gain = this.state.clickPower * essenceMultiplier(this.state);
    this.state = click(this.state);
    this.playSound(sfx.click);
    this.tweens.add({ targets: bounceTargets, scale: 0.94, duration: 70, yoyo: true, ease: "Sine.easeOut" });
    if (glow) {
      this.tweens.add({ targets: glow, alpha: 0.35, duration: 70, yoyo: true });
    }
    this.spawnFloatingText(160, 130, `+${formatNumber(gain)}`, "#1f8a63");
  }

  private buildGeneratorList(): void {
    GENERATORS.forEach((g, i) => {
      const y = 130 + i * 62;
      const button = makeRoundedRect(this, 560, y, 400, 52, 0xeaf5ff, { radius: 10, borderColor: 0x9ecbef });

      // 設備ごとのアイコン: ChatGPT生成イラスト（cauldron/dragon）があればそれを使い、
      // 無い設備は従来通り色相をずらしたジェム風アイコンで一目で見分けやすくする（装飾）
      const iconKey = g.id === "cauldron" ? "pw-cauldron-icon" : g.id === "dragon" ? "pw-dragon-icon" : null;
      if (iconKey && this.textures.exists(iconKey)) {
        this.add.image(382, y, iconKey).setDisplaySize(30, 30);
      } else {
        const hue = (i / GENERATORS.length) * 0.8;
        const gemColor = Phaser.Display.Color.HSVToRGB(hue, 0.65, 0.85).color;
        const gem = this.add.graphics({ x: 382, y });
        gem.fillStyle(gemColor, 1);
        gem.fillCircle(0, 0, 12);
        gem.fillStyle(0xffffff, 0.35);
        gem.fillCircle(-4, -4, 4);
        gem.lineStyle(1.5, 0xffffff, 0.4);
        gem.strokeCircle(0, 0, 12);
      }

      // アイコンを主役にして情報量を絞る: 名前(+所持数)を1行、生産量を小さく補足、コストは
      // 右側に「値札」として分離する（スプレッドシート的な1行詰め込みを避け、ショップの商品行らしくする）
      const label = this.add
        .text(400, y - 15, "", { ...TYPE.body, color: THEME.textPrimary })
        .setOrigin(0, 0);
      const rateLabel = this.add
        .text(400, y + 3, "", { ...TYPE.small, color: THEME.textMuted })
        .setOrigin(0, 0);
      const costLabel = this.add
        .text(740, y, "", { ...TYPE.body, color: THEME.textPrimary, align: "right" })
        .setOrigin(1, 0.5);
      button.on("pointerdown", () => {
        const next = buyGenerator(this.state, g.id);
        if (next) {
          this.state = next;
          this.playSound(sfx.buy);
          this.tweens.add({ targets: [button, label], scaleX: 1.03, duration: 70, yoyo: true });
          this.spawnFloatingText(560, y - 30, `${generatorName(this.lang, g.id)} +1`, "#ffd166");
        }
      });
      this.rows.push({ id: g.id, button, label, rateLabel, costLabel });
    });
  }

  /**
   * 画面下部の空白（ゾーンパネル下端〜キャンバス下端）をフッターとして活用し、
   * これまで数値化されていなかった生涯統計（累計醸造・実績・転生回数・プレイ時間）を表示する。
   */
  private buildSaveTools(): void {
    drawPanel(this, 400, 685, 780, 140, {
      radius: 16,
      fillColor: ELEVATION.zone,
      fillAlpha: 0.85,
      borderColor: THEME.panelBorder,
      borderAlpha: 0.4,
      shadow: false,
    });
    this.footerStatsText = this.add
      .text(400, 630, "", { ...TYPE.small, color: THEME.textMuted, align: "center" })
      .setOrigin(0.5);

    const exportButton = this.makeSmallButton(220, 715, 200, "", () => this.doExport());
    this.registerRefresh(() => exportButton.label.setText(t(this.lang, "exportButton")));

    const importButton = this.makeSmallButton(440, 715, 200, "", () => this.doImport());
    this.registerRefresh(() => importButton.label.setText(t(this.lang, "importButton")));
  }

  /** フッターの生涯統計テキストを更新する */
  private refreshFooterStats(): void {
    const unlockedCount = this.state.unlockedAchievements.length;
    const totalCount = ACHIEVEMENTS.length;
    const hours = Math.floor(this.analytics.totalPlaytimeSec / 3600);
    const minutes = Math.floor((this.analytics.totalPlaytimeSec % 3600) / 60);
    this.footerStatsText.setText(
      `${t(this.lang, "footerLifetimeBrewed")}: ${formatNumber(this.state.lifetimeBrewed)}  |  ` +
        `${t(this.lang, "achievementsButton")}: ${unlockedCount}/${totalCount}  |  ` +
        `${t(this.lang, "footerPrestigeCount")}: ${this.state.prestigeCount}  |  ` +
        `${t(this.lang, "footerPlaytime")}: ${hours}h ${minutes}m`,
    );
  }

  /**
   * 転生回数から現在の街を求め、表示とアクセントカラーを更新する。
   * 街が変わった時だけ再描画するよう `lastTownIndex`（周回を跨ぐと同じindexに戻るため
   * cycleも合わせて比較する）でガードし、無駄な再描画を避ける。
   */
  private refreshTownGlow(): void {
    const town = townForPrestige(this.state.prestigeCount);
    const key = town.cycle * 1000 + town.index;
    if (key === this.lastTownIndex) return;
    this.lastTownIndex = key;
    this.townGlow.clear();
    this.townGlow.fillStyle(town.accent, 0.12);
    this.townGlow.fillCircle(160, 230, 220);
    this.townText?.setText(`🏘 ${town.name}`);
  }

  // ---- 小さな汎用ボタン ----
  private refreshCallbacks: (() => void)[] = [];
  private registerRefresh(fn: () => void): void {
    this.refreshCallbacks.push(fn);
  }

  private makeSmallButton(
    x: number,
    y: number,
    width: number,
    initialText: string,
    onClick: () => void,
  ): { rect: RoundedRect; label: Phaser.GameObjects.Text } {
    const rect = makeRoundedRect(this, x, y, width, 32, 0xe4eef8, {
      radius: 8,
      borderWidth: 1,
      borderColor: 0x9ecbef,
    });
    const label = this.add
      .text(x, y, initialText, { fontSize: "13px", color: "#3a4a5a" })
      .setOrigin(0.5);
    rect.on("pointerdown", onClick);
    return { rect, label };
  }

  // ---- モーダル ----

  private showModal(bodyText: string, onClose?: () => void, iconKey?: string): void {
    const overlay = this.add.rectangle(400, 380, 800, 760, 0x3a5a78, 0.55).setInteractive();
    const panel = drawPanel(this, 400, 380, 560, 420, { radius: 20, fillColor: 0xffffff, shadow: false });
    const hasIcon = !!iconKey && this.textures.exists(iconKey);
    const icon = hasIcon ? this.add.image(400, 250, iconKey!).setDisplaySize(150, 150) : null;
    const text = this.add
      .text(400, hasIcon ? 400 : 340, bodyText, {
        fontSize: "14px",
        color: "#3a4a5a",
        align: "center",
        wordWrap: { width: 500 },
      })
      .setOrigin(0.5);
    const closeBtn = this.makeSmallButton(400, 550, 140, t(this.lang, "closeButton"), () => {
      overlay.destroy();
      panel.destroy();
      icon?.destroy();
      text.destroy();
      closeBtn.rect.destroy();
      closeBtn.label.destroy();
      onClose?.();
    });
  }

  private showWelcomeModal(gained: number): void {
    this.showModal(
      `${t(this.lang, "welcomeTitle")}\n\n${t(this.lang, "welcomeBack", { n: formatNumber(gained) })}`,
      undefined,
      "pw-hero-alchemist",
    );
  }

  private showAchievementsModal(): void {
    const lines = ACHIEVEMENTS.map((a) => {
      const unlocked = this.state.unlockedAchievements.includes(a.id);
      return `${unlocked ? "✅" : "🔒"} ${achievementName(this.lang, a.id)}`;
    }).join("\n");
    this.showModal(`${t(this.lang, "achievementsTitle")}\n\n${lines}`);
  }

  // ---- セーブ書き出し/読み込み ----

  private doExport(): void {
    const json = exportSaveJson(this.state, Date.now());
    void navigator.clipboard?.writeText(json).catch(() => {});
    this.showModal(t(this.lang, "exportDone"));
  }

  private doImport(): void {
    const raw = window.prompt(t(this.lang, "importPrompt"));
    if (!raw) return;
    const parsed = parseSaveJson(raw);
    if (!parsed) {
      this.showModal(t(this.lang, "importFailed"));
      return;
    }
    this.state = parsed.state;
    save(this.state, localStorage, Date.now());
    this.showModal(t(this.lang, "importDone"));
  }

  // ---- 実績チェック ----

  private checkAchievements(): void {
    const newly = checkNewAchievements(this.state);
    if (newly.length === 0) return;
    this.state = unlockAchievements(this.state, newly);
    this.playSound(sfx.achievement);
    cg.happytime();
    for (const id of newly) {
      this.spawnFloatingText(
        400,
        700,
        t(this.lang, "achievementUnlocked", { n: achievementName(this.lang, id) }),
        "#ffd166",
      );
    }
  }

  private playSound(fn: () => void): void {
    if (this.soundOn) fn();
  }

  /** クリック位置から浮かんで消えるテキスト演出 */
  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    const obj = this.add
      .text(x + Phaser.Math.Between(-20, 20), y, text, { fontSize: "16px", color })
      .setOrigin(0.5);
    this.tweens.add({
      targets: obj,
      y: y - 50,
      alpha: 0,
      duration: 900,
      onComplete: () => obj.destroy(),
    });
  }

  /** 言語・設定に依存する固定文言を更新 */
  private refreshStaticTexts(): void {
    this.titleText.setText(t(this.lang, "title"));
    this.titleIcon.setPosition(400 - this.titleText.width / 2 - 18, 26);
    this.brewText?.setText(t(this.lang, "brew"));
    this.langText.setText(t(this.lang, "langButton"));
    this.soundIcon.destroy();
    this.soundIcon = drawSpeakerIcon(this, 700, 26, this.soundOn, 18);
    for (const fn of this.refreshCallbacks) fn();
  }

  private refreshUI(deltaSec = 0): void {
    this.refreshFooterStats();
    this.refreshTownGlow();
    const displayedPotions = this.potionCounter.next(this.state.potions, deltaSec);
    this.potionText.setText(`${formatNumber(displayedPotions)} ${t(this.lang, "potions")}`);
    this.rateText.setText(
      `${formatNumber(productionPerSec(this.state))} ${t(this.lang, "perSec")}`,
    );

    const bonusPct = Math.round(this.state.essence * 10);
    popOnChange(
      this,
      this.essenceText,
      this.state.essence > 0
        ? `${t(this.lang, "essence")} ${formatNumber(this.state.essence)}\n${t(this.lang, "essenceBonus", { n: bonusPct.toString() })}`
        : "",
    );

    const affordableQty = maxAffordableClickUpgrades(this.state);
    const displayQty =
      this.buyQty === Infinity ? Math.max(affordableQty, 1) : this.buyQty;
    const clickCost = clickUpgradeCostForQuantity(this.state, displayQty);
    const clickAffordable = affordableQty >= 1;
    this.clickCard.title.setText(`${t(this.lang, "clickUpgrade")}  Lv.${this.state.clickPower}`);
    this.clickCard.sub.setText(t(this.lang, "clickUpgradeDesc", { n: displayQty.toString() }));
    this.clickCard.setCost(formatNumber(clickCost));
    this.clickCard.setMood(clickAffordable ? "ready" : "idle");

    const capSec = offlineCapSec(this.state);
    const capHours = Math.round(capSec / 3600);
    const extCost = offlineExtensionCost(this.state);
    if (extCost === null) {
      this.offlineCard.title.setText(t(this.lang, "offlineCapLabel", { h: capHours.toString() }));
      this.offlineCard.sub.setText(t(this.lang, "offlineCapMaxed", { h: capHours.toString() }));
      this.offlineCard.setCost(t(this.lang, "buyQtyMax"));
      this.offlineCard.setMood("muted");
    } else {
      const capAffordable = this.state.essence >= extCost;
      this.offlineCard.title.setText(t(this.lang, "offlineCapLabel", { h: capHours.toString() }));
      this.offlineCard.sub.setText(t(this.lang, "offlineCapButton"));
      this.offlineCard.setCost(`${formatNumber(extCost)} ✨`);
      this.offlineCard.setMood(capAffordable ? "ready" : "idle");
    }

    const gained = essenceOnPrestige(this.state);
    if (gained > 0) {
      this.prestigeCard.title.setText(t(this.lang, "prestigeTitle"));
      this.prestigeCard.sub.setText(t(this.lang, "prestigeReady"));
      this.prestigeCard.setCost(`+${formatNumber(gained)} ✨`);
      this.prestigeCard.setMood("hero");
      this.prestigeProgress.graphics.setVisible(false);
      this.prestigeProgress.track.setVisible(false);
      if (!this.prestigeWasAffordable) {
        // 転生可能になった瞬間だけパルス演出を開始する（毎フレーム呼ぶrefreshUIからtween.addを連打しないため）
        this.prestigeWasAffordable = true;
        this.prestigeGlowTween?.stop();
        this.prestigeGlowTween = this.tweens.add({
          targets: this.prestigeGlow,
          alpha: { from: 0.12, to: 0.42 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    } else {
      this.prestigeCard.title.setText(t(this.lang, "prestigeTitle"));
      this.prestigeCard.sub.setText(t(this.lang, "prestigeLocked", { n: formatNumber(PRESTIGE_UNLOCK) }));
      this.prestigeCard.setCost(`${Math.floor((this.state.totalBrewed / PRESTIGE_UNLOCK) * 100)}%`);
      this.prestigeCard.setMood("idle");
      this.prestigeProgress.graphics.setVisible(true);
      this.prestigeProgress.track.setVisible(true);
      this.prestigeProgress.setRatio(this.state.totalBrewed / PRESTIGE_UNLOCK);
      if (this.prestigeWasAffordable) {
        this.prestigeWasAffordable = false;
        this.prestigeGlowTween?.stop();
        this.prestigeGlow.setAlpha(0);
      }
    }

    for (const row of this.rows) {
      const def = GENERATORS.find((g) => g.id === row.id)!;
      const count = this.state.counts[row.id] ?? 0;
      const cost = generatorCost(def, count);
      const affordable = this.state.potions >= cost;
      row.label.setText(`${generatorName(this.lang, def.id)}  ×${count}`);
      row.rateLabel.setText(`+${formatNumber(def.baseRate)}${t(this.lang, "perSec")}`);
      row.costLabel.setText(formatNumber(cost));
      row.button.setFillStyle(affordable ? 0xcdf3e3 : 0xeaf5ff);
      row.costLabel.setColor(affordable ? "#1f8a63" : "#a7b4c2");
    }
  }
}

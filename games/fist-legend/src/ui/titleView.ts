import Phaser from "phaser";
import { OPPONENTS, type Opponent } from "../logic/opponent";
import { FIGHTERS, type FighterId } from "../logic/team";
import { detectLang, fighterName, opponentHint, opponentName as localizedOpponentName, tr } from "../logic/i18n";
import { text, button } from "./controls";

export type TitleView = {
  titleGroup: Phaser.GameObjects.Container;
  titleArt: Phaser.GameObjects.Container;
  titleBackdrop?: Phaser.GameObjects.Image;
  titleHero?: Phaser.GameObjects.Image;
  titleShade: Phaser.GameObjects.Graphics;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
  titleStatus: Phaser.GameObjects.Text;
  titleHint: Phaser.GameObjects.Text;
  teamText: Phaser.GameObjects.Text;
  opponentButtons: Phaser.GameObjects.Container[];
  teamButtons: Phaser.GameObjects.Container[];
  titleChrome: Phaser.GameObjects.Graphics;
};
export type TitleModel = { selectedTeam: FighterId[]; opponent: Opponent; currency: number; wins: number };
export type TitleActions = {
  selectOpponent: (opponent: Opponent) => void;
  toggleTeamMember: (fighter: FighterId) => void;
  startBattle: () => void; startSeries: () => void; startStory: () => void; openGacha: () => void;
};
const rendered = new WeakMap<TitleView, string>();
export function createTitleView(scene: Phaser.Scene, actions: TitleActions): TitleView {
  const lang = detectLang();
  const titleChrome = scene.add.graphics();
  const titleBackdrop = scene.textures.exists("fl-bg-arena")
    ? scene.add.image(0, 0, "fl-bg-arena").setName("mobile-title-arena") : undefined;
  const titleHero = scene.textures.exists("fl-hero-fighter")
    ? scene.add.image(0, 0, "fl-hero-fighter").setName("mobile-title-hero") : undefined;
  const titleShade = scene.add.graphics();
  const titleArt = scene.add.container(0, 0, [
    ...(titleBackdrop ? [titleBackdrop] : []),
    ...(titleHero ? [titleHero] : []), titleShade,
  ]);
  const titleGroup = scene.add.container(0, 0);
  const title = text(scene, 225, 118, tr(lang, "覇拳伝", "Fist Legend"), 38, "#ffe1a8");
  const subtitle = text(scene, 225, 170, tr(lang, "対戦で練習\n3連戦で腕試し\n物語で章を進める", "Battle · Practice\nGauntlet · Test your skill\nStory · Advance chapters"), 19, "#f4d4bb").setName("title-mode-guide");
  const titleStatus = text(scene, 225, 225, "", 20, "#d9c4ad");
  const titleHint = text(scene, 225, 444, "", 19, "#ffe0a0").setName("title-opponent-hint");
  const teamText = text(scene, 225, 474, "", 19, "#ffe6b5").setName("title-team-summary");
  titleGroup.add([title, subtitle, titleStatus, titleHint, teamText]);

  const opponentButtons: Phaser.GameObjects.Container[] = [];
  OPPONENTS.forEach((opponent, index) => {
    const b = button(scene, titleGroup, 225, 292 + index * 58, 330, 46, localizedOpponentName(lang, opponent.id), 0x4d2b26, () => {
      actions.selectOpponent(opponent.id);
      titleHint.setText(opponentHint(lang, opponent.id));
    }).setName(`title-opponent-${opponent.id}`);
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
      44,
      fighterName(lang, fighter.id),
      fighter.id === "ryuga" ? 0x6d3f2f : fighter.accent,
      () => actions.toggleTeamMember(fighter.id),
    );
    teamButtons.push(b);
  });
  button(scene, titleGroup, 82, 565, 118, 72, tr(lang, "対戦", "Battle"), 0xa9402d, () => actions.startBattle(), false, 72).setName("title-battle");
  button(scene, titleGroup, 225, 565, 118, 72, tr(lang, "3連戦", "Gauntlet"), 0x8a6118, () => actions.startSeries(), false, 72).setName("title-series");
  button(scene, titleGroup, 368, 565, 118, 72, tr(lang, "物語", "Story"), 0x5d3e76, () => actions.startStory(), false, 72).setName("title-story");
  button(scene, titleGroup, 225, 630, 330, 46, tr(lang, "ガチャ", "Gacha"), 0x334c70, () => actions.openGacha()).setName("title-gacha");


  return { titleChrome, titleGroup, titleArt, titleBackdrop, titleHero, titleShade, title, subtitle, titleStatus, titleHint, teamText, opponentButtons, teamButtons };
}

export function renderTitleView(ui: TitleView, model: TitleModel, viewport: { portrait: boolean; width: number; height: number }): void {
  const lang = detectLang();
  const { portrait, width, height } = viewport;
  const extra = portrait ? height - 800 : 0;
  const key = JSON.stringify([lang, viewport, model]);
  if (rendered.get(ui) === key) return;
  ui.titleChrome.clear();
    ui.titleChrome.fillStyle(0x140a08, 0.97).fillRect(0, 0, width, height);
    ui.titleChrome.fillStyle(0x40201a, 0.72).fillRoundedRect(18, 70, width - 36, portrait ? height - 140 : 340, 24);
    if (ui.titleBackdrop) {
      const image = ui.titleBackdrop;
      image.setPosition(width / 2, height / 2).setScale(Math.max(width / image.width, height / image.height));
    }
    if (ui.titleHero) {
      const image = ui.titleHero;
      image.setPosition(portrait ? 348 : 370, portrait ? 143 : 138)
        .setScale((portrait ? 270 : 260) / image.height);
    }
    ui.titleShade.clear().fillStyle(0x140a08, 0.28).fillRect(0, 0, width, height);
    if (portrait) ui.titleShade.fillStyle(0x140a08, 0.72).fillRoundedRect(12, 56, 238, 190, 12);
    else ui.titleShade.fillStyle(0x140a08, 0.72).fillRoundedRect(12, 16, 260, 132, 12);
    ui.titleShade.fillStyle(0x140a08, 0.84).fillRoundedRect(12, portrait ? 252 : 170, portrait ? width - 24 : 432, portrait ? height - 270 : 250, 16);
    if (!portrait) ui.titleShade.fillStyle(0x140a08, 0.84).fillRoundedRect(436, 64, 352, 352, 16);
    ui.titleStatus.setPosition(width / 2, portrait ? 225 : 120);
    ui.titleHint.setPosition(width / 2, portrait ? 476 + extra * 0.25 : 324);
    const team = model.selectedTeam?.length ? model.selectedTeam : (["ryuga"] as FighterId[]);
    ui.titleStatus.setText(`${tr(lang, "豪拳石", "Fist Gems")} ${model.currency} · ${tr(lang, "勝利", "Wins")} ${model.wins}`);
    ui.titleHint.setText(opponentHint(lang, model.opponent ?? "rush"));
    ui.teamText.setPosition(width / 2, portrait ? 512 + extra * 0.32 : 350).setText(`TEAM ${team.length}/3 · ${team.map(id => fighterName(lang, id)).join(" / ")} · ${tr(lang, "先頭が出場", "leader starts")}`);
    ui.opponentButtons.forEach((b, index) => {
      if (portrait) b.setPosition(225, 292 + index * 58 + extra * 0.12);
      b.setAlpha(OPPONENTS[index]?.id === model.opponent ? 1 : 0.62);
    });
    ui.teamButtons.forEach((b, index) => {
      const fighter = FIGHTERS[index];
      if (portrait) b.setPosition(57 + index * 112, 552 + extra * 0.42);
      b.setAlpha(fighter && team.includes(fighter.id) ? 1 : 0.42);
    });
    if (portrait) {
      ui.title.setPosition(130, 96).setFontSize(38);
      ui.subtitle.setPosition(130, lang === "ja" ? 159 : 153).setFontSize(lang === "ja" ? 23 : 16).setWordWrapWidth(210);
      ui.titleStatus.setPosition(130, 224).setFontSize(18);
      (ui.titleGroup.getByName("title-battle") as Phaser.GameObjects.Container | null)?.setPosition(82, 620 + extra * 0.58);
      (ui.titleGroup.getByName("title-series") as Phaser.GameObjects.Container | null)?.setPosition(225, 620 + extra * 0.58);
      (ui.titleGroup.getByName("title-story") as Phaser.GameObjects.Container | null)?.setPosition(368, 620 + extra * 0.58);
      (ui.titleGroup.getByName("title-gacha") as Phaser.GameObjects.Container | null)?.setPosition(225, 692 + extra * 0.72);
    }
    if (!portrait) {
      // Keep the complete title flow reachable after rotating a phone. The
      // legacy 800x600 title is clipped by the 800x450 landscape surface.
      ui.title.setPosition(142, 56).setFontSize(32);
      ui.subtitle.setPosition(142, 104).setFontSize(14).setWordWrapWidth(250);
      ui.titleStatus.setPosition(610, 48).setFontSize(20);
      ui.opponentButtons.forEach((button, index) => button.setPosition(610, 105 + index * 54));
      ui.titleHint.setPosition(610, 276);
      ui.teamText.setPosition(220, 188);
      ui.teamButtons.forEach((button, index) => button.setPosition(52 + index * 112, 230));
      (ui.titleGroup.getByName("title-battle") as Phaser.GameObjects.Container | null)?.setPosition(120, 322);
      (ui.titleGroup.getByName("title-series") as Phaser.GameObjects.Container | null)?.setPosition(260, 322);
      (ui.titleGroup.getByName("title-story") as Phaser.GameObjects.Container | null)?.setPosition(400, 322);
      (ui.titleGroup.getByName("title-gacha") as Phaser.GameObjects.Container | null)?.setPosition(620, 354);
    }

  rendered.set(ui, key);
}

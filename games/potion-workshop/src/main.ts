import Phaser from "phaser";
import { installResponsiveGame } from "../../shared/mobile";
import { initCrazyGames } from "./platform/crazygames";
import { installWallClockPersistence } from "./persistence";
import { installPotionPresentation } from "./presentation";
import { installPotionConceptArtPass } from "./conceptArt";
import { installPotionArtFidelity } from "./artFidelity";
import { installPotionVisualPolish } from "./visualPolish";
import { installPotionMobileLayout } from "./mobileLayout";
import { IdleScene } from "./scenes/IdleScene";

/**
 * Phaser 4.2.1 では Container#setSize() 後に中心基準の Rectangle を
 * setInteractive() へ渡すと、Container の displayOrigin がさらに適用され、
 * ヒット領域が左上へ二重にずれるケースがある。
 *
 * Potion Workshop のカード UI は全て中心基準 (-w/2, -h/2) の Rectangle を
 * 明示しているため、見た目上は右側にある設備カードが左側の錬金術師タップを
 * 奪っていた。Container に限って該当形状を 0..w / 0..h へ正規化し、
 * 描画位置と入力位置を一致させる。
 */
const containerSetInteractive = Phaser.GameObjects.Container.prototype.setInteractive;
Phaser.GameObjects.Container.prototype.setInteractive = function (
  hitArea?: Phaser.Types.Input.InputConfiguration | Phaser.Geom.Rectangle | Phaser.Geom.Circle | Phaser.Geom.Ellipse | Phaser.Geom.Polygon | Phaser.Geom.Triangle,
  hitAreaCallback?: Phaser.Types.Input.HitAreaCallback,
  dropZone?: boolean,
) {
  if (
    hitArea instanceof Phaser.Geom.Rectangle &&
    this.width > 0 &&
    this.height > 0 &&
    Math.abs(hitArea.x + this.width / 2) < 0.001 &&
    Math.abs(hitArea.y + this.height / 2) < 0.001 &&
    Math.abs(hitArea.width - this.width) < 0.001 &&
    Math.abs(hitArea.height - this.height) < 0.001
  ) {
    hitArea = new Phaser.Geom.Rectangle(0, 0, this.width, this.height);
  }
  return containerSetInteractive.call(this, hitArea as never, hitAreaCallback, dropZone);
};

void initCrazyGames();
installPotionPresentation();
installPotionConceptArtPass();
installPotionVisualPolish();
installPotionMobileLayout();
installPotionArtFidelity();
installWallClockPersistence();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 760,
  backgroundColor: "#1a1a2e",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 2,
  },
  scene: [IdleScene],
});

installResponsiveGame(game, {
  baseWidth: 800,
  baseHeight: 760,
  surface: {
    portrait: { width: 450, height: 800 },
    landscape: { width: 800, height: 450 },
  },
});

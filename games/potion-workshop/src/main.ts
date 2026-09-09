import Phaser from "phaser";
import { initCrazyGames } from "./platform/crazygames";
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
 *
 * theme.ts 側の各カード実装を個別に分岐させず、Phaser 4.2.1 固有の互換処理を
 * エントリポイントへ隔離している。Phaser 更新時に削除・再検証しやすい形にする。
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

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();

new Phaser.Game({
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
    activePointers: 2, // マルチタッチ（ピンチ等の誤操作抑止）を許容
  },
  scene: [IdleScene],
});

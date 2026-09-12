import Phaser from "phaser";
import { initCrazyGames } from "./platform/crazygames";
import { installWallClockPersistence } from "./persistence";
import { installPotionPresentation } from "./presentation";
import { IdleScene } from "./scenes/IdleScene";

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();
installPotionPresentation();
installWallClockPersistence();

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

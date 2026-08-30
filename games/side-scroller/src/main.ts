import Phaser from "phaser";
import { initCrazyGames } from "./platform/crazygames";
import { GameScene } from "./scenes/GameScene";
import { LoadoutScene } from "./scenes/LoadoutScene";

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 600,
  backgroundColor: "#aee0ff",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1200 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [LoadoutScene, GameScene],
});

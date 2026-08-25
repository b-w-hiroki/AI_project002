import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { LoadoutScene } from "./scenes/LoadoutScene";

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

import Phaser from "phaser";
import { installResponsiveGame } from "../../shared/mobile";
import { installFistLegendPresentation } from "./presentation";
import { installFistConceptArtPass } from "./conceptArt";
import { installFistArtFidelity } from "./artFidelity";
import { installFistVisualPolish } from "./visualPolish";
import { installFistMobileLayout } from "./mobileLayout";
import { initCrazyGames } from "./platform/crazygames";
import { GameScene } from "./scenes/GameScene";

installFistLegendPresentation();
installFistConceptArtPass();
installFistVisualPolish();
installFistMobileLayout();
installFistArtFidelity();

void initCrazyGames();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 600,
  backgroundColor: "#1a1410",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});

installResponsiveGame(game, { baseWidth: 800, baseHeight: 600 });

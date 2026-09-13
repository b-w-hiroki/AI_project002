import Phaser from "phaser";
import { installResponsiveGame } from "../../shared/mobile";
import { installColorMatchPresentation } from "./presentation";
import { installColorConceptArtPass } from "./conceptArt";
import { installColorArtFidelity } from "./artFidelity";
import { installColorFantasyBackground } from "./fantasyBackground";
import { installColorVisualPolish } from "./visualPolish";
import { installColorMobileLayout } from "./mobileLayout";
import { initCrazyGames } from "./platform/crazygames";
import { GameScene } from "./scenes/GameScene";

installColorMatchPresentation();
installColorConceptArtPass();
installColorVisualPolish();
installColorMobileLayout();
installColorArtFidelity();
installColorFantasyBackground();

void initCrazyGames();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 450,
  height: 800,
  backgroundColor: "#fdf6e3",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});

installResponsiveGame(game, {
  baseWidth: 450,
  baseHeight: 800,
  surface: {
    portrait: { width: 450, height: 800 },
    landscape: { width: 800, height: 450 },
  },
});

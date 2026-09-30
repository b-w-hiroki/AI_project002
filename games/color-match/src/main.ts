import Phaser from "phaser";
import { installLocalTelemetry } from "../../shared/localTelemetry";
import { installResponsiveGame } from "../../shared/mobile";
import { installColorMatchPresentation } from "./presentation";
import { installColorConceptArtPass } from "./conceptArt";
import { installColorFantasyBackground } from "./fantasyBackground";
import { installColorMobileLayout } from "./mobileLayout";
import { installColorScreenMock } from "./screenMock";
import { initCrazyGames } from "./platform/crazygames";
import { GameScene } from "./scenes/GameScene";

installColorMatchPresentation();
installColorConceptArtPass();
installColorMobileLayout();
installColorScreenMock();
installColorFantasyBackground();

await initCrazyGames();
installLocalTelemetry("color-match");

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

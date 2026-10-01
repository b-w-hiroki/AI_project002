import Phaser from "phaser";
import { installLocalTelemetry } from "../../shared/localTelemetry";
import { installResponsiveGame } from "../../shared/mobile";
import { installFistLegendPresentation } from "./presentation";
import { installFistConceptArtPass } from "./conceptArt";
import { installFistArtFidelity } from "./artFidelity";
import { installFistVisualPolish } from "./visualPolish";
import { installFistMobileLayout } from "./mobileLayout";
import { installFistHajaMode } from "./hajaMode";
import { initCrazyGames } from "./platform/crazygames";
import { GameScene } from "./scenes/GameScene";

installFistLegendPresentation();
installFistConceptArtPass();
installFistMobileLayout();
installFistHajaMode();
installFistArtFidelity();
installFistVisualPolish();

await initCrazyGames();
installLocalTelemetry("fist-legend");

// WebKit can lose the WebGL back buffer when the viewport rotates between the
// portrait and landscape canvas sizes. Canvas keeps the battle visible there;
// Chromium-family browsers retain the normal AUTO renderer.
const webKitCanvasFallback = /AppleWebKit/i.test(navigator.userAgent)
  && !/(Chrome|Chromium|CriOS|Edg|OPR)/i.test(navigator.userAgent);

const game = new Phaser.Game({
  type: webKitCanvasFallback ? Phaser.CANVAS : Phaser.AUTO,
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

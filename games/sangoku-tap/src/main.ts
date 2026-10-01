import { ExpeditionScene } from "./scenes/ExpeditionScene";
import { installLocalTelemetry } from "../../shared/localTelemetry";
import Phaser from "phaser";
import { installResponsiveGame } from "../../shared/mobile";
import { initCrazyGames } from "./platform/crazygames";
import { installSangokuPresentation } from "./presentation";
import { installSangokuArtFidelity } from "./artFidelity";
import { installSangokuVisualPolish } from "./visualPolish";
import { installSangokuMobileLayout } from "./mobileLayout";
import { GameScene } from "./scenes/GameScene";

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
await initCrazyGames();
installLocalTelemetry("sangoku-tap");
installSangokuPresentation();
installSangokuArtFidelity();
installSangokuVisualPolish();
installSangokuMobileLayout();

// Safari/WebKit can lose the WebGL back buffer while switching between the
// portrait and landscape canvas sizes. Canvas keeps the campaign operable;
// Chromium-family browsers keep the normal AUTO renderer.
const webKitCanvasFallback = /AppleWebKit/i.test(navigator.userAgent)
  && !/(Chrome|Chromium|CriOS|Edg|OPR)/i.test(navigator.userAgent);

const game = new Phaser.Game({
  type: webKitCanvasFallback ? Phaser.CANVAS : Phaser.AUTO,
  parent: "game",
  width: 450,
  height: 800,
  backgroundColor: "#2a1a14",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene, ExpeditionScene],
});

installResponsiveGame(game, { baseWidth: 450, baseHeight: 800 });

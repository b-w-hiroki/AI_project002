import Phaser from "phaser";
import { installLocalTelemetry } from "../../shared/localTelemetry";
import { installResponsiveGame } from "../../shared/mobile";
import { initCrazyGames } from "./platform/crazygames";
import { installSideScrollerPresentation } from "./presentation";
import { installSideConceptArtPass } from "./conceptArt";
import { installSideArtFidelity } from "./artFidelity";
import { installSideMobileLayout } from "./mobileLayout";
import { installSideMobileScenePolish } from "./mobileScenePolish";
import { installSideMockBattleView } from "./mockBattleView";
import { GameScene } from "./scenes/GameScene";
import { LoadoutScene } from "./scenes/LoadoutScene";

await initCrazyGames();
installLocalTelemetry("side-scroller");
const useLegacyView = new URLSearchParams(window.location.search).get("legacyView") === "1"
  || window.localStorage.getItem("side-scroller:legacy-view") === "1";

if (useLegacyView) {
  installSideScrollerPresentation();
  installSideConceptArtPass();
  installSideMobileLayout();
  installSideArtFidelity();
  installSideMobileScenePolish();
} else {
  installSideMockBattleView();
}

const game = new Phaser.Game({
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

installResponsiveGame(game, { baseWidth: 800, baseHeight: 600 });

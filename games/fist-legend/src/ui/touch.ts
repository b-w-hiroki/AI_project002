import Phaser from "phaser";

/** このセッションがタッチデバイスかどうか（PC版の見た目は変えないための判定） */
export function isTouchDevice(scene: Phaser.Scene): boolean {
  return scene.sys.game.device.input.touch;
}

/**
 * 縦向きでは操作しづらいため、横向きを促す全画面オーバーレイを出す。
 * `side-scroller`と同じ実装パターン（タッチデバイス限定、resizeイベントで再判定）。
 */
export function buildOrientationWarning(scene: Phaser.Scene): void {
  const check = () => {
    const portrait = window.innerHeight > window.innerWidth;
    overlay.setVisible(portrait);
  };
  const overlay = scene.add.container(0, 0).setScrollFactor(0).setDepth(200).setVisible(false);
  const bg = scene.add.rectangle(400, 300, 800, 600, 0x0a0a0a, 0.96);
  const text = scene.add
    .text(400, 300, "横向きにしてください\nRotate your device to landscape", {
      fontSize: "20px",
      color: "#f5ead2",
      align: "center",
      lineSpacing: 10,
    })
    .setOrigin(0.5);
  overlay.add([bg, text]);
  check();
  window.addEventListener("resize", check);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener("resize", check));
}

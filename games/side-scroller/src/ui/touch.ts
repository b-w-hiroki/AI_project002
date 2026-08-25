import Phaser from "phaser";

/**
 * 推奨タップ判定サイズ（Apple/Google のガイドライン目安）。
 * ボタン単体（スロット、開始ボタン等）にはこの値をそのまま使う。
 * 密なリスト行（所持武器一覧、鍛治/防具の選択肢など）は行間が20px前後しかなく
 * 44pxを強制すると隣の行と重なって誤タップの原因になるため、
 * makeTappable では強制せず、呼び出し側が状況に応じたサイズを明示的に指定する。
 * リスト行では「高さは行間ぎりぎりまで、横幅は画面端まで広げる」方針で妥協する。
 */
export const RECOMMENDED_TAP_SIZE = 44;

/** このセッションがタッチデバイスかどうか（PC版の見た目は変えないための判定） */
export function isTouchDevice(scene: Phaser.Scene): boolean {
  return scene.sys.game.device.input.touch;
}

/**
 * 見えている要素（テキストなど）より広い当たり判定でタップを受け付ける透明ゾーンを重ねる。
 * LoadoutScene の各行やオーバーレイのボタン、TIPS背景の閉じるタップ等、
 * 「見た目は既存のまま、タップ判定だけ広げたい」箇所すべてに共通で使う。
 */
export function makeTappable(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  onTap: () => void,
): Phaser.GameObjects.Zone {
  const zone = scene.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
  zone.on("pointerdown", onTap);
  return zone;
}

/**
 * onDown/onUp に渡す最小限のダミーイベント（Key.onDown/onUp が実際に参照するフィールドのみ）。
 * 型定義上は完全な KeyboardEvent が要求されるが、Phaser のランタイム実装は
 * altKey/ctrlKey/shiftKey/metaKey/location/timeStamp しか読まないため安全にキャストする。
 */
export function fakeKeyEvent(scene: Phaser.Scene): KeyboardEvent {
  return {
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    location: 0,
    timeStamp: scene.time.now,
  } as KeyboardEvent;
}

export interface TouchButtonOptions {
  radius?: number;
  color?: number;
  alpha?: number;
  fontSize?: string;
}

/**
 * 押している間 isDown、離すと isUp になる「押しっぱなし対応」の仮想ボタン。
 * Phaser の Key#onDown/onUp は実際のキーボードイベント受信時に呼ばれるのと同じ処理
 * （isDown/_justDown のセット）を行う公開メソッドなので、これを直接呼ぶだけで
 * cursors.left.isDown や JustDown(attackKey) など既存の判定ロジックを一切変更せずに
 * タッチ入力を統合できる。
 */
export function bindHeldKey(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  key: Phaser.Input.Keyboard.Key,
  options: TouchButtonOptions = {},
): void {
  const radius = Math.max(22, options.radius ?? 30);
  const btn = scene.add
    .circle(x, y, radius, options.color ?? 0x2a2a4a, options.alpha ?? 0.55)
    .setScrollFactor(0)
    .setDepth(90)
    .setStrokeStyle(1, 0x54547a)
    .setInteractive();
  scene.add
    .text(x, y, label, { fontSize: options.fontSize ?? "16px", color: "#e8e8fb" })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(91);

  // Key#onUp は isDown/_justDown を無条件でリセットする。タップ操作は touchstart→touchend が
  // 同一フレーム内（Phaserの入力処理はScene#updateより前のPRE_STEPで走る）で処理されることがあり、
  // その場合 scene.update() が JustDown を読む前に onUp が _justDown を false に戻してしまい、
  // 瞬間タップの入力が消えてしまう。
  // scene.time.delayedCall(0, ...) は Phaser の Clock 更新も同じフレームの Scene#update より
  // 前に走るため対策にならない（同一フレーム内で発火してしまう）。ブラウザ標準の
  // requestAnimationFrame は「次の描画フレーム」＝今フレームの Scene#update 完了後まで
  // 確実に遅延するため、これで onUp を遅延させる。
  const deferredUp = () => requestAnimationFrame(() => key.onUp(fakeKeyEvent(scene)));
  btn.on("pointerdown", () => key.onDown(fakeKeyEvent(scene)));
  btn.on("pointerup", deferredUp);
  // 指がボタン外に流れた場合も離した扱いにする（押しっぱなし状態が固着するのを防ぐ）
  btn.on("pointerout", deferredUp);
}

/**
 * 縦向きでは操作しづらいため、横向きを促す全画面オーバーレイを出す。
 * タッチデバイス判定を行った上で LoadoutScene・GameScene の両方から呼ぶ想定
 * （どちらか片方だけだと画面をまたいだ時に警告が消えてしまうため）。
 */
export function buildOrientationWarning(scene: Phaser.Scene): void {
  const check = () => {
    const portrait = window.innerHeight > window.innerWidth;
    overlay.setVisible(portrait);
  };
  const overlay = scene.add.container(0, 0).setScrollFactor(0).setDepth(200).setVisible(false);
  const bg = scene.add.rectangle(400, 300, 800, 600, 0x0a0a12, 0.96);
  const text = scene.add
    .text(400, 300, "📱 横向きにしてください\nRotate your device to landscape", {
      fontSize: "20px",
      color: "#e8e8fb",
      align: "center",
      lineSpacing: 10,
    })
    .setOrigin(0.5);
  overlay.add([bg, text]);
  check();
  window.addEventListener("resize", check);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener("resize", check));
}

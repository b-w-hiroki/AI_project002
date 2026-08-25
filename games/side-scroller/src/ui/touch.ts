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

export interface JoystickKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
}

export interface JoystickOptions {
  maxRadius?: number;
  deadzone?: number;
}

/**
 * 「今風」の動的仮想スティック。常時表示のD-padボタンではなく、
 * 指定ゾーン内をタッチした瞬間にそこを中心として現れ、指の動きに追従し、
 * 離すと消える（Fortnite Mobile 等のモバイルアクションゲームで一般的な方式）。
 * bindHeldKey と同じく、既存の Key オブジェクトへ onDown/onUp を橋渡しするだけなので
 * handleMovement 等の既存ロジックは無変更で流用できる。
 */
export function bindVirtualJoystick(
  scene: Phaser.Scene,
  zoneRect: { x: number; y: number; width: number; height: number },
  keys: JoystickKeys,
  options: JoystickOptions = {},
): void {
  const maxRadius = options.maxRadius ?? 52;
  const deadzone = options.deadzone ?? 14;

  const base = scene.add
    .circle(0, 0, maxRadius, 0xffffff, 0.12)
    .setStrokeStyle(2, 0xffffff, 0.25)
    .setScrollFactor(0)
    .setDepth(85)
    .setVisible(false);
  const thumb = scene.add
    .circle(0, 0, maxRadius * 0.45, 0xffffff, 0.3)
    .setScrollFactor(0)
    .setDepth(86)
    .setVisible(false);

  let origin: { x: number; y: number } | null = null;
  let pointerId: number | null = null;
  const pressed: Record<keyof JoystickKeys, boolean> = { left: false, right: false, up: false, down: false };

  const setPressed = (dir: keyof JoystickKeys, want: boolean) => {
    if (pressed[dir] === want) return;
    pressed[dir] = want;
    const key = keys[dir];
    if (want) {
      key.onDown(fakeKeyEvent(scene));
    } else {
      // bindHeldKey と同じ理由（同一フレーム内での JustDown 消失防止）で次フレームへ遅延
      requestAnimationFrame(() => key.onUp(fakeKeyEvent(scene)));
    }
  };

  const releaseAll = () => {
    (Object.keys(pressed) as (keyof JoystickKeys)[]).forEach((dir) => setPressed(dir, false));
    origin = null;
    pointerId = null;
    base.setVisible(false);
    thumb.setVisible(false);
  };

  const inputZone = scene.add
    .zone(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setInteractive();

  inputZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    origin = { x: pointer.x, y: pointer.y };
    pointerId = pointer.id;
    base.setPosition(origin.x, origin.y).setVisible(true);
    thumb.setPosition(origin.x, origin.y).setVisible(true);
  });

  scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
    if (!origin || pointer.id !== pointerId) return;
    const dx = pointer.x - origin.x;
    const dy = pointer.y - origin.y;
    const mag = Math.hypot(dx, dy);
    const clamped = Math.min(maxRadius, mag);
    const angle = Math.atan2(dy, dx);
    thumb.setPosition(origin.x + Math.cos(angle) * clamped, origin.y + Math.sin(angle) * clamped);

    if (mag < deadzone) {
      setPressed("left", false);
      setPressed("right", false);
      setPressed("up", false);
      setPressed("down", false);
      return;
    }
    setPressed("left", dx < -deadzone);
    setPressed("right", dx > deadzone);
    setPressed("up", dy < -deadzone);
    setPressed("down", dy > deadzone);
  });

  scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    if (pointer.id === pointerId) releaseAll();
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, releaseAll);
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

import type { GameState } from "./logic/economy";
import { save } from "./logic/save";
import { IdleScene } from "./scenes/IdleScene";

const WALL_CLOCK_SAVE_INTERVAL_MS = 5_000;

type PersistableScene = IdleScene & { state: GameState };

/**
 * IdleScene の既存オートセーブは Phaser の frame delta 累積を使うため、
 * ソフトウェア描画・省電力・バックグラウンド復帰など極端に低FPSの環境では
 * 「実時間5秒」とゲーム時間5秒が大きくずれることがある。
 *
 * 経済 tick や演出速度には一切触れず、保存だけ Date.now() 基準の安全網を追加する。
 * 通常環境では既存セーブと近いタイミングで重複する可能性があるが、同じ state を
 * localStorage に上書きするだけなのでゲーム状態や報酬計算には影響しない。
 */
export function installWallClockPersistence(): void {
  const originalUpdate = IdleScene.prototype.update;
  const lastSavedAt = new WeakMap<IdleScene, number>();

  IdleScene.prototype.update = function (time: number, delta: number): void {
    originalUpdate.call(this, time, delta);

    const now = Date.now();
    const previous = lastSavedAt.get(this);
    if (previous === undefined) {
      lastSavedAt.set(this, now);
      return;
    }
    if (now - previous < WALL_CLOCK_SAVE_INTERVAL_MS) return;

    const state = (this as PersistableScene).state;
    save(state, localStorage, now);
    lastSavedAt.set(this, now);
  };
}

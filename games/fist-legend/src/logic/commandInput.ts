/**
 * 格闘ゲーム風の固定コマンド入力認識（Phaser非依存の純粋関数）。
 * 企画書にあった「拳→拳→拳→気」のような技の入力順で隠しコマンド技を出せる
 * アイデアを、ボタン入力の履歴バッファとシーケンス一致判定として実装する。
 * side-scroller の commandInput.ts と同じ設計方針（バッファ＋末尾一致判定）を踏襲。
 */

import { MoveType } from "./battle";

export interface MoveEvent {
  move: MoveType;
  time: number;
}

/** この時間より前の入力はコマンド判定の対象から外す（溜め込み防止） */
export const COMMAND_BUFFER_WINDOW_MS = 3000;
/** シーケンス内の各入力間がこの時間を超えて空くと不成立にする */
export const COMMAND_TOKEN_GAP_MS = 1200;

/** 隠しコマンド技: 拳→拳→拳→気（企画書の「連撃からの気弾」を想定） */
export const HIDDEN_COMMAND: readonly MoveType[] = ["punch", "punch", "punch", "ki"];

/** 入力バッファに新しい手を積む。古い入力は同時に間引く */
export function pushMoveEvent(buffer: readonly MoveEvent[], move: MoveType, time: number): MoveEvent[] {
  const trimmed = buffer.filter((e) => time - e.time <= COMMAND_BUFFER_WINDOW_MS);
  return [...trimmed, { move, time }];
}

/**
 * バッファの末尾が sequence と一致するか判定する。
 * 各入力間の間隔が COMMAND_TOKEN_GAP_MS 以内であることも要求する
 * （ゆっくり別々に押しただけの偶然の一致を弾くため）。
 */
export function matchesSequence(buffer: readonly MoveEvent[], sequence: readonly MoveType[]): boolean {
  if (buffer.length < sequence.length) return false;
  const tail = buffer.slice(buffer.length - sequence.length);
  for (let i = 0; i < sequence.length; i++) {
    if (tail[i]!.move !== sequence[i]) return false;
  }
  for (let i = 1; i < tail.length; i++) {
    if (tail[i]!.time - tail[i - 1]!.time > COMMAND_TOKEN_GAP_MS) return false;
  }
  return true;
}

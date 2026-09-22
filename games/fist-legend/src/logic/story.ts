import type { Opponent } from "./opponent";

export interface StoryChapter {
  id: string;
  title: string;
  opponent: Opponent;
  intro: string;
  clearText: string;
}

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  {
    id: "dojo_breaker",
    title: "第一章・道場破り",
    opponent: "rush",
    intro: "王都に現れた猛攻の拳士。まずは正面から、その勢いを止めろ。",
    clearText: "猛攻を制し、次なる使い手への道が開いた。",
  },
  {
    id: "counter_master",
    title: "第二章・静水の反撃",
    opponent: "counter",
    intro: "攻めるほど返される反撃の達人。間を読み、先に崩せ。",
    clearText: "静かな反撃を越え、頂への最後の門が姿を現した。",
  },
  {
    id: "ki_grandmaster",
    title: "最終章・天衝の気",
    opponent: "charge",
    intro: "闘技場の頂に待つ気功宗師。三つの型を使い切り、決着をつけろ。",
    clearText: "三人の強敵を越え、覇拳の物語を完遂した。",
  },
] as const;

export function storyChapterAt(index: number): StoryChapter {
  return STORY_CHAPTERS[Math.max(0, Math.min(STORY_CHAPTERS.length - 1, Math.floor(index)))]!;
}

export function storyStartIndex(cleared: number): number {
  return cleared >= STORY_CHAPTERS.length ? 0 : Math.max(0, Math.floor(cleared));
}

// 一局游戏的全部状态。物理引擎每帧都在变，这里用一个可变对象集中管理，各模块只读写这一处。
import { FIELD, STORAGE_KEYS } from './config.js?v=70a9d4eb';
import { store } from './skin.js?v=b3832cb8';

export const state = {
  engine: null,
  score: 0,
  best: Number(store.get(STORAGE_KEYS.best)) || 0,
  topLevel: 0,
  current: 0,
  next: 0,
  currentShiny: false,
  nextShiny: false,
  shinySeen: 0,
  aimX: FIELD.width / 2,
  canDrop: true,
  over: false,
  paused: false,
  wonThisGame: false,
  dangerSince: 0,
  // 本局统计（战报用）
  mergeCount: 0,
  maxCombo: 0,
  startedAt: Date.now(),
  // 连击
  combo: 0,
  lastMergeAt: 0
};

export function resetRound(engine, firstNext) {
  Object.assign(state, {
    engine,
    score: 0, topLevel: 0, current: 0, next: firstNext, currentShiny: false, nextShiny: false, shinySeen: 0,
    aimX: FIELD.width / 2, canDrop: true, over: false, paused: false, wonThisGame: false,
    dangerSince: 0, mergeCount: 0, maxCombo: 0, startedAt: Date.now(), combo: 0, lastMergeAt: 0
  });
}

export function addScore(gain) {
  state.score += gain;
  if (state.score > state.best) {
    state.best = state.score;
    store.set(STORAGE_KEYS.best, String(state.best));
  }
}

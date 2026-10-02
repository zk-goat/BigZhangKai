// 游戏本体：物理世界、投放、合成、判负、主循环、画面适配和输入。
import { LEVELS, MAX, FIELD, PHYSICS, RULES, COLORS } from './config.js';
import { skin, shapeFor, halfWidth } from './skin.js';
import { popScale } from './geometry.js';
import { drawKai } from './draw.js';
import { sfx, unlockAudio } from './audio.js';
import { state, resetRound, addScore } from './state.js';
import { resetEffects, mergeEffects, applyShake, drawEffects } from './effects.js';
import { showWin, gameOver } from './report.js';

const { Engine, Bodies, Composite, Events, Body } = Matter;
const W = FIELD.width, H = FIELD.height;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const isKai = b => b.kaiLevel !== undefined;
const kaiBodies = () => Composite.allBodies(state.engine.world).filter(isKai);

// ---------- 物理世界 ----------
function newEngine() {
  const e = Engine.create({ gravity: { y: PHYSICS.gravity } });
  const wall = { isStatic: true, ...PHYSICS.wall };
  Composite.add(e.world, [
    Bodies.rectangle(W / 2, H + 30, W * 2, 60, wall),
    Bodies.rectangle(-30, H / 2, 60, H * 3, wall),
    Bodies.rectangle(W + 30, H / 2, 60, H * 3, wall)
  ]);
  Events.on(e, 'beforeUpdate', standUp);
  Events.on(e, 'collisionStart', onCollide);
  Events.on(e, 'collisionActive', onCollide);
  return e;
}

// 不倒翁：照片张楷被撞歪后慢慢立回来；被压住时不硬掰
function standUp() {
  kaiBodies().filter(b => b.kaiShaped).forEach(b => {
    const tilt = Math.atan2(Math.sin(b.angle), Math.cos(b.angle));
    Body.setAngularVelocity(b, b.angularVelocity * PHYSICS.uprightDamp - tilt * PHYSICS.uprightK);
  });
}

export function makeKai(x, y, lv) {
  const shape = shapeFor(lv);
  const b = shape
    ? Bodies.fromVertices(x, y, [shape.verts], PHYSICS.body)
    : Bodies.circle(x, y, LEVELS[lv].r, PHYSICS.body);
  Object.assign(b, { kaiLevel: lv, kaiShaped: !!shape, bornAt: performance.now(), merged: false });
  Composite.add(state.engine.world, b);
  return b;
}

// ---------- 合成 ----------
function onCollide(ev) {
  ev.pairs.forEach(({ bodyA: a, bodyB: b }) => {
    if (isKai(a) && isKai(b) && !a.merged && !b.merged && a.kaiLevel === b.kaiLevel && a.kaiLevel < MAX) mergePair(a, b);
  });
}

// 照片轮廓不规则，光靠碰撞常差一条缝：同级重心够近也算碰到
function mergeNearby() {
  const bodies = kaiBodies().filter(b => !b.merged && b.kaiLevel < MAX);
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (a.merged || b.merged || a.kaiLevel !== b.kaiLevel) continue;
      const reach = LEVELS[a.kaiLevel].r * RULES.mergeReach;
      const dx = a.position.x - b.position.x, dy = a.position.y - b.position.y;
      if (dx * dx + dy * dy < reach * reach) mergePair(a, b);
    }
  }
}

function mergePair(a, b) {
  const lv = a.kaiLevel + 1, now = performance.now();
  a.merged = b.merged = true;
  const x = (a.position.x + b.position.x) / 2, y = (a.position.y + b.position.y) / 2;
  Composite.remove(state.engine.world, [a, b]);
  const nb = makeKai(x, y, lv);
  nb.popAt = now;
  Body.setVelocity(nb, { x: 0, y: -1.5 });

  state.combo = now - state.lastMergeAt < RULES.comboWindowMs ? state.combo + 1 : 1;
  state.lastMergeAt = now;
  state.mergeCount += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.topLevel = Math.max(state.topLevel, lv);
  const gain = lv * 2 + (state.combo >= 2 ? (state.combo - 1) * lv : 0) + (lv === MAX ? RULES.winBonus : 0);
  addScore(gain);
  mergeEffects({ x, y, lv, gain, combo: state.combo, now });

  if (lv === MAX && !state.wonThisGame) showWin();
  else sfx.merge(lv, state.combo);
  updateHud();
}

// ---------- 投放与判负 ----------
const randLevel = () => Math.floor(Math.random() * (Math.min(RULES.spawnMaxLevel, Math.max(2, state.topLevel - 1)) + 1));

function clampAim(lv) {
  const half = halfWidth(lv);
  return Math.min(W - half, Math.max(half, state.aimX));
}

let cooldownTimer = 0;

export function drop() {
  const overlayOpen = document.querySelector('.overlay:not([hidden])');
  if (!state.engine || !state.canDrop || state.over || state.paused || overlayOpen) return;
  makeKai(clampAim(state.current), FIELD.dropY, state.current);
  sfx.drop();
  state.current = state.next;
  state.next = randLevel();
  state.canDrop = false;
  clearTimeout(cooldownTimer);
  cooldownTimer = setTimeout(() => { state.canDrop = true; }, RULES.dropCooldownMs);
}

function checkDanger(now) {
  const risky = kaiBodies().some(b =>
    now - b.bornAt > RULES.dangerGraceMs && b.bounds.min.y < FIELD.dangerY && Math.abs(b.velocity.y) < 1.2);
  if (!risky) { state.dangerSince = 0; return; }
  if (!state.dangerSince) state.dangerSince = now;
  if (now - state.dangerSince > RULES.dangerHoldMs) gameOver();
}

// 测试用：当前所有张楷的位置与等级（只在 ?debug 时挂到 window 上）
export function debugSnapshot() {
  return {
    over: state.over, paused: state.paused, score: state.score, topLevel: state.topLevel,
    bodies: kaiBodies().map(b => ({
      lv: b.kaiLevel, x: b.position.x, y: b.position.y,
      minX: b.bounds.min.x, maxX: b.bounds.max.x, maxY: b.bounds.max.y, vy: b.velocity.y
    }))
  };
}

// ---------- 界面 ----------
export function updateHud() {
  document.getElementById('score').textContent = state.score;
  document.getElementById('best').textContent = state.best;
  document.getElementById('ladder').replaceChildren(...skin.map((s, i) => {
    const sp = document.createElement('span');
    sp.textContent = (i ? '→ ' : '') + s.name;
    if (i <= state.topLevel) sp.className = 'on';
    return sp;
  }));
}

export function startGame() {
  clearTimeout(cooldownTimer);
  resetRound(newEngine(), 0);
  state.next = randLevel();
  resetEffects();
  document.getElementById('win').hidden = true;
  document.getElementById('over').hidden = true;
  updateHud();
}

// ---------- 渲染 ----------
let viewScale = 1;

function draw(now) {
  // 部分安卓/微信切后台后会重置画布状态（缩放丢失→画面缩在左上角），每帧重设
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  applyShake(ctx, now);

  const warn = state.dangerSince
    ? (Math.sin(now / 80) > 0 ? COLORS.accent : 'rgba(226,73,47,.3)')
    : 'rgba(59,42,20,.25)';
  ctx.setLineDash([8, 6]); ctx.strokeStyle = warn; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, FIELD.dangerY); ctx.lineTo(W, FIELD.dangerY); ctx.stroke();
  ctx.setLineDash([]);

  if (!state.over) {
    const x = clampAim(state.current);
    ctx.strokeStyle = 'rgba(59,42,20,.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, FIELD.dropY); ctx.lineTo(x, H); ctx.stroke();
    if (state.canDrop) drawKai(ctx, x, FIELD.dropY, LEVELS[state.current].r, state.current);
  }
  ctx.font = '13px sans-serif'; ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText('下一个', W - 40, 24);
  drawKai(ctx, W - 20, 24, 13, state.next);

  kaiBodies().forEach(b => {
    const pop = b.popAt ? popScale(now - b.popAt) : 1;
    drawKai(ctx, b.position.x, b.position.y, LEVELS[b.kaiLevel].r * pop, b.kaiLevel, b.angle);
  });
  drawEffects(ctx, now);
}

// 固定步长：手机掉帧时补算几步，而不是一步跨太大导致抖动穿模
let last = performance.now(), acc = 0;
export function loop(now) {
  acc = Math.min(acc + (now - last), PHYSICS.stepMs * PHYSICS.maxCatchUpSteps);
  last = now;
  if (!state.over && !state.paused) {
    // 合出大张楷（暂停）或判负后，本帧剩下的补算和判负检查都跳过
    while (acc >= PHYSICS.stepMs && !state.over && !state.paused) {
      Engine.update(state.engine, PHYSICS.stepMs);
      mergeNearby();
      acc -= PHYSICS.stepMs;
    }
    if (!state.over && !state.paused) checkDanger(now);
  } else {
    acc = 0;
    state.dangerSince = 0;  // 暂停期间不计越线时间，恢复后重新数 2 秒
  }
  draw(now);
  requestAnimationFrame(loop);
}

// 先让舞台撑满剩余空间量出可用尺寸，再收紧到画布高度，让顶栏/画布/进度条整体居中
export function fit() {
  const stage = canvas.parentElement;
  stage.style.flex = ''; stage.style.height = '';
  const scale = Math.min(stage.clientWidth / W, (stage.clientHeight - 6) / H);
  // 像素密度封顶 2：3 倍屏肉眼看不出差别，画布却大一倍多，更容易被手机回收重置
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
  canvas.width = W * scale * dpr;
  canvas.height = H * scale * dpr;
  viewScale = scale * dpr;
  stage.style.flex = '0 0 auto';
  stage.style.height = H * scale + 6 + 'px';
}

export function bindInput() {
  const toGameX = e => {
    const rect = canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * W;
  };
  let pressing = false;
  canvas.addEventListener('pointerdown', e => { unlockAudio(); pressing = true; state.aimX = toGameX(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { state.aimX = toGameX(e); });
  canvas.addEventListener('pointerup', e => { if (pressing) { state.aimX = toGameX(e); drop(); } pressing = false; });
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') state.aimX = Math.max(0, state.aimX - 16);
    else if (e.key === 'ArrowRight') state.aimX = Math.min(W, state.aimX + 16);
    else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement === document.body) { e.preventDefault(); drop(); }
  });
  window.addEventListener('resize', fit);
  canvas.addEventListener('contextrestored', fit);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { state.dangerSince = 0; fit(); }
  });
}

// 启动：加载照片 → 开局 → 绑定按钮。链接带 ?test=win / ?test=over 时直接展示庆祝画面 / 示例战报。
import { FIELD, MAX } from './config.js';
import { initSkin } from './skin.js';
import { isMuted, toggleMuted } from './audio.js';
import { state } from './state.js';
import { copyShare, gameOver } from './report.js';
import { startGame, loop, fit, bindInput, makeKai, updateHud } from './game.js';
import { bindSettings } from './settings.js';
import { $ } from './dom.js';

function renderSoundBtn() {
  const muted = isMuted();
  $('btn-sound').textContent = muted ? '开声音' : '静音';
  $('btn-sound').setAttribute('aria-pressed', String(!muted));
}

function bindButtons() {
  $('btn-restart').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', startGame);
  $('btn-copy').addEventListener('click', copyShare);
  $('btn-continue').addEventListener('click', () => { $('win').hidden = true; state.paused = false; });
  $('btn-sound').addEventListener('click', () => { toggleMuted(); renderSoundBtn(); });
  bindSettings({ onRename: updateHud, onChanged: startGame });
  renderSoundBtn();
}

function runTestHooks() {
  const q = location.search;
  if (/[?&]test=win/.test(q)) {
    makeKai(FIELD.width / 2 - 60, 250, MAX - 1);
    makeKai(FIELD.width / 2 + 60, 250, MAX - 1);
  }
  if (/[?&]test=over/.test(q)) {
    setTimeout(() => {
      Object.assign(state, { topLevel: 8, score: 1234, mergeCount: 57, maxCombo: 4, startedAt: Date.now() - 263000 });
      gameOver();
    }, 800);
  }
}

async function boot() {
  fit();
  bindInput();
  bindButtons();
  await initSkin();
  startGame();
  requestAnimationFrame(loop);
  runTestHooks();
  if (document.fonts) document.fonts.ready.then(fit);
}

boot();

// 启动：加载照片 → 开局 → 绑定按钮。链接带 ?test=win / ?test=over（可加 &score=分数）时直接展示庆祝画面 / 示例战报。
import { FIELD, MAX } from './config.js?v=cc9230d0';
import { initSkin } from './skin.js?v=4723788e';
import { isMuted, toggleMuted } from './audio.js?v=d5a3af5f';
import { state } from './state.js?v=0eefd06e';
import { copyShare, gameOver } from './report.js?v=bcbcbabb';
import { startGame, restoreGame, loop, fit, bindInput, makeKai, debugSnapshot, simulateGames } from './game.js?v=1d7a0e37';
import { readSave } from './save.js?v=510d9fb7';
import { bindRankboard, flushPending } from './rankboard.js?v=399b1081';
import { bindWelcome, showWelcomeIfNeeded, needsWelcome } from './welcome.js?v=321c9d9e';
import { bindNotice, showNoticeIfNew } from './notice.js?v=f8349fbe';
import { bindGuestbook } from './guestbook.js?v=427f52ce';
import { syncMyAvatar } from './profile.js?v=bc3b2c02';
import { $ } from './dom.js?v=5b57db68';

function renderSoundBtn() {
  const muted = isMuted();
  $('btn-sound').textContent = muted ? '开声' : '静音';
  $('btn-sound').setAttribute('aria-pressed', String(!muted));
}

const TOAST_MS = 5000;
let toastTimer = 0;

function showToast(text) {
  $('toast-text').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, TOAST_MS);
}

function bindButtons() {
  $('btn-toast-restart').addEventListener('click', () => { $('toast').hidden = true; startGame(); });
  $('btn-restart').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', startGame);
  $('btn-copy').addEventListener('click', copyShare);
  $('btn-continue').addEventListener('click', () => { $('win').hidden = true; state.paused = false; });
  $('btn-sound').addEventListener('click', () => { toggleMuted(); renderSoundBtn(); });
  bindRankboard();
  bindWelcome();
  bindNotice();
  bindGuestbook();
  renderSoundBtn();
}

function runTestHooks() {
  const q = location.search;
  if (/[?&]debug/.test(q)) Object.assign(window, { zkDebug: debugSnapshot, zkSim: simulateGames, zkSpawn: makeKai });
  if (/[?&]test=win/.test(q)) {
    makeKai(FIELD.width / 2 - 60, 250, MAX - 1);
    makeKai(FIELD.width / 2 + 60, 250, MAX - 1);
  }
  // ?test=shiny：放几个闪光张楷，并让手上这个也是闪光，直接看效果
  if (/[?&]test=shiny/.test(q)) {
    [2, 5, 8, 11].forEach((lv, i) => makeKai(60 + i * 95, 300, lv, true));
    state.currentShiny = true;
  }
  if (/[?&]test=over/.test(q)) {
    setTimeout(() => {
      const score = Number((q.match(/[?&]score=(\d+)/) || [])[1]) || 1234;
      Object.assign(state, { topLevel: 8, score, mergeCount: 57, maxCombo: 4, startedAt: Date.now() - 263000 });
      gameOver();
    }, 800);
  }
}

async function boot() {
  fit();
  bindInput();
  bindButtons();
  await initSkin();
  // 有上一局的存档就接着玩（测试链接不恢复，免得干扰）
  const saved = /[?&]test=/.test(location.search) ? null : readSave();
  if (saved) {
    restoreGame(saved);
    showToast(`已恢复上一局（${saved.state.score} 分）`);
  } else {
    startGame();
  }
  if (!/[?&]test=/.test(location.search)) {
    const isNewPlayer = needsWelcome();
    showWelcomeIfNeeded();
    showNoticeIfNew({ isNewPlayer });
  }
  requestAnimationFrame(loop);
  runTestHooks();
  flushPending();
  syncMyAvatar();
  if (document.fonts) document.fonts.ready.then(fit);
}

boot();

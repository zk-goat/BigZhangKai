// 启动：加载照片 → 开局 → 绑定按钮。链接带 ?test=win / ?test=over（可加 &score=分数）时直接展示庆祝画面 / 示例战报。
import { FIELD, MAX } from './config.js?v=21648a52';
import { initSkin } from './skin.js?v=83f93ead';
import { initCrown } from './draw.js?v=dc853b14';
import { isMuted, toggleMuted } from './audio.js?v=b9710e55';
import { state } from './state.js?v=5f7e2107';
import { copyShare, gameOver } from './report.js?v=a0e11c60';
import { startGame, restoreGame, loop, fit, bindInput, makeKai, debugSnapshot, simulateGames } from './game.js?v=20cfea15';
import { readSave } from './save.js?v=17e3bab3';
import { bindRankboard, flushPending } from './rankboard.js?v=c9fb7455';
import { bindWelcome, showWelcomeIfNeeded, needsWelcome } from './welcome.js?v=10e1f73a';
import { bindNotice, showNoticeIfNew } from './notice.js?v=02b974f5';
import { bindGuestbook } from './guestbook.js?v=51590444';
import { bindGroup } from './group.js?v=a948b4a7';
import { syncMyAvatar, syncBadges } from './profile.js?v=f8ea613e';
import { bindAchievements } from './achieve-ui.js?v=2a181da3';
import { onMute, unlockedCount } from './achievements.js?v=6e59b0e1';
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
  $('btn-sound').addEventListener('click', () => { if (toggleMuted()) onMute(); renderSoundBtn(); });
  bindRankboard();
  bindWelcome();
  bindNotice();
  bindGuestbook();
  bindGroup();
  bindAchievements({ onCountChanged: syncBadges });
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
  await Promise.all([initSkin(), initCrown()]);
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
  syncBadges(unlockedCount());
  if (document.fonts) document.fonts.ready.then(fit);
}

boot();

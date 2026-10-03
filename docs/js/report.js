// 结算：战报卡、本机前 5、复制战绩，以及合出大张楷时的庆祝画面。
import { LEVELS, MAX, STORAGE_KEYS, SHARE_URL } from './config.js?v=21648a52';
import { skin, store } from './skin.js?v=83f93ead';
import { paintLevel } from './draw.js?v=1c93f03c';
import { sfx } from './audio.js?v=b9710e55';
import { state } from './state.js?v=5f7e2107';
import { onRoundOver } from './rankboard.js?v=c9fb7455';
import { clearSave } from './save.js?v=17e3bab3';
import { loadDex } from './dex.js?v=2f5cb32a';
import { onRoundEnd, takeRoundUnlocks } from './achievements.js?v=6e59b0e1';
import { showRoundUnlocks } from './achieve-ui.js?v=2a181da3';
import { $ } from './dom.js?v=5b57db68';

const BOARD_SIZE = 5;

export function showWin() {
  state.wonThisGame = true;
  state.paused = true;
  sfx.win();
  paintLevel($('win-pic'), MAX);
  $('win').hidden = false;
}

function loadBoard() {
  try {
    const b = JSON.parse(store.get(STORAGE_KEYS.board) || '[]');
    return Array.isArray(b) ? b.filter(r => Number.isFinite(r.score) && Number.isInteger(r.lv) && r.lv >= 0 && r.lv <= MAX) : [];
  } catch { return []; }
}

function recordRun(run) {
  const board = [...loadBoard(), run].sort((a, b) => b.score - a.score).slice(0, BOARD_SIZE);
  store.set(STORAGE_KEYS.board, JSON.stringify(board));
  return board;
}

function renderBoard(board, run) {
  $('board').replaceChildren(...board.map((r, i) => {
    const li = document.createElement('li');
    if (r.at === run.at) li.className = 'now';
    const rank = document.createElement('span'); rank.textContent = i + 1;
    const lv = document.createElement('span'); lv.className = 'lv';
    lv.textContent = skin[r.lv].name + ' · ' + new Date(r.at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    const sc = document.createElement('span'); sc.textContent = r.score + ' 分';
    li.append(rank, lv, sc);
    return li;
  }));
}

function verdictFor(lv) {
  if (lv >= MAX - 2) return '就差一点点！';
  if (lv >= 9) return '离大张楷不远了';
  if (lv >= 5) return '张楷溢出来了';
  return '张楷挤爆了';
}

// 进度格：合成过的显示小头像，没到的显示灰色编号
function renderDots(top) {
  $('report-dots').replaceChildren(...LEVELS.map((_, i) => {
    const c = document.createElement('canvas');
    c.width = c.height = 68;
    c.setAttribute('aria-label', skin[i].name + (i <= top ? '（已合成）' : '（未合成）'));
    if (i <= top) {
      paintLevel(c, i, { fill: 0.44 });
    } else {
      const pc = c.getContext('2d');
      pc.beginPath(); pc.arc(34, 34, 28, 0, Math.PI * 2);
      pc.fillStyle = 'rgba(59,42,20,.10)'; pc.fill();
      pc.font = '22px "ZCOOL KuaiLe", sans-serif'; pc.textAlign = 'center'; pc.textBaseline = 'middle';
      pc.fillStyle = 'rgba(59,42,20,.35)'; pc.fillText(String(i + 1), 34, 36);
    }
    return c;
  }));
}

// 黄金图鉴：14 格，见过的点亮
function renderDex(seen) {
  const dex = loadDex();
  $('dex-line').textContent = (seen > 0 ? `本局遇到黄金张楷 ×${seen}　` : '本局没遇到黄金张楷　') + `黄金图鉴 ${dex.length}/${LEVELS.length}`;
  $('dex-dots').replaceChildren(...LEVELS.map((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'dex-dot' + (dex.includes(i) ? ' got' : '');
    dot.textContent = i + 1;
    dot.title = skin[i].name + (dex.includes(i) ? '（见过黄金版）' : '（还没见过黄金版）');
    return dot;
  }));
}

let shareText = '';

export function gameOver() {
  const { score, topLevel, mergeCount, maxCombo, startedAt, wonThisGame } = state;
  state.over = true;
  clearSave();
  onRoundEnd({ score, playedMs: Date.now() - startedAt });
  sfx.over();

  const run = { score, lv: topLevel, at: Date.now() };
  const board = recordRun(run);
  const isRecord = board.findIndex(r => r.at === run.at) === 0 && board.length > 1;
  const title = LEVELS[topLevel].title;
  const name = skin[topLevel].name;
  const secs = Math.max(0, Math.round((Date.now() - startedAt) / 1000));

  $('report-date').textContent = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  $('report-stamp').hidden = !isRecord;
  $('report-verdict').textContent = state.fusions > 0 ? `张楷合体 ×${state.fusions}！` : wonThisGame ? '合出过大张楷！' : verdictFor(topLevel);
  $('report-hero').style.setProperty('--lv', LEVELS[topLevel].color);
  paintLevel($('final-pic'), topLevel);
  $('final-title').textContent = title;
  $('final').textContent = score;
  renderDots(topLevel);
  $('final-top').textContent = topLevel >= MAX
    ? `${LEVELS.length} 级全部集齐`
    : `最高第 ${topLevel + 1} 级「${name}」，离大张楷还差 ${MAX - topLevel} 级`;
  $('stat-merges').textContent = mergeCount;
  $('stat-combo').textContent = maxCombo >= 2 ? '×' + maxCombo : '无';
  $('stat-time').textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  $('report-foot').textContent = '截图发群里 · ' + SHARE_URL;
  renderBoard(board, run);
  renderDex(state.shinySeen);
  showRoundUnlocks(takeRoundUnlocks());
  onRoundOver();

  shareText = `我在「合成大张楷」拿了 ${score} 分，最高合成到第 ${topLevel + 1} 级「${name}」，称号：${title}`
    + (isRecord ? '，刷新了我的最高纪录' : '')
    + (state.fusions > 0 ? `，张楷合体 ${state.fusions} 次` : '')
    + (state.shinySeen > 0 ? `，还遇到了 ${state.shinySeen} 个黄金张楷` : '')
    + (wonThisGame ? '。我已经合出大张楷了，你呢？' : '。你能合出大张楷吗？')
    + ' ' + SHARE_URL;
  $('copy-fallback').hidden = true;
  $('btn-copy').textContent = '复制战绩';
  $('over').hidden = false;
}

export async function copyShare() {
  const btn = $('btn-copy');
  try {
    await navigator.clipboard.writeText(shareText);
    btn.textContent = '已复制，去群里粘贴';
  } catch {
    const ta = $('copy-fallback');
    ta.value = shareText; ta.hidden = false; ta.focus(); ta.select();
    btn.textContent = '长按上面的文字复制';
  }
}

// “换头像”面板：给每一级换照片、改名字。改动存在本机，关闭面板时如有改动就重开一局。
import { LEVELS, MAX } from './config.js';
import { skin, setSkin, resetSkin } from './skin.js';
import { readPhoto } from './trace.js';
import { drawKai } from './draw.js';
import { $ } from './dom.js';

const NAME_MAX_LEN = 8;
let dirty = false;

function updateLevel(i, patch) {
  setSkin(skin.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  dirty = true;
}

function renderRows(onRename) {
  $('rows').replaceChildren(...skin.map((s, i) => {
    const row = document.createElement('div'); row.className = 'row';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = i + 1;

    const pv = document.createElement('canvas'); pv.width = pv.height = 96;
    pv.style.width = pv.style.height = '44px';
    const paint = () => {
      const pc = pv.getContext('2d');
      pc.clearRect(0, 0, 96, 96);
      drawKai(pc, 48, 50, i === MAX ? 32 : 36, i);
    };
    paint(); setTimeout(paint, 120);

    const name = document.createElement('input');
    Object.assign(name, { type: 'text', id: 'name-' + i, value: s.name, maxLength: NAME_MAX_LEN });
    name.setAttribute('aria-label', `第 ${i + 1} 级名字`);
    name.addEventListener('input', () => {
      updateLevel(i, { name: name.value.trim() || LEVELS[i].name });
      onRename(); paint();
    });

    const up = document.createElement('label'); up.className = 'up'; up.textContent = s.photo ? '换照片' : '传照片';
    const fi = document.createElement('input');
    Object.assign(fi, { type: 'file', accept: 'image/*', id: 'photo-' + i });
    fi.addEventListener('change', async () => {
      if (!fi.files[0]) return;
      try {
        updateLevel(i, await readPhoto(fi.files[0]));
        renderRows(onRename);
      } catch (err) { up.textContent = err.message; }
    });
    up.append(fi);
    row.append(n, pv, name, up);
    return row;
  }));
}

// onRename：名字改了要刷新进度条；onChanged：关闭面板时有改动就重开
export function bindSettings({ onRename, onChanged }) {
  $('btn-set').addEventListener('click', () => {
    renderRows(onRename);
    $('settings').hidden = false;
  });
  $('btn-close').addEventListener('click', () => {
    $('settings').hidden = true;
    if (dirty) { dirty = false; onChanged(); }
  });
  $('btn-reset-skin').addEventListener('click', () => {
    resetSkin(); dirty = true;
    renderRows(onRename); onRename();
  });
  $('up-all').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = await readPhoto(f);
      setSkin(skin.map(x => ({ ...x, ...data })));
      dirty = true;
      renderRows(onRename);
    } catch { /* 读不了就不改 */ }
  });
}

// 群二维码图片可用时才显示入口；到期后更换图片与有效期文案。
import { state } from './state.js';
import { $ } from './dom.js';

let pausedByGroup = false;

export function bindGroup() {
  const image = $('group-qr');
  image.addEventListener('load', () => { $('btn-group').hidden = false; });
  image.src = 'images/wechat-group-2026-10-11.jpg';

  $('btn-group').addEventListener('click', () => {
    pausedByGroup = !state.over && !state.paused;
    if (pausedByGroup) state.paused = true;
    $('group').hidden = false;
  });

  $('btn-group-close').addEventListener('click', () => {
    $('group').hidden = true;
    if (pausedByGroup) state.paused = false;
    pausedByGroup = false;
  });
}

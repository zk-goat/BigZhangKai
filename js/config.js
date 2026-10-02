// 游戏的全部可调内容都在这里：改等级、换照片、调难度只需要改这个文件。

// 14 级张楷，从小到大。r 是同级圆的半径（照片轮廓按面积换算成同样大小），title 是合到这一级给的称号。
export const LEVELS = [
  { name: '推眼镜楷', r: 16, color: '#b98bff', image: 'images/level-01.webp', title: '刚认识张楷' },
  { name: '筷子楷', r: 21, color: '#ff6f91', image: 'images/level-02.webp', title: '筷子学徒' },
  { name: '嘟嘴楷', r: 26, color: '#ff9f43', image: 'images/level-03.webp', title: '嘟嘴观察员' },
  { name: '中指楷', r: 31, color: '#feca57', image: 'images/level-04.webp', title: '中指受害者' },
  { name: '雀神楷', r: 37, color: '#7bd389', image: 'images/level-05.webp', title: '雀神门徒' },
  { name: '夹克楷', r: 43, color: '#2e86de', image: 'images/level-06.webp', title: '夹克同款' },
  { name: '讲话楷', r: 49, color: '#3fb8af', image: 'images/level-07.webp', title: '讲话听众' },
  { name: '守门楷', r: 56, color: '#10ac84', image: 'images/level-08.webp', title: '替补门将' },
  { name: '头盔楷', r: 63, color: '#4f8fe8', image: 'images/level-09.webp', title: '头盔骑手' },
  { name: '队长楷', r: 71, color: '#ff7f50', image: 'images/level-10.webp', title: '队长左膀右臂' },
  { name: '田径楷', r: 80, color: '#5a5ad6', image: 'images/level-11.webp', title: '田径陪跑' },
  { name: '带球楷', r: 89, color: '#8d6e63', image: 'images/level-12.webp', title: '带球过人王' },
  { name: '挖掘机楷', r: 99, color: '#e2492f', image: 'images/level-13.webp', title: '挖掘机司机' },
  { name: '大张楷', r: 110, color: '#f2b705', image: 'images/level-14.webp', title: '金球得主' }
];

export const MAX = LEVELS.length - 1;

// 场地（逻辑像素，实际显示时等比缩放）
export const FIELD = {
  width: 400,
  height: 620,
  dangerY: 110,      // 虚线位置，停在线上方太久就判负
  dropY: 60          // 投放高度
};

// 物理
export const PHYSICS = {
  gravity: 1.1,
  body: { restitution: 0.15, friction: 0.25, frictionAir: 0.008, density: 0.0012 },
  wall: { friction: 0.3, restitution: 0.1 },
  stepMs: 1000 / 60,   // 固定步长
  maxCatchUpSteps: 4,  // 掉帧时最多补算几步
  uprightK: 0.004,     // 不倒翁回正力度
  uprightDamp: 0.96    // 不倒翁阻尼
};

// 玩法与难度
export const RULES = {
  spawnMaxLevel: 4,        // 只会掉落前 5 级（0~4）
  dropCooldownMs: 450,
  mergeReach: 1.8,         // 同级重心距离 < 半径 × 这个倍数 就合成
  dangerGraceMs: 1200,     // 刚掉下的张楷不算越线
  dangerHoldMs: 2000,      // 越线持续多久判负
  comboWindowMs: 1200,
  winBonus: 200,
  tallCap: 2.4             // 细长照片最长边不超过 半径 × 这个倍数
};

// 照片转碰撞轮廓
export const TRACE = {
  maxSize: 240,       // 计算轮廓前缩到的最大边长
  alphaCut: 40,       // 透明度高于它算实心
  hullVertices: 18    // 轮廓多边形最多几个顶点
};

// 画布里用到的颜色（页面其余颜色在 css/style.css 的 :root 里）
export const COLORS = {
  ink: '#3b2a14',
  muted: '#7a6235',
  accent: '#e2492f',
  crown: '#ffd43b'
};

// 本地存储的键名；改了格式就升版本号，旧数据自动作废
export const STORAGE_KEYS = {
  skin: 'dazhangkai-skin-v5',
  best: 'dazhangkai-best-v1',
  board: 'dazhangkai-board-v1',
  muted: 'dazhangkai-muted',
  playerName: 'dazhangkai-name',
  myScores: 'dazhangkai-my-scores'
};

export const SHARE_URL = 'zk-goat.github.io/BigZhangKai';

// 全班排行榜（Supabase）。url 留空时排行榜按钮自动隐藏。
// key 用的是 publishable 公开密钥，本来就是给网页用的；数据库只允许新增和查看，不能改删。
export const LEADERBOARD = {
  url: 'https://eopcaxlyisrxiznctmgn.supabase.co',
  key: 'sb_publishable_FycZaZjEgmW-6KTKw5Gplw_cG_FZt47',
  table: 'scores',
  size: 20,          // 显示前几名
  nameMaxLen: 12     // 与数据库里的长度限制一致
};

# 合成大张楷

仿「合成大西瓜」的物理合成小游戏，14 级张楷从推眼镜楷一路合成到捧金球的大张楷。

在线玩：https://zk-goat.github.io/BigZhangKai/

## 改内容

所有可调的东西都在 `js/config.js`：

- **换照片**：把抠好图的透明背景图片放进 `images/`，改对应等级的 `image` 路径。碰撞轮廓会按照片自动生成。
- **改名字、称号、颜色、大小**：改 `LEVELS` 里对应的那一行。
- **调难度**：`RULES`（掉落的最高等级、合成判定距离、判负时间等）和 `PHYSICS`（重力、摩擦、不倒翁力度）。

## 目录

| 路径 | 内容 |
|---|---|
| `js/config.js` | 等级、物理、难度等全部参数 |
| `js/game.js` | 物理世界、投放、合成、判负、主循环 |
| `js/report.js` | 战报卡、本机前 5、庆祝画面 |
| `js/draw.js` / `js/effects.js` | 画张楷 / 合成特效 |
| `js/skin.js` / `js/trace.js` / `js/geometry.js` | 照片加载、照片转碰撞轮廓、几何计算 |
| `js/settings.js` | 换头像面板 |
| `tools/bundle.py` | 打包成离线单文件 |

## 本地运行

ES 模块需要通过网页服务器打开，不能直接双击 `index.html`：

```
python -m http.server 8000
```

然后访问 http://localhost:8000 。链接后加 `?test=win` 直接看庆祝画面，加 `?test=over` 直接看示例战报。

## 测试、打包与发布

```
npm test                     # 单元测试
python tools/bundle.py       # 生成 dist/合成大张楷.html，完全离线，可直接发微信
python tools/build_site.py   # 生成 docs/ 线上发布副本（GitHub Pages 从 docs/ 发布）
```

`docs/` 和源代码的唯一区别是所有资源地址都带按内容计算的版本号（如 `js/game.js?v=1a2b3c4d`），
文件一改地址就变，玩家手机不会继续用旧缓存。每次发布前运行 `build_site.py` 再提交推送。

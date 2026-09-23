# tests/

本目录只服务于开发，不会发布到站点上（GitHub Pages 只当静态文件托管，跑不到这里）。

## 怎么跑

需要 Node 18 以上（内置 `node:test`，不用装任何依赖）：

```bash
node --test
```

在仓库根目录执行即可，它会自动找出 `tests/*.test.mjs` 全部跑一遍。
只想跑某一个文件就写路径，例如 `node --test tests/game.test.mjs`。

## 各个文件管什么

| 文件 | 管什么 |
| --- | --- |
| `game.test.mjs` | 玩法模拟：跳跃、滑铲、碰撞、小红花、结束判定，以及难度只许往上走 |
| `render.test.mjs` | 渲染冒烟：用假的 2D 上下文把 HUD、遮罩、成绩卡真画一遍，确认不会炸 |
| `audio.test.mjs` | 声音开关、静音记忆、开跑/被抓时的播放次序 |
| `homepage.test.mjs` / `nav.test.mjs` / `links.test.mjs` | 主站结构、导航、站内链接是否都指向真实文件 |
| `quote-rotator.test.mjs` | 首屏题记栏：上一条 / 下一条手动翻页，以及它跟自动轮播、悬停暂停、减少动态效果的交界 |
| `theme.test.mjs` | 明暗主题：首屏不闪、按钮文案说的是下一步、两套 token 对得上、对比度过 WCAG AA |
| `jary.test.mjs` | 期刊子站的双语、语言切换与画布占位 |

## 注意

`render.test.mjs` 里的假上下文是「没实现的方法一律当空操作」，
所以它只能证明绘制链路不会抛异常，证明不了画得好不好看。
真要肉眼验收，用 `@napi-rs/canvas` 之类的软件画布把帧导成 PNG 再看。

# Jary/assets/game/

《JARY 逃离奶龙》的立绘放这里。**空着也能玩**：游戏模块内置了两个现画的卡通角色。

## 放什么

| 文件 | 用途 | 建议尺寸 |
| --- | --- | --- |
| `jary.png` | 主角 JARY（朝右跑） | 约 120 × 170 px，透明底 |
| `nailong.png` | 追上来的奶龙（朝右） | 约 150 × 130 px，透明底 |

PNG（透明底）/ WebP / JPG 都行，文件名小写、用连字符。

## 怎么挂上去

在 `Jary/escape-nailong.html` 里给 canvas 加两个属性：

```html
<canvas id="nailong-canvas" class="game-canvas" width="960" height="420" tabindex="0"
        data-jary-sprite="assets/game/jary.png"
        data-nailong-sprite="assets/game/nailong.png"></canvas>
```

- 不写这两个属性 → 用内置卡通角色，页面不会发出任何图片请求。
- 写了但文件没放 → 控制台留一行提示，画面自动退回内置角色，不会出现裂图。

## 摆放规则

- 立绘是整块贴进画面里的（圆角裁切），所以**最好用抠好背景的透明 PNG**；带背景的图会看到一个方块。
- JARY 按 62 × 88 的框画（滑铲时压成 84 × 46），奶龙按 76 × 78 的框画。
  长宽比差太多的图会被拉伸，建议先裁成接近的比例。
- 单张控制在 200 KB 以内，`loading` 无所谓——这两张是开局就加载的。

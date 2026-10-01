# ship-structure/

作品「船舶结构力学可视化展示」的独立页面。这里一个专题一个文件，做完一个放一个。

```
ship-structure/
├── index.html        专题页本身：列出下面这些小项目（卡片由 site-data.js 渲染）
├── plate-demo.html   带板（附连翼板）受力与变形交互演示
└── README.md         这份说明
```

## 加一个新的小项目

1. 把做好的演示页拷进来，文件名用英文小写加连字符（例如 `buckling-demo.html`）。
   路径里不要出现空格和中文，这样分享出去的链接不会变成一串 `%E5%B8%A6...`。
2. 打开 `scripts/site-data.js`，往 `shipStructure.demos` 里添一条：

   ```js
   {
     title: '板格屈曲展示',          // 卡片标题
     text: '一句话说明这个演示能拖什么、看什么。',
     meta: '交互演示',               // 卡片右下角那枚小标签
     url: 'ship-structure/buckling-demo.html'   // 从站点根目录写起
   }
   ```

   存盘刷新，卡片自己就长出来了，`index.html` 不用动。

## 约定

- **url 一律从站点根目录写起**（`ship-structure/xxx.html`），跟作品列表同一套写法；
  `index.html` 上的 `data-url-prefix="../"` 负责把它接回子目录里的相对路径。
- 演示页通常是**单文件**：自带 `<style>` 和 `<script>`，不引外部字体、CDN。
  这样双击本地文件也能跑，断网也照样演示。
- 演示页自己带主题（例如 `plate-demo.html` 是一套深色海图配色），
  就不并进主站导航；页面上留一枚返回专题页的链接即可，写法见 `plate-demo.html` 的 `.back`。
- 加完跑一下 `node --test`：`tests/ship-structure.test.mjs` 会检查清单里的
  每条 url 都指得到真实文件，也检查演示页没有偷偷引外部资源。

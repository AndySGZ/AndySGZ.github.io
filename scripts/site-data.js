/* ==========================================================================
   站点内容数据 —— 只改这个文件就能更新全站文案，无需碰 HTML。
   首页只显示前几条，杂谈页 / 作品页显示全部（由 data-limit 控制）。
   ========================================================================== */
window.SITE_DATA = {

  /* —— 首屏感触句：文字出现 / 消失，中间留出阅读时间 —— */
  quotes: {
    reading: { perChar: 260, min: 4500, max: 14000 },  /* 每字毫秒 / 下限 / 上限 */
    fade: 700,      /* 与 CSS --slow 一致 */
    gap: 600,       /* 完全消失后到下一句出现的留白 */
    items: [
      { text: '只要你不停地向上走，一级级楼梯就没有尽头，在你向上走的脚下，它们也在向上长。', source: '卡夫卡《律师》' },
      { text: 'The obstacles in your path define the path.\n道有坎坷方知路正，人无历练原力难成。 ', source: 'Star Wars Jedi：Fallen Order' },
      { text: '记录本身就是一种缓慢的理解。', source: '给 JBR 的题记' }
    ]
  },

  /* —— 杂谈：按时间倒序，最新的排最前 ——
     url 留空表示还没发布，页面会显示「尚未发布」而不是给一个死链接。 */
  essays: [
    {
      date: '2026-09-21',
      title: '开始写点什么',
      tag: '随笔',
      excerpt: '一直觉得要等想清楚了再写，后来发现写作本身就是想清楚的过程。所以先把第一篇放上来。',
      url: ''
    },
    {
      date: '2026-09-18',
      title: 'JBR 创刊说明',
      tag: '项目',
      excerpt: 'Jary真神了',
      url: 'Jary/index.html'
    },
    {
      date: '2026-09-12',
      title: '看到的快去练琴',
      tag: '练琴',
      excerpt: '',
      url: ''
    },
  ],

  /* —— 作品 —— url 留空表示筹备中 */
  works: [
    {
      title: 'JBR 行为研究',
      text: '一份专注于单一特定个体的双语行为学观察期刊，严谨记录，科学分析。',
      meta: '长期更新',
      url: 'Jary/index.html'
    },
    {
      title: '个人主页',
      text: '就是你现在看到的这个站。纯静态、零依赖、无构建步骤，可直接由 GitHub Pages 发布。',
      meta: '已完成',
      url: 'index.html'
    },
    {
      title: '练琴记录工具',
      text: '想把每次练习的时长、段落和感受记下来，看看长期的曲线长什么样。',
      meta: '筹备中',
      url: ''
    }
  ],

  /* —— 练琴 ——
     intro：页头右侧的方形图；留空则只显示一个空占位方块。
     stages：切换标签的顺序与标题都取自这里，加一项就多一个标签。
       title 必填；composer / note / image 都可省略，省略了就不渲染那一部分。
       image 是每条曲目右侧的横向图；留空则只显示占位框。
     图片统一放在 assets/practice/，路径从站点根目录写起，详见该目录的 README。
     ⚠️ 下面几条是示例内容，请替换成你自己的曲目。 */
  practice: {
    intro: { image: '', alt: '练琴' },
    stages: [
      {
        stage: '在练',
        items: [
          { title: '无伴奏小提琴奏鸣曲第一号 · 柔板', composer: 'J. S. 巴赫', note: '每天先过一遍音准，再谈表情。', image: '' },
          { title: 'E 小调小提琴协奏曲 · 第一乐章', composer: '门德尔松', note: '第二主题的换把还是不稳。', image: '' }
        ]
      },
      {
        stage: '想练',
        items: [
          { title: '恰空舞曲', composer: 'J. S. 巴赫', note: '等第一号奏鸣曲站稳了再碰。', image: '' },
          { title: '茨冈', composer: '拉威尔', note: '门槛太高，先当听力材料。', image: '' }
        ]
      },
      {
        stage: '已练',
        items: [
          { title: 'G 大调小提琴协奏曲 · 第一乐章', composer: '莫扎特', note: '2026 年 6 月过完谱子，现在偶尔回来复习。', image: '' }
        ]
      }
    ]
  },

  /* —— 联系方式（留位，等真实信息） —— */
  contact: [
    { label: '邮箱', value: '1434582884@qq.com' },
    { label: 'GitHub', value: 'AndySGZ', url: 'https://github.com/AndySGZ' },
    { label: '微信', value: '不便透露:)' }
  ]
};

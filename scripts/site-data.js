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
      { text: '', source: '2026 年 9 月' },
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
      excerpt: '为什么会有一份只研究单一特定个体的期刊，以及它打算怎么记录、怎么分析。',
      url: 'Jary/index.html'
    },
    {
      date: '2026-09-12',
      title: '琴房里的一个小时',
      tag: '练琴',
      excerpt: '同一段乐句重复四十遍之后，耳朵会开始注意一些平时完全听不见的东西。',
      url: ''
    },
    {
      date: '2026-09-05',
      title: '慢练的真正难点',
      tag: '练琴',
      excerpt: '慢下来不难，难的是慢下来之后还不着急。手可以慢，注意力慢不了。',
      url: ''
    },
    {
      date: '2026-08-28',
      title: '为什么这个网站没有框架',
      tag: '代码',
      excerpt: '原生 HTML、CSS 和 JavaScript 就够了。少一层依赖，就少一个十年后打不开的理由。',
      url: ''
    }
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

  /* —— 联系方式（留位，等真实信息） —— */
  contact: [
    { label: '邮箱', value: '1434582884@qq.com' },
    { label: 'GitHub', value: 'AndySGZ', url: 'https://github.com/AndySGZ' },
    { label: '微信', value: '不便透露:)' }
  ]
};

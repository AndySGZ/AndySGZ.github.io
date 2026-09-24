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
      { text: '亲爱的朋友，灰色的理论到处都有，\n而生活的金树长青。', source: 'Mephistopheles in 《Faust》' },
      /* 这句的正文里有撇号，所以整串用双引号写，免得在单引号里到处转义 */
      { text: "Maybe there is a beast... maybe it's only us.", source: 'William Golding 《Lord of the Flies》' }
    ]
  },

  /* —— 杂谈：按时间倒序，最新的排最前 ——
     url 留空表示还没发布，页面会显示「尚未发布」而不是给一个死链接。 */
  essays: [
    {
      date: '2026-09-24',
      title: '到底如何练好节奏啊？',
      tag: '练琴',
      excerpt: '点击来看笨人不会的节奏型。',
      url: 'essays/rhythm.html'
    },
    {
      date: '2026-09-21',
      title: '开始写点什么',
      tag: '随笔',
      excerpt: '一直觉得要等想清楚了再写，后来发现写作本身就是想清楚的过程。所以先把第一篇放上来。',
      url: ''
    },
    {
      date: '2026-09-18',
      title: 'JBR 创刊',
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

  /* —— 杂谈的分类标签 ——
     现在是空的，所以杂谈页不显示筛选栏，就是一条干净的时间线。
     以后写文章想分类了，把分类名写进来，筛选栏会自己长出来：
       essayTags: ['随笔', '项目'],
     条目上的 tag 要跟这里对得上；对不上的条目只在「全部」里露面。
     清单里先摆一个还没有内容的分类也没关系，它会显示 0 篇。 */
  essayTags: [],

  /* —— 作品：tag 决定它落在作品页的哪个分类下，取值见下面的 workTags ——
     现在三件都归在「其他」，不想细分就先这样，以后想归哪类改这一个词。
     url 留空表示筹备中。 */
  works: [
    {
      title: 'JBR 行为研究',
      text: '一份专注于单一特定个体的双语行为学观察期刊，严谨记录，科学分析。',
      meta: '长期更新',
      tag: '其他',
      url: 'Jary/index.html'
    },
    {
      title: '个人主页',
      text: '就是你现在看到的这个站。纯静态、零依赖、无构建步骤，可直接由 GitHub Pages 发布。',
      meta: '已完成',
      tag: '其他',
      url: 'index.html'
    },
    {
      title: '练琴记录工具',
      text: '想把每次练习的时长、段落和感受记下来，看看长期的曲线长什么样。',
      meta: '筹备中',
      tag: '其他',
      url: ''
    }
  ],

  /* —— 作品的分类标签 ——
     这五个的顺序就是作品页筛选栏上按钮的顺序，先定下来不再从条目上推导：
     以后加作品时，把 tag 写成下面其中一个，它就自动归到那一类。 */
  workTags: ['声音', '图像', '学习', '科研', '其他'],

  /* —— 练琴 ——
     intro：页头右侧的方形图；留空则只显示一个空占位方块。
     stages：切换标签的顺序与标题都取自这里，加一项就多一个标签。
       title 必填；composer / note / image / alt 都可省略，省略了就不渲染那一部分。
       image 是每条曲目右侧的横向图；留空则只显示占位框。
       alt 是给读屏和「图挂了」时看的说明，不写就退回用 title 顶上。
     图片统一放在 assets/practice/，路径从站点根目录写起，详见该目录的 README。 */
  practice: {
    intro: { image: '', alt: '练琴' },
    stages: [
      {
        stage: '在练',
        items: [
          { title: 'Op.12 No.1·D大调小提琴奏鸣曲', composer: '贝多芬',
            note: '克服自己过去形成的错误习惯和本能很困难。',
            image: 'assets/practice/beethoven_op12.webp',
            alt: '贝多芬 D 大调小提琴奏鸣曲 Op.12 No.1 开头：Allegro con brio 速度标记与独奏声部的进入' },
          { title: 'BWV1001·Adagio 柔板', composer: 'J.S.巴赫',
            note: '对我而言问题首先在于节奏，然后是和弦，最后才是音乐性',
            image: 'assets/practice/bwv1001adagio.webp',
            alt: 'BWV1001 柔板开头的谱例：Adagio 速度标记与开头的和弦' },
        ]
      },
      {
        stage: '想练',
        items: [
          { title: '恰空舞曲', composer: 'J. S. 巴赫', note: '或许等adagio练完了可以严肃的尝试下？', image: '' },
        ]
      },
      {
        stage: '已练',
        items: [
          { title: 'E小调小提琴协奏曲·第一乐章', composer: '门德尔松',
            note: '虽说已经练完，但是想要完整演奏可能并非短期可行',
            image: 'assets/practice/mendelssohn_op64.webp',
            alt: '协奏曲第一乐章开头独奏声部的谱例' }
        ]
      }
    ]
  },

  /* —— 联系方式 —— 首页和「关于」页都渲染这一份 */
  contact: [
    { label: '邮箱', value: '1434582884@qq.com' },
    { label: 'GitHub', value: 'AndySGZ', url: 'https://github.com/AndySGZ' },
    { label: '微信', value: '不便透露:)' }
  ]
};

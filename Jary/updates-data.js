/* ==========================================================================
   动态栏目的内容 —— 只改这个文件就能发新动态，页面一行都不用动。
   --------------------------------------------------------------------------
   一条动态长这样：

     {
       date: '2026-09-22',          // 必填，YYYY-MM-DD；页面按它倒序排，写哪儿都行
       kind: { zh: '公告', en: 'Announcement' },   // 可选，日期后面的小红标签
       title: { zh: '...', en: '...' },            // 必填
       text: '第一段。\n\n第二段。',                // 可选，空一行就分成两段
       images: [                     // 可选，放几张都行；1 张铺满，2 张以上并排
         {
           src: 'assets/updates/xxx.svg',   // 路径从 Jary/ 目录写起
           alt: '图片说明（读屏用，写中文就行）',
           caption: { zh: '图注', en: 'Caption' }   // 可选
         }
       ],
       link: { href: 'games.html', label: { zh: '去游戏厅', en: 'To the game room' } }  // 可选
     }

   正文（text）照上面这样写成 { zh, en } 两段，中英各一份最好 —— 期刊里其他文案
   都是双语，只写中文的话切到 EN 会看到「英文标题 + 中文正文」，很突兀。
   真赶时间只写一边也行：缺的那边会自动用另一边顶上，至少不会留空。
   纯字符串就是中英共用同一句（日期、代码这类不需要翻译的才这么写）。
   图片放在 Jary/assets/updates/，详见那个目录里的 README。
   ========================================================================== */
export const UPDATES = [
  {
    date: '2026-09-22',
    kind: { zh: '观测记录', en: 'Field note' },
    title: { zh: 'JARY 说：大家好！', en: 'JARY says: hello, everyone!' },
    /* 这条没有正文：话就一句，当标题更醒目。想把它挪到正文里，
       就把 title 换成一个短标题，再给这里补一个 text。 */
    images: [
      {
        src: 'assets/updates/2026-09-22-cap.webp',
        alt: '室内：JARY 戴着鸭舌帽，帽子上夹着一台小相机',
        caption: { zh: '帽子上别了一台相机', en: 'A camera clipped onto the cap' }
      },
      {
        src: 'assets/updates/2026-09-22-bike.webp',
        alt: 'JARY 骑着蓝色共享单车，停在树荫底下',
        caption: { zh: '骑着那辆蓝色共享单车', en: 'Out on the blue shared bike' }
      },
      {
        src: 'assets/updates/2026-09-22-scooters.webp',
        alt: 'JARY 坐在共享单车上手托着腮，四周停满电动车',
        caption: { zh: '停下来，手托着腮', en: 'Stopped, chin in hand' }
      }
    ]
  },
  {
    date: '2026-09-22',
    kind: { zh: '公告', en: 'Announcement' },
    title: { zh: '游戏厅开张', en: 'The game room opens' },
    text: {
      zh: '第一号小游戏《JARY 逃离奶龙》开放试玩：奶龙在身后穷追不舍，跳过课桌、书堆与垃圾桶，'
        + '滑铲躲开贴地飞来的纸飞机，顺手捡走小红花把距离重新拉开。\n\n'
        + '游戏厅是本刊的非学术栏目，画风卡通校园，里面的数据不作数，请勿引用。',
      en: 'The first mini-game, JARY Escapes Nailong, is open for play: Nailong is right behind you — '
        + 'vault the desks, book piles and bins, slide under the paper planes skimming in low, and grab '
        + 'the little red flowers to open up the gap again.\n\n'
        + 'The game room is this journal’s non-academic section, drawn in a cartoon campus style. '
        + 'Nothing in it is data; please do not cite it.'
    },
    link: { href: 'games.html', label: { zh: '去游戏厅', en: 'To the game room' } }
  },
  {
    date: '2026-09-21',
    kind: { zh: '创刊', en: 'Launch' },
    title: { zh: '创刊号出版', en: 'Inaugural issue published' },
    text: {
      zh: '《JARY行为研究》创刊号今日出版。本期确立以 JARY 为唯一研究对象的长期观察框架，'
        + '并公布四项核心研究计划：行为机理、动态观测、认知分析、网络符号交互。\n\n'
        + '创刊社论《为什么是 JARY》说明了一件事：行为不是孤立事件，而是习惯、语言、环境与网络符号'
        + '共同构成的连续系统。本刊长期记录这个系统，不预设结论，也不遗漏微小变化。',
      en: 'The inaugural issue of JARY Behavior Research is out today. It establishes a longitudinal '
        + 'framework centered on JARY as its only subject, and sets out four core research programmes: '
        + 'behavioral mechanisms, longitudinal observation, cognitive analysis, and interaction with '
        + 'internet symbols.\n\n'
        + 'The founding editorial, “Why JARY”, makes one point: behavior is not an isolated event but a '
        + 'continuous system of habit, language, environment and internet symbolism. The journal records '
        + 'that system over time, without predetermined conclusions and without missing small changes.'
    },
    images: [
      {
        src: 'assets/updates/inaugural-plate.svg',
        alt: '创刊号匾额：红色块上的 JARY 字样与创刊日期',
        caption: { zh: '创刊号 · Volume 1, Issue 1', en: 'Inaugural issue · Volume 1, Issue 1' }
      }
    ],
    link: { href: 'index.html#current', label: { zh: '看本期', en: 'View the issue' } }
  },
  {
    date: '2026-09-26',
    kind: { zh: '观测记录', en: 'Field note' },
    title: {
      zh: 'JARY 说：欢迎来大JARY转转转排练厅',
      en: 'JARY says: come spin-spin-spin at Big JARY’s rehearsal room'
    },
    text: {
      zh: '椅子一转就停不下来，胳膊张成一条线找平衡，身后那面排鼓也跟着晃。',
      en: 'Once the chair starts turning it will not stop — arms out flat for balance, the drum behind '
        + 'swaying along with every round.'
    },
    images: [
      {
        src: 'assets/updates/2026-09-26-jary-spin.gif',
        alt: '排练厅里：JARY 坐在转椅上张开双臂，连人带椅子转了一圈又一圈，身后立着红金两面的排鼓',
        caption: { zh: '转椅才是主角', en: 'The swivel chair steals the scene' }
      }
    ]
  }
];

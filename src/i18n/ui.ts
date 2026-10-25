/** Blog interface strings. */
const zh = {
  'copy.failed': '复制失败',

  'nav.label': '主导航',
  'nav.skip': '跳到正文',
  'nav.menu': '菜单',
  'nav.close': '关闭菜单',
  'nav.home': '首页',

  'theme.toggle': '切换日夜主题',
  'motion.pause': '暂停动画',
  'lang.switch': 'English',











  'notes.title': '博客',
  'notes.lede': '技术、学习与研究的记录。',
  'notes.back': '全部文章',
  'notes.updated': '更新于',
  'notes.empty': '文章尚在准备中。',
  'notes.otherLang': '英文版',

  'footer.top': '回到顶部',

  'preview.label': '预览模式',
  'preview.pending': '{n} 项待确认',
  'preview.marks': '标记',
  'preview.hint': '虚线框里的内容还没确认公开，生产构建不会包含它们。',


  '404.title': '页面不存在',
  '404.body': '这个地址没有公开的内容。',
  '404.home': '回到首页',
  '404.echo': '无回波',
} as const;

export type UiKey = keyof typeof zh;

const en: Record<UiKey, string> = {
  'copy.failed': 'Copy failed',

  'nav.label': 'Main',
  'nav.skip': 'Skip to content',
  'nav.menu': 'Menu',
  'nav.close': 'Close menu',
  'nav.home': 'Home',

  'theme.toggle': 'Switch between night and day',
  'motion.pause': 'Pause animation',
  'lang.switch': '中文',











  'notes.title': 'Blog',
  'notes.lede': 'Notes on technology, learning and research.',
  'notes.back': 'All posts',
  'notes.updated': 'Updated',
  'notes.empty': 'Posts are on the way.',
  'notes.otherLang': 'Chinese version',

  'footer.top': 'Back to top',

  'preview.label': 'Preview',
  'preview.pending': '{n} items awaiting approval',
  'preview.marks': 'Marks',
  'preview.hint': 'Dashed outlines mark content that is not approved yet. Production builds leave it out.',


  '404.title': 'Page not found',
  '404.body': 'Nothing is published at this address.',
  '404.home': 'Back home',
  '404.echo': 'No echo',
};

export const ui = { zh, en } as const;

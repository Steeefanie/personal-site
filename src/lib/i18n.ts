export const locales = ['zh-CN', 'zh-TW', 'en'] as const;

export type Locale = (typeof locales)[number];
export type Localized<T> = Record<Locale, T>;

export const defaultLocale = 'zh-CN' satisfies Locale;

export const localeNames: Localized<string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
};

export const localeDateFormats: Record<Locale, string> = {
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en-US',
};

export const text = <T>(zhCN: T, zhTW: T, en: T): Localized<T> => ({
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
});

export const ui = {
  nav: {
    home: text('主页', '首頁', 'Home'),
    blog: text('随笔', '隨筆', 'Blog'),
    projects: text('项目', '專案', 'Projects'),
    recipes: text('食谱', '食譜', 'Recipes'),
  },
  common: {
    openMenu: text('打开导航菜单', '開啟導覽選單', 'Open navigation menu'),
    closeMenu: text('关闭导航菜单', '關閉導覽選單', 'Close navigation menu'),
    chooseLanguage: text('选择语言', '選擇語言', 'Choose language'),
    search: text('搜索', '搜尋', 'Search'),
    clearFilters: text('清除筛选', '清除篩選', 'Clear filters'),
    all: text('全部', '全部', 'All'),
    noResults: text('没有符合条件的内容。', '沒有符合條件的內容。', 'No matching content.'),
    previous: text('上一篇', '上一篇', 'Previous'),
    next: text('下一篇', '下一篇', 'Next'),
    previousPage: text('上一页', '上一頁', 'Previous'),
    nextPage: text('下一页', '下一頁', 'Next'),
    pagination: text('内容分页', '內容分頁', 'Content pagination'),
    primaryNavigation: text('主要导航', '主要導覽', 'Primary navigation'),
    mobileNavigation: text('移动端导航', '行動版導覽', 'Mobile navigation'),
    languageMenu: text('语言', '語言', 'Language'),
    searchSection: text('搜索范围', '搜尋範圍', 'Search section'),
    searchResults: text('搜索结果', '搜尋結果', 'Search results'),
    adjacentPosts: text('相邻随笔', '相鄰隨筆', 'Adjacent posts'),
    adjacentProjects: text('相邻项目', '相鄰專案', 'Adjacent projects'),
    adjacentRecipes: text('相邻食谱', '相鄰食譜', 'Adjacent recipes'),
  },
  home: {
    title: text('Steeefanie 的个人网站', 'Steeefanie 的個人網站', "Steeefanie's Personal Site"),
    description: text(
      '一个记录开发随笔、项目与日常食谱的个人网站。',
      '一個記錄開發隨筆、專案與日常食譜的個人網站。',
      'A personal site for development notes, projects, and everyday recipes.',
    ),
    intro: text(
      '我会在随笔中记下各种各样的技术笔记、踩坑经历、碎碎念，项目里放着我捣鼓出的一些小东西，食谱里有我做过的菜、揉过的面、调过的酒……',
      '我會在隨筆中記下各式各樣的技術筆記、踩雷經歷與碎念，專案裡放著我動手做的一些小東西，食譜裡有我做過的菜、揉過的麵糰、調過的酒……',
      'Blog holds my technical notes, hard-won lessons, and stray thoughts. Projects is where the little things I tinker with live, while Recipes collects dishes I’ve cooked, dough I’ve kneaded, and drinks I’ve mixed.',
    ),
    aboutTitle: text('关于我', '關於我', 'About me'),
    aboutText: text(
      '工科背景，文职牛马，关注人工智能、计算机网络、图像处理……',
      '理工背景，文職社畜，關注人工智慧、電腦網路、影像處理……',
      'Engineering background, office-job desk jockey. I’m interested in artificial intelligence, computer networks, and image processing.',
    ),
    latest: text('最近更新', '最近更新', 'Latest updates'),
    services: text('在线服务', '線上服務', 'Online services'),
  },
  guestbook: {
    title: text('留言', '留言', 'Guestbook'),
    intro: text(
      '欢迎留下问题、建议，或者简单打个招呼。',
      '歡迎留下問題、建議，或只是打個招呼。',
      'Feel free to leave a question, suggestion, or just say hello.',
    ),
    privacy: text(
      '留言将公开显示，请勿填写个人隐私或敏感信息。',
      '留言將公開顯示，請勿填寫個人隱私或敏感資訊。',
      'Messages are public. Please do not include private or sensitive information.',
    ),
    login: text(
      '发表留言需要登录 GitHub。',
      '發表留言需要登入 GitHub。',
      'A GitHub account is required to post.',
    ),
    open: text('打开留言', '開啟留言', 'Open guestbook'),
    close: text('关闭留言', '關閉留言', 'Close guestbook'),
  },
  comments: {
    title: text('留言', '留言', 'Comments'),
  },
  search: {
    placeholder: text('搜索标题、摘要或标签', '搜尋標題、摘要或標籤', 'Search titles, summaries, or tags'),
    label: text('站内搜索', '站內搜尋', 'Site search'),
    noResults: text('没有找到匹配内容。', '找不到符合的內容。', 'No matching results.'),
  },
  filters: {
    category: text('类别', '類別', 'Category'),
  },
  category: {
    'home-cooking': text('家常菜', '家常菜', 'Home cooking'),
    flour: text('面食', '麵食', 'Flour dishes'),
    cocktail: text('鸡尾酒', '調酒', 'Cocktail'),
  },
} as const;

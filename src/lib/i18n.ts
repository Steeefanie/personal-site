export const locales = ['zh-CN', 'zh-TW', 'en'] as const;

export type Locale = (typeof locales)[number];
export type Localized<T> = Record<Locale, T>;

export const defaultLocale: Locale = 'zh-CN';
export const languageStorageKey = 'language';

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
      '工科背景，文职牛马，关注人工智能、计算机网络、图像处理……闲暇时什么都做，搞吃搞喝，偶尔捣鼓一些小东西。',
      '理工背景，文職社畜，關注人工智慧、電腦網路、影像處理……閒暇時什麼都做，弄吃弄喝，偶爾動手做些小東西。',
      'Engineering background, office-job desk jockey. I’m interested in artificial intelligence, computer networks, and image processing. In my spare time I do a bit of everything—cook, mix drinks, and occasionally tinker with small things.',
    ),
    latest: text('最近更新', '最新動態', 'Latest'),
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

export const getInitialLocale = (value: string | null | undefined): Locale => {
  if (value === 'zh') return 'zh-CN';
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale;
};

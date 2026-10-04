export const giscusConfig = {
  repo: 'Steeefanie/steeefanie-comments',
  repoId: 'R_kgDOU6VbFg',
  category: 'Comments',
  categoryId: 'DIC_kwDOU6VbFs4DG9UP',
  guestbookDiscussionNumber: 1,
  discussionsUrl: 'https://github.com/Steeefanie/steeefanie-comments/discussions',
  themes: {
    light: 'https://steeefanie.top/giscus-light.css',
    dark: 'https://steeefanie.top/giscus-dark.css',
    localLight: '/giscus-light.css',
    localDark: '/giscus-dark.css',
  },
} as const;

export const isGiscusConfigured = (
  Boolean(giscusConfig.repoId)
  && Boolean(giscusConfig.categoryId)
  && giscusConfig.guestbookDiscussionNumber > 0
);

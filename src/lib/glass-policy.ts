export type GlassEngine = 'chromium' | 'webkit' | 'css';

export function glassEngine(userAgent: string): GlassEngine {
  if (/(?:Chrome|Chromium|Edg)\//.test(userAgent)) return 'chromium';
  if (/AppleWebKit\//.test(userAgent)) return 'webkit';
  return 'css';
}

export function glassBlur(kind: string | undefined, icon = false): number {
  return ['menu', 'dialog', 'search'].includes(kind ?? '') || (kind === 'contents' && !icon) ? 3 : 2;
}

/** Static page controls and a docked TOC icon never overlay scrolling content. */
export function hasStaticGlassBackground(element: HTMLElement): boolean {
  return !!element.classList?.contains('glass-surface--static')
    || !!element.closest?.('.glass-surface--static')
    || (!!element.classList?.contains('article-toc-toggle-surface')
      && element.closest?.('[data-article-toc]')?.getAttribute('data-mode') === 'dock');
}

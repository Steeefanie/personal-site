interface ListingPosition {
  url: string;
  scrollY: number;
}

const positionKey = (pathname: string) => `listing-position:${pathname}`;
const returnKey = 'listing-return-position';
const currentUrl = () => `${location.pathname}${location.search}${location.hash}`;

const previousHistoryUrl = (): string | undefined => {
  // Only use native back when the preceding entry is exactly this list, not
  // an article's chapter anchor or another article in the reading sequence.
  const navigation = window.navigation;
  const index = navigation?.currentEntry?.index;
  return navigation && index !== undefined && index > 0
    ? navigation.entries()[index - 1]?.url ?? undefined
    : undefined;
};

const readPosition = (key: string, pathname: string): ListingPosition | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!value || typeof value.url !== 'string' || !Number.isFinite(value.scrollY) || value.scrollY < 0) return null;
    const url = new URL(value.url, location.origin);
    if (url.origin !== location.origin || url.pathname !== pathname) return null;
    return { url: `${url.pathname}${url.search}${url.hash}`, scrollY: value.scrollY };
  } catch {
    return null;
  }
};

export const rememberListingPosition = (section: HTMLElement) => {
  const save = () => {
    try {
      sessionStorage.setItem(positionKey(location.pathname), JSON.stringify({
        url: currentUrl(),
        scrollY: window.scrollY,
      } satisfies ListingPosition));
    } catch { /* Storage may be unavailable. */ }
  };

  // Save before navigation, including opening an article in another tab.
  section.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a[href]')) save();
  }, { capture: true });
  addEventListener('pagehide', save);

  const position = readPosition(returnKey, location.pathname);
  if (!position || position.url !== currentUrl()) return;
  try { sessionStorage.removeItem(returnKey); } catch { /* Storage may be unavailable. */ }

  let cancelled = false;
  const cancel = () => { cancelled = true; };
  const restore = () => {
    if (!cancelled) scrollTo({ top: position.scrollY, behavior: 'instant' });
  };
  const finish = () => {
    restore();
    removeEventListener('wheel', cancel);
    removeEventListener('touchstart', cancel);
    removeEventListener('keydown', cancel);
    removeEventListener('pointerdown', cancel);
    history.scrollRestoration = 'auto';
  };
  addEventListener('wheel', cancel, { passive: true });
  addEventListener('touchstart', cancel, { passive: true });
  addEventListener('keydown', cancel);
  addEventListener('pointerdown', cancel);
  // Restore after filtering, then after pageshow/native scroll restoration.
  // A load handler alone can run before the browser resets a new entry to top.
  restore();
  const finishAfterPageShow = () => requestAnimationFrame(finish);
  if (document.readyState === 'complete') finishAfterPageShow();
  else addEventListener('pageshow', finishAfterPageShow, { once: true });
};

export const initializeListingBackLinks = () => {
  document.querySelectorAll<HTMLAnchorElement>('[data-listing-back]').forEach((link) => {
    const pathname = new URL(link.href).pathname;
    const sync = () => {
      const position = readPosition(positionKey(pathname), pathname);
      link.href = position?.url ?? pathname;
      return position;
    };
    sync();
    addEventListener('pageshow', sync);
    link.addEventListener('click', (event) => {
      const position = sync();
      if (!position || event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (previousHistoryUrl() === new URL(position.url, location.origin).href) {
        event.preventDefault();
        history.back();
        return;
      }
      try { sessionStorage.setItem(returnKey, JSON.stringify(position)); } catch { /* Storage may be unavailable. */ }
    });
  });
};

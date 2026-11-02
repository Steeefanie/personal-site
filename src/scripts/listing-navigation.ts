interface ListingPosition {
  url: string;
  scrollY: number;
}

const positionKey = (pathname: string) => `listing-position:${pathname}`;
const returnKey = 'listing-return-position';
const currentUrl = () => `${location.pathname}${location.search}${location.hash}`;

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

export const rememberListingPosition = (section: HTMLElement, listen: typeof window.addEventListener = addEventListener) => {
  const pathname = location.pathname;
  let url = currentUrl();
  const save = () => {
    if (location.pathname === pathname) url = currentUrl();
    try {
      sessionStorage.setItem(positionKey(pathname), JSON.stringify({
        url,
        scrollY: window.scrollY,
      } satisfies ListingPosition));
    } catch { /* Storage may be unavailable. */ }
  };

  // Save before navigation, including opening an article in another tab.
  section.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a[href]')) save();
  }, { capture: true });
  listen('pagehide', save);

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
  listen('wheel', cancel, { passive: true });
  listen('touchstart', cancel, { passive: true });
  listen('keydown', cancel);
  listen('pointerdown', cancel);
  // Restore after filtering, then after pageshow/native scroll restoration.
  // A load handler alone can run before the browser resets a new entry to top.
  restore();
  const finishAfterPageShow = () => requestAnimationFrame(finish);
  if (document.readyState === 'complete') finishAfterPageShow();
  else listen('pageshow', finishAfterPageShow, { once: true });
};

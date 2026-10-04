export type ScrollLockOwner = 'search' | 'guestbook';

const owners = new Set<ScrollLockOwner>();
let lockedScrollY = 0;

export const lockPageScroll = (owner: ScrollLockOwner): void => {
  if (owners.has(owner)) return;

  owners.add(owner);
  if (owners.size > 1) return;

  lockedScrollY = window.scrollY;
  const root = document.documentElement;
  root.style.setProperty('--page-scroll-offset', `${-lockedScrollY}px`);
  root.classList.add('page-scroll-locked');
};

export const unlockPageScroll = (owner: ScrollLockOwner): void => {
  if (!owners.delete(owner) || owners.size > 0) return;

  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  root.classList.remove('page-scroll-locked');
  root.style.removeProperty('--page-scroll-offset');

  void document.body.offsetHeight;
  window.scrollTo(0, lockedScrollY);
  window.dispatchEvent(new CustomEvent('site:scroll-unlocked', {
    detail: { scrollY: lockedScrollY },
  }));

  requestAnimationFrame(() => {
    if (previousBehavior) root.style.scrollBehavior = previousBehavior;
    else root.style.removeProperty('scroll-behavior');
  });
};

export const isPageScrollLocked = (): boolean => owners.size > 0;

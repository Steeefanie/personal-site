import { onPageLoad } from './page-lifecycle';

onPageLoad((scope) => {
  const listing = document.querySelector<HTMLElement>('[data-recipe-listing]');
  const filters = listing?.querySelector<HTMLElement>('[data-listing-filters]');
  const utilities = document.querySelector<HTMLElement>('.header-actions');
  if (!listing || !filters || !utilities) return;

  // A stationary marker detects the sticky threshold without a scroll loop.
  const marker = document.createElement('span');
  marker.setAttribute('aria-hidden', 'true');
  marker.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
  listing.prepend(marker);
  const mobile = matchMedia('(max-width: 760px)');
  let observer: IntersectionObserver | undefined;
  let revealFrame = 0;
  const update = () => {
    const top = parseFloat(getComputedStyle(filters).top) || 0;
    const stuck = mobile.matches && marker.getBoundingClientRect().top <= top;
    const available = utilities.getBoundingClientRect().left - listing.getBoundingClientRect().left - 12;
    const width = `${Math.max(56, available)}px`;
    const changed = filters.style.getPropertyValue('--recipe-filter-available') !== width
      || filters.dataset.stuck !== String(stuck);
    filters.style.setProperty('--recipe-filter-available', width);
    filters.dataset.stuck = String(stuck);
    if (changed) {
      cancelAnimationFrame(revealFrame);
      revealFrame = requestAnimationFrame(() => {
        const scroller = filters.querySelector<HTMLElement>('.filter-options');
        const selected = scroller?.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (scroller && selected) {
          scroller.scrollLeft = selected.offsetLeft - (scroller.clientWidth - selected.offsetWidth) / 2;
        }
      });
    }
  };
  const observe = () => {
    observer?.disconnect();
    const top = parseFloat(getComputedStyle(filters).top) || 0;
    observer = new IntersectionObserver(update, { rootMargin: `-${top}px 0px 0px 0px`, threshold: 0 });
    observer.observe(marker);
    update();
  };
  const resize = new ResizeObserver(observe);
  resize.observe(utilities);
  resize.observe(listing);
  scope.onWindow('resize', observe);
  observe();
  scope.cleanup(() => { cancelAnimationFrame(revealFrame); observer?.disconnect(); resize.disconnect(); marker.remove(); });
});

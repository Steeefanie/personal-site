import { installTouchSlider } from './selection-touch';

interface SliderEntry { group: HTMLElement; slider: HTMLElement; preview?: HTMLElement }
let entries: SliderEntry[] = [];
let frame = 0;
const selectedOption = (group: HTMLElement) =>
  group.querySelector<HTMLElement>('[aria-current="page"], [aria-current="location"], [aria-pressed="true"]')
  ?? group.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.closest('label');
const move = ({ group, slider }: SliderEntry, option: HTMLElement) => {
  if (!group.getClientRects().length || !option.offsetWidth) return;
  // offsetWidth/offsetLeft round to integers; preserve subpixels so the end
  // caps share their centers with the shell. Include the scroller's offset.
  const bounds = group.getBoundingClientRect();
  const target = option.getBoundingClientRect();
  const expansion = parseFloat(getComputedStyle(group).getPropertyValue('--selection-expansion')) || 0;
  slider.style.width = `${target.width + expansion * 2}px`;
  slider.style.height = `${target.height + expansion * 2}px`;
  slider.style.transform = `translate(${target.left - bounds.left - group.clientLeft + group.scrollLeft - expansion}px, ${target.top - bounds.top - group.clientTop + group.scrollTop - expansion}px)`;
  if (!group.classList.contains('has-selection-slider')) group.classList.add('has-selection-slider');
};
const sync = () => {
  frame = 0;
  entries.forEach((entry) => {
    const target = entry.preview ?? selectedOption(entry.group);
    if (target) move(entry, target);
  });
};
const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
const resize = new ResizeObserver(schedule);
const reconcile = () => {
  entries = entries.filter((entry) => {
    if (entry.group.isConnected) return true;
    resize.unobserve(entry.group);
    return false;
  });
  document.querySelectorAll<HTMLElement>('.primary-nav, .listing-filters .filter-options, .search-scopes, .recipe-view-switch, .menu-choice-group, .toc-choice-group, .radio-slider-group').forEach((group) => {
    if (entries.some((entry) => entry.group === group)) return;
    const slider = group.querySelector<HTMLElement>(':scope > .selection-slider') ?? document.createElement(group.matches('ol') ? 'li' : 'span');
    slider.className = 'selection-slider';
    slider.setAttribute('aria-hidden', 'true');
    if (!slider.parentElement) group.append(slider);
    const entry: SliderEntry = { group, slider };
    entries.push(entry);
    resize.observe(group);
    installTouchSlider(group, {
      options: () => [...group.querySelectorAll<HTMLElement>(':scope > .nav-link, :scope > .filter-chip, :scope > [data-view-option], :scope > .language-option, :scope > .mobile-nav-link, :scope > [data-article-toc-link], :scope > label')],
      selected: () => selectedOption(group),
      preview: (option) => { entry.preview = option; move(entry, option); },
      reset: () => { entry.preview = undefined; schedule(); },
      vertical: group.matches('.menu-choice-group, .toc-choice-group'),
    });
    // Opening menus scale briefly; remeasure once their transform has settled.
    group.closest('.glass-menu')?.addEventListener('animationend', schedule);
    group.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const option = event.target instanceof Element ? event.target.closest<HTMLElement>('.nav-link, .filter-chip, [data-view-option], .language-option, .mobile-nav-link, [data-article-toc-link], .radio-slider-group > label') : null;
      if (!option || option.closest('.has-selection-slider, .toc-choice-group') !== group || entry.preview === option) return;
      entry.preview = option;
      move(entry, option);
    });
    group.addEventListener('pointerleave', () => {
      if (group.classList.contains('is-slider-dragging')) return;
      entry.preview = undefined;
      schedule();
    });
    group.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      entry.preview = undefined;
      schedule();
    });
    group.addEventListener('pointercancel', () => { entry.preview = undefined; schedule(); });
    group.addEventListener('change', () => { entry.preview = undefined; schedule(); });
  });
  entries.forEach((entry) => { entry.preview = undefined; });
  sync();
};
new MutationObserver(schedule).observe(document.documentElement, {
  subtree: true, attributes: true, attributeFilter: ['aria-current', 'aria-pressed', 'hidden'],
});
document.addEventListener('astro:page-load', reconcile);
addEventListener('pageshow', reconcile);
addEventListener('site:theme-change', schedule);
void document.fonts.ready.then(schedule);
reconcile();

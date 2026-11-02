import { onPageLoad } from './page-lifecycle';
onPageLoad((scope) => {
  const root = document.querySelector<HTMLElement>('[data-footer-language]');
  const trigger = root?.querySelector<HTMLButtonElement>('.language-switcher');
  const panel = root?.querySelector<HTMLElement>('[data-panel="language"]');
  if (!root || !trigger || !panel) return;
  let timer = 0;
  let restoring = false;
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  const close = (restore = false) => {
    clearTimeout(timer);
    trigger.setAttribute('aria-expanded', 'false');
    if (panel.hidden) return;
    const finish = () => { panel.hidden = true; panel.classList.remove('is-closing'); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else { panel.classList.add('is-closing'); timer = window.setTimeout(finish, 180); }
    if (restore) { restoring = true; trigger.focus({ preventScroll: true }); restoring = false; }
  };
  const open = () => {
    clearTimeout(timer);
    window.dispatchEvent(new CustomEvent('site:close-panels'));
    panel.classList.remove('is-closing');
    panel.hidden = false;
    panel.style.removeProperty('width');
    panel.style.width = `${panel.offsetWidth * 1.5}px`;
    trigger.setAttribute('aria-expanded', 'true');
  };
  trigger.addEventListener('click', () => {
    if (hover.matches) open();
    else if (trigger.getAttribute('aria-expanded') === 'true') close();
    else open();
  });
  trigger.addEventListener('focus', () => { if (!restoring && trigger.matches(':focus-visible')) open(); });
  root.addEventListener('pointerenter', () => { if (hover.matches) open(); });
  root.addEventListener('pointerleave', () => { if (hover.matches) timer = window.setTimeout(() => close(), 150); });
  scope.onWindow('pointerdown', (event) => { if (!root.contains(event.target as Node)) close(); });
  scope.onWindow('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); } });
  scope.onWindow('site:panel-opened', () => close());
  scope.cleanup(() => clearTimeout(timer));
  root.querySelectorAll<HTMLAnchorElement>('[data-language-option]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const preference = link.dataset.languageOption;
      if (preference) {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `steeefanie_locale=${encodeURIComponent(preference)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
      }
      if (link.getAttribute('aria-current') === 'page') { event.preventDefault(); close(); return; }
      const target = new URL(link.href);
      target.search = location.search;
      link.href = target.href;
      try {
        const headings = [...document.querySelectorAll<HTMLElement>('.prose :is(h2, h3)')];
        const readingAnchor = Math.min(180, innerHeight * 0.3);
        let headingIndex = -1;
        headings.forEach((heading, index) => { if (heading.getBoundingClientRect().top <= readingAnchor) headingIndex = index; });
        const maximumScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        const readingItem = [...document.querySelectorAll<HTMLElement>('.content-list-item')]
          .filter((item) => !item.hidden && item.getBoundingClientRect().bottom > 0)
          .find((item) => item.getBoundingClientRect().bottom > readingAnchor);
        const itemLink = readingItem?.querySelector<HTMLAnchorElement>('a[href]');
        sessionStorage.setItem('language-route-scroll', JSON.stringify({
          target: `${target.pathname}${target.search}`, scrollY,
          progress: maximumScroll > 0 ? scrollY / maximumScroll : 0,
          headingIndex, headingOffset: headingIndex >= 0 ? headings[headingIndex].getBoundingClientRect().top : 0,
          itemPath: itemLink ? new URL(itemLink.href).pathname.replace(/^\/(?:zh-cn|zh-tw|en)(?=\/)/, '') : undefined,
          itemOffset: readingItem?.getBoundingClientRect().top,
        }));
      } catch { /* Storage may be unavailable. */ }
    });
  });
});

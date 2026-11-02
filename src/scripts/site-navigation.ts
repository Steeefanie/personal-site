import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';

// The chrome is the same DOM tree across routes; only its route-dependent labels change.
document.addEventListener('astro:before-swap', (event) => {
  const next = (event as TransitionBeforeSwapEvent).newDocument;
  const theme = document.documentElement.dataset.theme ?? 'light';
  next.documentElement.dataset.theme = theme;
  next.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141414' : '#f5f5f5');
  next.querySelector('#site-favicon')?.setAttribute('href', `/brand/favicon-${theme}-nobg.svg`);
  const currentChrome = document.querySelector('[data-top-chrome]');
  const nextChrome = next.querySelector('[data-top-chrome]');
  if (!currentChrome || !nextChrome) return;
  const selector = 'a[href]:not(.search-result-link), [aria-label], input[placeholder], [data-default-scope], [data-label-light], h2, label';
  const incoming = [...nextChrome.querySelectorAll(selector)];
  currentChrome.querySelectorAll(selector).forEach((element, index) => {
    const source = incoming[index];
    if (!source) return;
    for (const name of ['href', 'aria-current', 'aria-label', 'placeholder', 'data-default-scope', 'data-label-light', 'data-label-dark']) {
      if (source.hasAttribute(name)) element.setAttribute(name, source.getAttribute(name)!);
      else if (name === 'aria-current') element.removeAttribute(name);
    }
    if (element.matches('.nav-link, .mobile-nav-link, .language-option, h2, label')) element.textContent = source.textContent;
  });
  const scopeLabels = nextChrome.querySelectorAll('[data-search-scope]');
  currentChrome.querySelectorAll('[data-search-scope]').forEach((button, index) => {
    button.textContent = scopeLabels[index]?.textContent ?? button.textContent;
  });
});

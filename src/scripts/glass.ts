import type { HyaliteAPI } from '../types/hyalite';
import { glassBlur, glassEngine, hasStaticGlassBackground } from '../lib/glass-policy';

// Decorative only: never capture page content or participate in interaction.
const collectSurfaces = () => [...document.querySelectorAll<HTMLElement>('[data-glass]')]
  .filter((element) => ['navigation', 'contents', 'control', 'menu', 'dialog', 'search'].includes(element.dataset.glass ?? ''));
let surfaces = collectSurfaces();
const chrome = document.querySelector<HTMLElement>('[data-top-chrome]');
const header = chrome?.querySelector<HTMLElement>('.site-header');
let contents = document.querySelector<HTMLElement>('[data-article-toc]');
let footerLanguage = document.querySelector<HTMLElement>('[data-footer-language]');
const solid = matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active), (prefers-contrast: more)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const attached = new Set<HTMLElement>();
let api: HyaliteAPI | undefined;
let timer = 0;
let disposed = false;
let loading: Promise<void> | undefined;

// Both themes share geometry, dispersion and the lighting footprint. Dark glass
// skips the optional desaturation blend: its mask/composite quantization leaves
// 1-level luminance bands even on a uniform neutral backdrop. sat=1 is upstream's
// documented bypass; it does not change displacement, dispersion, blur or light.
const material = { blur: 2, materialize: 0, shade: 0.18, edgeW: 2 };
const reflection = () => document.documentElement.dataset.theme === 'dark'
  ? { edge: 0.03, rim: 0.35, sat: 1 }
  : { edge: api!.DEFAULTS.edge, rim: api!.DEFAULTS.rim, sat: api!.DEFAULTS.sat };

const release = (element: HTMLElement) => {
  delete element.dataset.glassActive;
  attached.delete(element);
  try { api?.detach(element); } catch { /* Never let decoration interrupt page controls. */ }
};

const eligible = (element: HTMLElement) => {
  if (solid.matches || document.hidden || !element.isConnected || hasStaticGlassBackground(element)) return false;
  if (document.documentElement.dataset.webglGlassPreview === 'true') return false;
  if (element.getClientRects && !element.getClientRects().length) return false;
  if (element.dataset.glass === 'navigation') {
    return !header?.classList.contains('is-hidden') && chrome?.getAttribute('data-panel-open') !== 'search';
  }
  if (element.dataset.glass === 'dialog') return element.hasAttribute('open');
  if (element.dataset.glass === 'search') return chrome?.getAttribute('data-panel-open') === 'search' && !element.hidden;
  if (element.dataset.glass === 'control' || element.dataset.glass === 'menu') return true;
  if (!contents || contents.dataset.resizing === 'true') return false;
  if (element.classList.contains('article-toc-toggle-surface')) {
    return true;
  }
  return contents.dataset.open === 'true';
};

const sync = (refreshExisting = true, openingOnly = false) => {
  if (!api || disposed) return;
  for (const element of surfaces) {
    if (openingOnly && !['menu', 'contents', 'dialog', 'search'].includes(element.dataset.glass ?? '')) continue;
    try {
      if (eligible(element)) {
        if (!attached.has(element)) {
          // Keep upstream refraction and reflection, with the accepted narrow edge.
          api.attach(element, { ...material,
            blur: glassBlur(element.dataset.glass, element.classList?.contains('article-toc-toggle-surface')), ...reflection() });
          attached.add(element);
          element.dataset.glassActive = 'true';
          // Keep filter definitions alive with the persisted chrome during body swaps.
          const definitions = document.querySelector('body > svg:has(filter[id^="hyalite-"])');
          if (definitions?.tagName?.toLowerCase() === 'svg') chrome?.append(definitions);
        } else if (refreshExisting && !element.classList?.contains('is-closing')) api.refresh(element);
      } else if (attached.has(element)) release(element);
    } catch {
      release(element);
    }
  }
};

const schedule = () => {
  // Detach hidden/changing surfaces immediately; rebuild geometry after motion settles.
  for (const element of attached) {
    if (!eligible(element)) release(element);
  }
  window.clearTimeout(timer);
  // Menu layout boxes are already final; Hyalite ignores their entry transform.
  // Attach before the next paint, then coalesce any later geometry refresh.
  sync(false, true);
  timer = window.setTimeout(sync, motion.matches ? 0 : 300);
};

const observer = new MutationObserver(schedule);
const resize = new ResizeObserver(schedule);
const initialize = async () => {
  if (!surfaces.length || solid.matches || glassEngine(navigator.userAgent) !== 'chromium') return;
  try {
    loading ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/hyalite/hyalite-0.5.0.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Optional glass enhancement unavailable'));
      document.head.append(script);
    });
    await loading;
    if (disposed || !window.Hyalite?.supported()) return;
    api = window.Hyalite;
    for (const root of [chrome, contents, footerLanguage, ...surfaces.filter((element) => element.dataset.glass === 'dialog')]) {
      if (root) observer.observe(root, { subtree: true, attributes: true,
        attributeFilter: ['class', 'hidden', 'open', 'data-panel-open', 'data-open', 'data-resizing', 'data-mode'] });
    }
    surfaces.forEach((element) => resize.observe(element));
    sync();
  } catch { /* CSS material remains fully usable when the enhancement cannot load. */ }
};

solid.addEventListener('change', () => {
  if (!api && !solid.matches) void initialize();
  else schedule();
});
motion.addEventListener('change', schedule);
addEventListener('site:glass-preview-change', schedule);
addEventListener('site:theme-change', () => {
  if (!api || disposed) return;
  // Change reflection brightness without changing displacement or color separation.
  void api.setOpts(reflection()).catch(() => { /* Decoration stays optional. */ });
});
document.addEventListener('visibilitychange', schedule);
addEventListener('pagehide', () => {
  disposed = true;
  window.clearTimeout(timer);
  observer.disconnect();
  resize.disconnect();
  for (const element of attached) release(element);
});
addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  disposed = false;
  if (api) {
    for (const root of [chrome, contents, footerLanguage, ...surfaces.filter((element) => element.dataset.glass === 'dialog')]) {
      if (root) observer.observe(root, { subtree: true, attributes: true,
        attributeFilter: ['class', 'hidden', 'open', 'data-panel-open', 'data-open', 'data-resizing', 'data-mode'] });
    }
    surfaces.forEach((element) => resize.observe(element));
    sync();
  } else void initialize();
});
void initialize();
document.addEventListener('astro:before-swap', () => {
  resize.disconnect();
  for (const element of attached) {
    if (element.dataset.glass !== 'navigation') { release(element); resize.unobserve(element); }
  }
});
document.addEventListener('astro:page-load', () => {
  contents = document.querySelector<HTMLElement>('[data-article-toc]');
  footerLanguage = document.querySelector<HTMLElement>('[data-footer-language]');
  surfaces = collectSurfaces();
  observer.disconnect();
  for (const root of [chrome, contents, footerLanguage, ...surfaces.filter((element) => element.dataset.glass === 'dialog')]) {
    if (root) observer.observe(root, { subtree: true, attributes: true,
      attributeFilter: ['class', 'hidden', 'open', 'data-panel-open', 'data-open', 'data-resizing', 'data-mode'] });
  }
  surfaces.forEach((element) => resize.observe(element));
  schedule();
});

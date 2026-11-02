import { onPageLoad } from './page-lifecycle';
import { glassBlur, glassEngine, hasStaticGlassBackground } from '../lib/glass-policy';

let library: Promise<any> | undefined;
const loadLibrary = () => library ??= new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = '/vendor/simple-liquid-glass/simple-liquid-glass-5.6.0.js';
  script.onload = () => resolve((window as unknown as { SimpleGlassPreview: any }).SimpleGlassPreview);
  script.onerror = () => { script.remove(); library = undefined; reject(new Error('Optional WebGL material unavailable')); };
  document.head.append(script);
});

onPageLoad((scope) => {
  const query = new URL(location.href).searchParams;
  const forced = import.meta.env.DEV && query.get('webgl-glass') === '1';
  if (!forced && glassEngine(navigator.userAgent) !== 'webkit') return;
  const root = document.querySelector<HTMLElement>('#main-content');
  if (!root) return;
  const solid = matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active), (prefers-contrast: more)');
  let disposed = false;
  const cleanup: Array<() => void> = [];
  const active = new Map<HTMLElement, { release: () => void; update: () => void }>();
  scope.cleanup(() => {
    disposed = true;
    active.forEach((entry) => entry.release());
    active.clear();
    cleanup.reverse().forEach((fn) => fn());
  });

  void (async () => {
    const lib = await loadLibrary();
    if (disposed) return;
    const html = document.documentElement;
    html.dataset.webglGlassPreview = 'true';
    dispatchEvent(new Event('site:glass-preview-change'));
    cleanup.push(() => { delete html.dataset.webglGlassPreview; dispatchEvent(new Event('site:glass-preview-change')); });
    const style = document.createElement('style');
    style.textContent = `
      [data-webgl-presented='true']{background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    `;
    document.head.append(style);
    cleanup.push(() => style.remove());

    // Flatten long layout wrappers into bounded capture tiles. This includes
    // article headings/decks/tags and avoids downsampling an entire long page.
    const sections = () => {
      const result: HTMLElement[] = [];
      const visit = (element: HTMLElement) => {
        if (element.closest('[data-liquid-glass-scene-surface], [data-liquid-glass-ignore]') || ['SCRIPT', 'STYLE'].includes(element.tagName)) return;
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const children = [...element.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
        const directText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
        if (box.height > Math.max(800, innerHeight) && children.length && !directText && getComputedStyle(element).backgroundImage === 'none') children.forEach(visit);
        else result.push(element);
      };
      [...root.children].forEach((element) => { if (element instanceof HTMLElement) visit(element); });
      const footer = document.querySelector<HTMLElement>('.site-footer');
      if (footer) visit(footer);
      return result;
    };
    const capture = lib.createSceneCapture(root, { sections, maxCacheBytes: 24 * 1024 * 1024,
      onCaptureError: (error: unknown) => console.warn('Optional glass background:', error) });
    cleanup.push(() => capture.destroy());

    const eligible = (surface: HTMLElement) => {
      if (solid.matches || document.hidden || !surface.isConnected || hasStaticGlassBackground(surface) || surface.closest('[hidden],.is-closing,[inert]')) return false;
      if (surface.closest('dialog:not([open])')) return false;
      const box = surface.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(surface).visibility !== 'hidden';
    };
    const attach = (surface: HTMLElement) => {
      const beforeIsolation = surface.style.isolation;
      surface.style.isolation = 'isolate';
      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;inset:0;z-index:-1;overflow:hidden;border-radius:inherit;pointer-events:none;opacity:0';
      const tint = document.createElement('div');
      const panel = ['search', 'dialog'].includes(surface.dataset.glass ?? '');
      tint.style.cssText = `position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;background:var(--glass-fill,var(--glass-tint));box-shadow:var(--glass-selection-shadow)${panel ? ',var(--shadow-overlay)' : ''};opacity:0`;
      surface.append(holder, tint);
      const present = (visible: boolean) => {
        holder.style.opacity = tint.style.opacity = visible ? '1' : '0';
        if (visible) surface.dataset.webglPresented = 'true';
        else delete surface.dataset.webglPresented;
      };
      let engine: { update: (options: unknown) => void; destroy: () => void } | undefined;
      let complete = false;
      let released = false;
      let geometry = '';
      const options = () => {
        const { width, height } = surface.getBoundingClientRect();
        const radius = Math.min(width / 2, height / 2, parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 28);
        const lens = lib.resolveLensOptions('material', { strength: 0.16, bend: 0.7, bendWidth: 0.22 });
        return { map: lib.buildNativeMap(width, height, radius, 'material', lens),
          scale: Math.hypot(width, height) / Math.SQRT2 * lens.strength, dispersion: 0.16,
          specular: 0, classic: false, radius, blur: glassBlur(surface.dataset.glass, surface.classList.contains('article-toc-toggle-surface')), saturation: 100 };
      };
      const backdrop = capture.register(surface, (ready: boolean) => {
        if (released || disposed) return;
        complete = ready;
        if (ready && !engine) {
          try {
            engine = lib.createWebGLEngine(surface, holder, backdrop.canvas, options(), (status: string) => {
              surface.dataset.webglStatus = status;
              present(complete && status === 'active');
            });
          } catch { present(false); }
        }
        present(ready && surface.dataset.webglStatus === 'active');
      });
      return {
        update() {
          const box = surface.getBoundingClientRect();
          const next = `${box.width}:${box.height}:${getComputedStyle(surface).borderTopLeftRadius}`;
          if (next !== geometry) { geometry = next; engine?.update(options()); }
        },
        release() {
          released = true;
          engine?.destroy();
          backdrop.release();
          present(false);
          holder.remove(); tint.remove();
          surface.style.isolation = beforeIsolation;
          delete surface.dataset.webglStatus;
        },
      };
    };
    let frame = 0;
    const sync = () => {
      frame = 0;
      for (const [surface, entry] of active) if (!eligible(surface)) { entry.release(); active.delete(surface); }
      for (const surface of document.querySelectorAll<HTMLElement>('[data-glass]')) {
        if (!['navigation', 'contents', 'control', 'menu', 'dialog', 'search'].includes(surface.dataset.glass ?? '') || !eligible(surface)) continue;
        if (!active.has(surface)) active.set(surface, attach(surface));
        active.get(surface)?.update();
      }
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(sync); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, attributes: true,
      attributeFilter: ['hidden', 'open', 'class', 'inert', 'data-open', 'data-mode', 'data-initialized'] });
    const resize = new ResizeObserver(schedule);
    document.querySelectorAll<HTMLElement>('[data-glass]').forEach((surface) => resize.observe(surface));
    solid.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', schedule);
    scope.onWindow('resize', schedule, { passive: true });
    scope.onWindow('animationend', schedule, true);
    scope.onWindow('transitionend', schedule, true);
    scope.onWindow('site:theme-change', () => { root.dispatchEvent(new Event('input', { bubbles: true })); schedule(); });
    cleanup.push(() => {
      cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      solid.removeEventListener('change', schedule); document.removeEventListener('visibilitychange', schedule);
    });
    schedule();
  })().catch(() => { /* Native CSS material is the complete fallback. */ });
});

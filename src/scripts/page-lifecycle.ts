export interface PageScope {
  onWindow: typeof window.addEventListener;
  cleanup: (callback: () => void) => void;
}

/** Rebind page-owned controls after Astro swaps, and release their global listeners. */
export function onPageLoad(initialize: (scope: PageScope) => void) {
  let dispose: (() => void) | undefined;
  const run = () => {
    dispose?.();
    const controller = new AbortController();
    const cleanups: Array<() => void> = [];
    const onWindow = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      const invoke = (event: Event) => typeof listener === 'function' ? listener.call(window, event) : listener.handleEvent(event);
      window.addEventListener(type, listener, { ...(typeof options === 'boolean' ? { capture: options } : options), signal: controller.signal });
      if (type === 'pagehide' || type === 'beforeunload') cleanups.push(() => invoke(new Event(type)));
      if (type === 'pageshow') queueMicrotask(() => { if (!controller.signal.aborted) invoke(new PageTransitionEvent('pageshow')); });
    }) as typeof window.addEventListener;
    dispose = () => {
      try { cleanups.forEach((cleanup) => cleanup()); }
      finally { controller.abort(); dispose = undefined; }
    };
    initialize({ onWindow, cleanup: (callback) => cleanups.push(callback) });
  };
  document.addEventListener('astro:page-load', run);
  document.addEventListener('astro:before-swap', () => dispose?.());
}

const root = document.querySelector<HTMLElement>('[data-article-toc]');

if (root && root.dataset.initialized !== 'true') {
  root.dataset.initialized = 'true';

  const panel = root.querySelector<HTMLElement>('[data-article-toc-panel]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-article-toc-toggle]');
  const backdrop = root.querySelector<HTMLButtonElement>('[data-article-toc-backdrop]');
  const resizer = root.querySelector<HTMLElement>('[data-article-toc-resizer]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-article-toc-reset]');
  const panelHeader = root.querySelector<HTMLElement>('.article-toc-header');
  const panelNav = root.querySelector<HTMLElement>('.article-toc-nav');
  const page = document.querySelector<HTMLElement>('[data-article-toc-page]');
  const storageKey = 'article-toc-width';
  const minWidth = 240;
  const maxWidth = 440;
  const minAutoWidth = 260;
  const maxAutoWidth = 380;
  const fixedPanelSpace = 72;
  let open = false;
  let currentWidth = 300;
  let automaticWidth = 300;
  let manualWidth: number | null = null;
  let dragFrame = 0;
  let pendingDragWidth = 0;
  let scrollFrame = 0;
  let measurementFrame = 0;

  const numberToken = (name: string, fallback: number) => {
    const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);
  const layoutViewportWidth = () => document.documentElement.clientWidth;
  let previousLayoutWidth = layoutViewportWidth();
  const panelEdge = () => numberToken('--article-toc-edge', 16);
  const viewportMaximum = () => Math.max(minWidth, Math.min(maxWidth, layoutViewportWidth() - panelEdge() * 2));
  const preferredWidth = () => manualWidth ?? automaticWidth;
  const headingTopOffset = (headerVisible: boolean) => (
    (headerVisible ? numberToken('--header-height', 72) : 0)
    + (root.dataset.mode === 'overlay' ? panelEdge() + 56 : 24)
  );

  const readStoredWidth = () => {
    try {
      const value = Number(localStorage.getItem(storageKey));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  };

  const saveManualWidth = () => {
    if (manualWidth === null) return;
    try { localStorage.setItem(storageKey, String(Math.round(manualWidth))); } catch { /* Storage may be unavailable. */ }
  };

  const clearStoredWidth = () => {
    try { localStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
  };

  const syncResetControl = () => {
    if (resetButton) resetButton.hidden = manualWidth === null;
    root.dataset.widthMode = manualWidth === null ? 'automatic' : 'manual';
  };

  const syncPanelHeight = () => {
    const activeList = root.querySelector<HTMLOListElement>('.article-toc-nav > ol');
    if (!activeList || !panelNav) return;

    // Measure the list at its expanded width without resizing the visible shell.
    root.dataset.measuring = 'true';
    const navStyle = getComputedStyle(panelNav);
    const navPadding = Number.parseFloat(navStyle.paddingTop) + Number.parseFloat(navStyle.paddingBottom);
    const headerHeight = Math.max(58, panelHeader?.getBoundingClientRect().height ?? 0);
    const listHeight = Math.max(activeList.scrollHeight, activeList.getBoundingClientRect().height);
    const contentHeight = Math.ceil(headerHeight + listHeight + navPadding);
    root.style.setProperty('--article-toc-header-height', `${headerHeight}px`);
    root.style.setProperty('--article-toc-content-height', `${contentHeight}px`);
    delete root.dataset.measuring;
  };

  const syncLabels = () => {
    if (toggle) {
      toggle.setAttribute('aria-label', open
        ? toggle.dataset.closeLabel ?? 'Close contents'
        : toggle.dataset.openLabel ?? 'Open contents');
    }
    if (backdrop) backdrop.setAttribute('aria-label', toggle?.dataset.closeLabel ?? 'Close contents');
  };

  const updateLayoutMode = () => {
    const readingWidth = numberToken('--content-reading', 740);
    const gutter = numberToken('--page-gutter', 30);
    const viewportWidth = layoutViewportWidth();
    const originalContentWidth = Math.min(readingWidth, Math.max(0, viewportWidth - gutter * 2));
    const reservedWidth = currentWidth + panelEdge() * 2;
    const canDock = viewportWidth - reservedWidth >= originalContentWidth + gutter * 2;
    const mode = canDock ? 'dock' : 'overlay';
    root.dataset.mode = mode;

    if (open) {
      document.documentElement.dataset.articleTocMode = mode;
      if (page) page.inert = mode === 'overlay';
    } else if (page) {
      page.inert = false;
    }
  };

  const applyWidth = (value: number) => {
    currentWidth = clamp(value, minWidth, viewportMaximum());
    document.documentElement.style.setProperty('--article-toc-width', `${currentWidth}px`);
    resizer?.setAttribute('aria-valuenow', String(Math.round(currentWidth)));
    syncPanelHeight();
    updateLayoutMode();
  };

  const measureAutomaticWidth = () => {
    const titles = [...root.querySelectorAll<HTMLElement>('[data-article-toc-title]')];
    if (titles.length === 0) return 300;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return 300;

    const widths = titles.map((title) => {
      const style = getComputedStyle(title);
      context.font = style.font;
      const link = title.closest<HTMLElement>('[data-article-toc-link]');
      const depth = Number(link?.dataset.depth ?? 2);
      return context.measureText(title.textContent ?? '').width + (depth === 3 ? 18 : 0);
    }).sort((a, b) => a - b);

    const percentileIndex = Math.ceil(widths.length * .8) - 1;
    const percentile80 = widths[percentileIndex];
    const longest = widths[widths.length - 1];
    const titleWidth = longest > percentile80 * 1.2 ? percentile80 * 1.2 : longest;
    return clamp(titleWidth + fixedPanelSpace, minAutoWidth, maxAutoWidth);
  };

  const refreshAutomaticWidth = () => {
    automaticWidth = measureAutomaticWidth();
    if (manualWidth === null) applyWidth(automaticWidth);
  };

  const activeLinks = () => [
    ...root.querySelectorAll<HTMLAnchorElement>('[data-article-toc-link]'),
  ];

  const contentHeadings = () => [
    ...document.querySelectorAll<HTMLElement>('.prose :is(h2, h3)'),
  ];

  const updateActiveHeading = () => {
    scrollFrame = 0;
    const headings = contentHeadings();
    if (headings.length === 0) return;
    const headerHidden = document.querySelector('.site-header')?.classList.contains('is-hidden') ?? false;
    const threshold = headingTopOffset(!headerHidden);
    const atPageEnd = window.scrollY > 0
      && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    let active = atPageEnd ? headings[headings.length - 1] : headings[0];
    if (!atPageEnd) {
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > threshold + 1) break;
        active = heading;
      }
    }
    activeLinks().forEach((link) => {
      if (link.dataset.slug === active.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  const queueActiveHeadingUpdate = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(updateActiveHeading);
  };

  const setOpen = (nextOpen: boolean, restoreFocus = false, focusCurrentLink = false) => {
    if (!panel || !toggle) return;
    open = nextOpen;
    root.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;
    syncLabels();

    if (open) {
      applyWidth(preferredWidth());
      document.documentElement.dataset.articleTocOpen = 'true';
      document.documentElement.dataset.articleTocMode = root.dataset.mode ?? 'overlay';
      requestAnimationFrame(() => {
        if (!open) return;
        updateActiveHeading();
        const current = activeLinks().find((link) => link.getAttribute('aria-current') === 'location');
        if (!current) return;
        if (panelNav) {
          const bounds = panelNav.getBoundingClientRect();
          const target = current.getBoundingClientRect();
          if (target.top < bounds.top || target.bottom > bounds.bottom) {
            panelNav.scrollTo({
              top: Math.max(0, panelNav.scrollTop + target.top - bounds.top - (bounds.height - target.height) / 2),
              behavior: 'instant',
            });
          }
        }
        if (focusCurrentLink) current.focus({ preventScroll: true });
      });
    } else {
      document.documentElement.removeAttribute('data-article-toc-open');
      document.documentElement.removeAttribute('data-article-toc-mode');
      if (page) page.inert = false;
      if (restoreFocus) toggle.focus();
    }
  };

  const closeOverlayOnContentScroll = () => {
    if (open && root.dataset.mode === 'overlay') setOpen(false);
  };

  const resetAutomaticWidth = () => {
    manualWidth = null;
    clearStoredWidth();
    syncResetControl();
    refreshAutomaticWidth();
  };

  const setManualWidth = (value: number, persist: boolean) => {
    manualWidth = clamp(value, minWidth, maxWidth);
    syncResetControl();
    applyWidth(manualWidth);
    if (persist) saveManualWidth();
  };

  toggle?.addEventListener('click', (event) => setOpen(!open, open, event.detail === 0));
  backdrop?.addEventListener('click', () => setOpen(false, true));
  backdrop?.addEventListener('wheel', closeOverlayOnContentScroll, { passive: true });
  backdrop?.addEventListener('touchmove', closeOverlayOnContentScroll, { passive: true });
  resetButton?.addEventListener('click', resetAutomaticWidth);

  root.querySelectorAll<HTMLAnchorElement>('[data-article-toc-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const slug = link.dataset.slug;
      const content = document.querySelector<HTMLElement>('.prose');
      const target = slug ? content?.querySelector<HTMLElement>(`#${CSS.escape(slug)}`) : null;
      if (!target || !slug) return;
      event.preventDefault();
      const overlay = root.dataset.mode === 'overlay';
      if (overlay) setOpen(false);
      const url = new URL(location.href);
      url.hash = slug;
      history.pushState(null, '', url);

      const targetTop = window.scrollY + target.getBoundingClientRect().top;
      const headerHidden = document.querySelector('.site-header')?.classList.contains('is-hidden') ?? false;
      const topOffset = headingTopOffset(!headerHidden);
      const maximumScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const nextScrollY = clamp(targetTop - topOffset, 0, maximumScroll);
      if (Math.abs(nextScrollY - window.scrollY) > 1) {
        window.dispatchEvent(new CustomEvent('site:toc-jump', { detail: { scrollY: nextScrollY } }));
      }
      window.scrollTo({ top: nextScrollY, behavior: 'instant' });
      activeLinks().forEach((item) => {
        if (item === link) item.setAttribute('aria-current', 'location');
        else item.removeAttribute('aria-current');
      });
    });
  });

  resizer?.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    resizer.setPointerCapture(event.pointerId);
    root.dataset.resizing = 'true';
    document.documentElement.dataset.articleTocResizing = 'true';
  });

  resizer?.addEventListener('pointermove', (event) => {
    if (!resizer.hasPointerCapture(event.pointerId)) return;
    pendingDragWidth = event.clientX - panelEdge();
    if (dragFrame) return;
    dragFrame = requestAnimationFrame(() => {
      dragFrame = 0;
      setManualWidth(pendingDragWidth, false);
    });
  });

  const finishResize = (event: PointerEvent) => {
    if (!resizer?.hasPointerCapture(event.pointerId)) return;
    resizer.releasePointerCapture(event.pointerId);
    delete root.dataset.resizing;
    document.documentElement.removeAttribute('data-article-toc-resizing');
    saveManualWidth();
  };
  resizer?.addEventListener('pointerup', finishResize);
  resizer?.addEventListener('pointercancel', finishResize);
  resizer?.addEventListener('dblclick', resetAutomaticWidth);
  resizer?.addEventListener('keydown', (event) => {
    if (event.key === 'Home') {
      event.preventDefault();
      resetAutomaticWidth();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.shiftKey ? 24 : 8;
    setManualWidth(currentWidth + (event.key === 'ArrowRight' ? step : -step), true);
  });

  addEventListener('scroll', () => {
    closeOverlayOnContentScroll();
    queueActiveHeadingUpdate();
  }, { passive: true });
  addEventListener('resize', () => {
    const nextLayoutWidth = layoutViewportWidth();
    if (nextLayoutWidth !== previousLayoutWidth) {
      previousLayoutWidth = nextLayoutWidth;
      applyWidth(preferredWidth());
    }
    queueActiveHeadingUpdate();
  }, { passive: true });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) setOpen(false, true);
  });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => {
      if (measurementFrame) return;
      measurementFrame = requestAnimationFrame(() => {
        measurementFrame = 0;
        syncPanelHeight();
        updateLayoutMode();
      });
    });
    // Font and stylesheet loading can resize the contents after initialization.
    // Watching only the clipped panel leaves an early, undersized measurement stuck.
    observer.observe(panel ?? root);
    if (panelHeader) observer.observe(panelHeader);
    const list = root.querySelector<HTMLOListElement>('.article-toc-nav > ol');
    if (list) observer.observe(list);
  }
  manualWidth = readStoredWidth();
  syncResetControl();
  syncLabels();
  refreshAutomaticWidth();
  if (manualWidth !== null) applyWidth(manualWidth);
  updateActiveHeading();
  void document.fonts?.ready.then(() => {
    if (manualWidth === null) refreshAutomaticWidth();
    else syncPanelHeight();
    updateLayoutMode();
    queueActiveHeadingUpdate();
  });
  const refreshMeasurements = () => {
    if (manualWidth === null) refreshAutomaticWidth();
    else applyWidth(manualWidth);
    queueActiveHeadingUpdate();
  };
  if (document.readyState === 'complete') refreshMeasurements();
  else addEventListener('load', refreshMeasurements, { once: true });
  addEventListener('pageshow', refreshMeasurements);
}

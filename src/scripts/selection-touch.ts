interface TouchSliderOptions {
  options: () => HTMLElement[];
  selected: () => HTMLElement | null | undefined;
  preview: (option: HTMLElement) => void;
  reset: () => void;
  vertical: boolean;
}

export const installTouchSlider = (group: HTMLElement, config: TouchSliderOptions) => {
  let gesture: { id: number; x: number; y: number; dragging: boolean } | undefined;
  let suppressClick = false;
  let committing = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  const at = (x: number, y: number) => {
    const bounds = group.getBoundingClientRect();
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return;
    const options = config.options();
    const hit = options.find((option) => {
      const r = option.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    if (hit) return hit;
    // Small gaps between options should settle on the nearest choice.
    return options.reduce<HTMLElement | undefined>((nearest, option) => {
      const distance = (element: HTMLElement) => {
        const r = element.getBoundingClientRect();
        return Math.abs(config.vertical ? y - (r.top + r.bottom) / 2 : x - (r.left + r.right) / 2);
      };
      return !nearest || distance(option) < distance(nearest) ? option : nearest;
    }, undefined);
  };
  const reset = () => {
    const id = gesture?.id;
    gesture = undefined;
    group.classList.remove('is-slider-dragging');
    if (id !== undefined && group.hasPointerCapture(id)) group.releasePointerCapture(id);
    config.reset();
  };
  const suppressNativeClick = () => {
    suppressClick = true;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { suppressClick = false; }, 500);
  };
  group.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    const option = at(event.clientX, event.clientY);
    if (!option || (config.vertical && option !== config.selected())) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
  });
  group.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = Math.abs(event.clientX - gesture.x);
    const dy = Math.abs(event.clientY - gesture.y);
    const along = config.vertical ? dy : dx;
    const across = config.vertical ? dx : dy;
    if (!gesture.dragging) {
      if (Math.max(along, across) < 8) return;
      if (across > along) { reset(); return; }
      gesture.dragging = true;
      group.setPointerCapture(event.pointerId);
      group.classList.add('is-slider-dragging');
    }
    event.preventDefault();
    if (!config.vertical && group.scrollWidth > group.clientWidth) {
      const r = group.getBoundingClientRect();
      if (event.clientX < r.left + 24) group.scrollLeft -= 12;
      else if (event.clientX > r.right - 24) group.scrollLeft += 12;
    }
    const option = at(event.clientX, event.clientY);
    if (option) config.preview(option);
  }, { passive: false });
  group.addEventListener('pointerup', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.dragging) { reset(); return; }
    event.preventDefault();
    const option = at(event.clientX, event.clientY);
    suppressNativeClick();
    reset();
    if (option) {
      committing = true;
      try { option.click(); } finally { committing = false; }
    }
  });
  group.addEventListener('pointercancel', reset);
  group.addEventListener('lostpointercapture', () => { if (gesture) reset(); });
  group.addEventListener('click', (event) => {
    if (!suppressClick || committing) return;
    suppressClick = false;
    clearTimeout(clickTimer);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
};

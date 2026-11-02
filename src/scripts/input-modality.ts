export {};

// Touch browsers may retain :hover after release. Gate decorative hover without
// blurring controls or changing real keyboard focus and selected states.
let modality = matchMedia('(hover: none)').matches ? 'touch' : 'pointer';
const apply = () => { document.documentElement.dataset.inputModality = modality; };
const update = (event: PointerEvent) => {
  const next = event.pointerType === 'touch' ? 'touch' : 'pointer';
  if (next === modality) return;
  modality = next;
  apply();
};
document.addEventListener('pointerdown', update, { capture: true, passive: true });
document.addEventListener('pointermove', update, { capture: true, passive: true });
document.addEventListener('astro:before-swap', (event) => {
  (event as Event & { newDocument: Document }).newDocument.documentElement.dataset.inputModality = modality;
});
apply();

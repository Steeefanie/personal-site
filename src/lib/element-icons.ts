import type { Element } from './four-elements';

/** Shared SVG paths for the website and vector PDF export, in a 24 x 24 viewBox. */
export const elementIconPaths: Record<Element, string[]> = {
  water: ['M12 2.5C9.6 6.1 5.5 10.3 5.5 14a6.5 6.5 0 0 0 13 0c0-3.7-4.1-7.9-6.5-11.5ZM9 14.5a3.2 3.2 0 0 0 3.2 3.2'],
  fire: ['M13 2.5c1.5 4.7-2 5.3-.8 9.1 1.5-.8 2.4-2.3 2.8-4.1 2.3 2.1 4 4.6 4 7.2a7 7 0 0 1-14 0c0-2.8 1.5-5.2 3.5-7.1-.2 2.2.3 3.6 1.2 4.3C8.8 7.5 12.3 6.1 13 2.5Z'],
  earth: ['m3 18 6-11 4.5 7 2.5-4 5 8H3ZM7 11l2 2 2-2M3 21h18'],
  wind: ['M3 8h12a3 3 0 1 0-3-3M3 12h16a2.5 2.5 0 1 1-2.5 2.5M3 16h7a2.5 2.5 0 1 1-2.5 2.5'],
};

import { axisAngle, type Result } from './seven-traits.ts';
export const radarLayouts = {
  desktop: { width: 720, height: 640, cx: 360, cy: 310, radius: 210, labelScale: 1.16 },
  mobile: { width: 360, height: 380, cx: 180, cy: 180, radius: 98, labelScale: 1.2 },
};
export function radarGeometry(result: Result, compact = false) {
  const layout = compact ? radarLayouts.mobile : radarLayouts.desktop;
  const point = (index: number, value: number) => {
    const angle = axisAngle(index) * Math.PI / 180;
    return { x: layout.cx + Math.sin(angle) * layout.radius * value / 100, y: layout.cy - Math.cos(angle) * layout.radius * value / 100 };
  };
  const ordered = [...result].sort((a, b) => axisAngle(a.index) - axisAngle(b.index));
  return { ...layout, center: { x: layout.cx, y: layout.cy },
    grid: [20, 40, 60, 80, 100].map(value => ordered.map(d => point(d.index, value))),
    axes: ordered.map(d => point(d.index, 100)),
    sides: [0, 1].map(side => ordered.filter(d => d.index % 2 === side).map(d => point(d.index, d.score))),
    labels: result.map(d => ({ ...point(d.index, 100 * layout.labelScale), text: `${d.name} ${d.score.toFixed(1)}`, side: d.index % 2 })),
  };
}

import { type Result } from '../lib/seven-traits.ts';
import { radarGeometry } from '../lib/seven-traits-chart-layout.ts';
export function radar(result: Result, compact = false) {
  const ns = 'http://www.w3.org/2000/svg', geometry = radarGeometry(result, compact);
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${geometry.width} ${geometry.height}`);
  svg.setAttribute('width', String(geometry.width)); svg.setAttribute('height', String(geometry.height));
  svg.classList.add('st-chart', compact ? 'st-chart-mobile' : 'st-chart-desktop');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '十四维倾向雷达图，各维度名称及分数。');
  svg.setAttribute('style', 'background:var(--surface-soft,#fff);font-family:system-ui,"Microsoft YaHei",sans-serif');
  const add = (tag: string, attrs: Record<string, string>, text?: string) => { const el = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); if(text) el.textContent=text; svg.append(el); };
  const points = (items: {x:number;y:number}[]) => items.map(p=>`${p.x},${p.y}`).join(' ');
  add('rect', {width:String(geometry.width),height:String(geometry.height),fill:'var(--surface-soft,#fff)'});
  geometry.grid.forEach(layer=>add('polygon',{points:points(layer),fill:'none',stroke:'var(--border,#dfe2e5)','stroke-width':'1'}));
  geometry.axes.forEach(p=>add('line',{x1:String(geometry.cx),y1:String(geometry.cy),x2:String(p.x),y2:String(p.y),stroke:'var(--border,#dfe2e5)'}));
  geometry.sides.forEach((data,side)=>{
    const color=side ? 'var(--st-virtue,#aa4956)' : 'var(--st-sin,#23486f)';
    add('polygon',{points:points([geometry.center,...data,geometry.center]),fill:color,'fill-opacity':'.22',stroke:color,'stroke-width':compact?'1.5':'2'});
    data.forEach(p=>add('circle',{cx:String(p.x),cy:String(p.y),r:compact?'2.5':'3.5',fill:color}));
  });
  geometry.labels.forEach(label=>add('text',{x:String(label.x),y:String(label.y),fill:label.side?'var(--st-virtue,#aa4956)':'var(--st-sin,#23486f)','font-size':compact?'10':'12','text-anchor':label.side?'start':'end','dominant-baseline':'middle'},label.text));
  // Compensate for viewBox scaling so labels keep their requested screen size.
  const observer = new ResizeObserver(() => {
    if (!svg.isConnected) { observer.disconnect(); return; }
    const width = svg.getBoundingClientRect().width;
    if (!width) return;
    const size = (compact ? 10 : 12) * geometry.width / width;
    svg.querySelectorAll('text').forEach(label => label.setAttribute('font-size', String(size)));
  });
  observer.observe(svg);
  return svg;
}

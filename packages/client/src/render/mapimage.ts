import { isExplored, type WorldMap } from '@vale/shared';
import type { MapState } from '../session/types';

/* ---------- Mapa do mundo e minimapa: o terreno pintado a partir dos tiles, com névoa no que não foi visto ---------- */
export const PX = 8;   // pixels por tile no mapa (o painel e o minimapa escalam)
const COLOR: Record<string, string> = {
  '.': '#5cae4a', ',': '#4f9a3e', f: '#69b654', g: '#448f38', p: '#c9a46a', d: '#b58b55', x: '#9a9690',
  T: '#2f6b2e', b: '#3d8a3a', r: '#8a8c93', w: '#3f7fd0', k: '#8a5a33', c: '#7a5236', s: '#c9a46a', o: '#b8b2a6',
  q: '#3b3350', W: '#1d1828', h: '#5a3a26', u: '#6a6080', t: '#c9a46a', X: '#7a5236', Y: '#1d1828',
  j: '#3b3350', G: '#55575f', I: '#1d1828', B: '#8f897f', P: '#a39d92', Q: '#8f897f'
};
const FOG = '#0e0c22';

// Terreno: refeito quando o mapa muda (outro mapa, ou tiles alterados).
let terrain: HTMLCanvasElement | null = null, terrainKey = '';
function paintTerrain(map: WorldMap) {
  const key = map.data.name + '|' + map.version;
  if (terrain && key === terrainKey) return terrain;
  const c = document.createElement('canvas'); c.width = map.cols * PX; c.height = map.rows * PX;
  const x = c.getContext('2d')!;
  for (let ty = 0; ty < map.rows; ty++) for (let tx = 0; tx < map.cols; tx++) {
    const t = map.tiles[ty][tx], X = tx * PX, Y = ty * PX;
    x.fillStyle = COLOR[t] ?? '#5cae4a'; x.fillRect(X, Y, PX, PX);
    if (t === 'T') { x.fillStyle = '#245524'; x.fillRect(X + 2, Y + 2, PX - 4, PX - 4); }
    else if (t === 'w' && (tx + ty) % 3 === 0) { x.fillStyle = '#6fa6e6'; x.fillRect(X + 1, Y + 3, 3, 1); }
    else if (t === 'f') { x.fillStyle = '#f2c4d8'; x.fillRect(X + 3, Y + 3, 2, 2); }
    else if (t === 't') { x.fillStyle = '#f2a24e'; x.fillRect(X + 3, Y + 1, 2, 3); }
  }
  terrain = c; terrainKey = key;
  return c;
}
// Terreno + névoa. Refeito só quando o terreno ou o explorado mudam.
let comp: HTMLCanvasElement | null = null, compKey = '';
export function mapImage(map: WorldMap, st: MapState) {
  const t = paintTerrain(map);
  let seen = 0; for (const b of st.explored) seen = (seen * 31 + b) | 0;
  const key = terrainKey + '|' + seen + '|' + st.explored.length;
  if (comp && key === compKey) return comp;
  const c = comp ?? document.createElement('canvas');
  c.width = t.width; c.height = t.height;
  const x = c.getContext('2d')!;
  x.drawImage(t, 0, 0);
  for (let ty = 0; ty < map.rows; ty++) for (let tx = 0; tx < map.cols; tx++) {
    if (isExplored(st.explored, map.cols, tx, ty)) continue;
    x.fillStyle = FOG; x.fillRect(tx * PX, ty * PX, PX, PX);
    if ((tx + ty) & 1) { x.fillStyle = '#16132e'; x.fillRect(tx * PX + 2, ty * PX + 2, 2, 2); }
  }
  comp = c; compKey = key;
  return c;
}
export const seenAt = (map: WorldMap, st: MapState, px: number, py: number) => {
  const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
  return map.inBounds(tx, ty) && isExplored(st.explored, map.cols, tx, ty);
};

/* ---------- Marcas desenhadas por cima (em pixels do mapa: 1 tile = PX) ---------- */
type Ctx = CanvasRenderingContext2D;
export function dot(x: Ctx, cx: number, cy: number, r: number, fill: string) {
  x.fillStyle = '#1b1226'; x.beginPath(); x.arc(cx, cy, r + 1, 0, Math.PI * 2); x.fill();
  x.fillStyle = fill; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
}
// Marcador "venham aqui!": um alfinete vermelho.
export function pin(x: Ctx, cx: number, cy: number, s = 1) {
  x.fillStyle = '#1b1226'; x.beginPath(); x.moveTo(cx, cy + 1); x.lineTo(cx - 4 * s - 1, cy - 6 * s); x.lineTo(cx + 4 * s + 1, cy - 6 * s); x.fill();
  x.beginPath(); x.arc(cx, cy - 7 * s, 4 * s + 1, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#e0453b'; x.beginPath(); x.moveTo(cx, cy - 1); x.lineTo(cx - 4 * s, cy - 6 * s); x.lineTo(cx + 4 * s, cy - 6 * s); x.fill();
  x.beginPath(); x.arc(cx, cy - 7 * s, 4 * s, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff4ee'; x.fillRect(Math.round(cx - 1 * s), Math.round(cy - 8 * s), Math.max(1, Math.round(2 * s)), Math.max(1, Math.round(2 * s)));
}
// Porta, entrada de caverna ou de masmorra (portal): um arco escuro com moldura lilás.
export function door(x: Ctx, cx: number, cy: number, s = 1) {
  const arch = (w: number, h: number) => { x.beginPath(); x.moveTo(cx - w, cy + h); x.lineTo(cx - w, cy - h + w); x.arc(cx, cy - h + w, w, Math.PI, 0); x.lineTo(cx + w, cy + h); x.closePath(); x.fill(); };
  x.fillStyle = '#1b1226'; arch(5 * s + 1, 6 * s + 1);
  x.fillStyle = '#c79bf0'; arch(5 * s, 6 * s);
  x.fillStyle = '#1b1226'; arch(2.6 * s, 3.8 * s);
}
// Você: uma seta amarela apontando para onde olha.
export function meArrow(x: Ctx, cx: number, cy: number, dir: number, s = 1) {
  const a = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][dir] ?? 0, ca = Math.cos(a), sa = Math.sin(a);
  const P = (f: number, q: number): [number, number] => [cx + ca * f * s - sa * q * s, cy + sa * f * s + ca * q * s];
  const tri = (k: number, color: string) => { x.fillStyle = color; x.beginPath(); x.moveTo(...P(5 + k, 0)); x.lineTo(...P(-4 - k, -4 - k)); x.lineTo(...P(-2, 0)); x.lineTo(...P(-4 - k, 4 + k)); x.fill(); };
  tri(1.2, '#1b1226'); tri(0, '#ffe66b');
}
export function label(x: Ctx, text: string, cx: number, cy: number, size: number, color = '#f6f2fc') {
  x.font = `${size}px "Pixelify Sans", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = Math.max(2, size / 4); x.strokeStyle = '#1b1226'; x.strokeText(text, cx, cy);
  x.fillStyle = color; x.fillText(text, cx, cy);
}

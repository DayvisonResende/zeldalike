import { GRASSY, TS, hash, type WorldMap } from '@vale/shared';
import { OBJ, mk } from './sprites';

/* ---------- Tiles: pintados uma vez por variação e guardados em cache ---------- */
type Ctx = CanvasRenderingContext2D;
const GR = { base: '#6cb04a', dk: '#4f9238', lt: '#8fd05f' };
const tc = new Map<string, HTMLCanvasElement>();
function tileImg(key: string, fn: (x: Ctx) => void) { let c = tc.get(key); if (!c) { c = mk(16, 16); fn(c.getContext('2d')!); tc.set(key, c); } return c; }

function paintGrass(x: Ctx, v: number, dense: boolean) {
  x.fillStyle = GR.base; x.fillRect(0, 0, 16, 16);
  const n = dense ? 7 : 3;
  for (let k = 0; k < n; k++) {
    const hx = (hash(v, k, 1) * 13) | 0, hy = 2 + ((hash(v, k, 2) * 12) | 0);
    x.fillStyle = GR.dk; x.fillRect(hx, hy, 1, 2); x.fillRect(hx + 2, hy, 1, 2); x.fillRect(hx + 1, hy + 1, 1, 1);
    x.fillStyle = GR.lt; x.fillRect(hx + 1, hy - 1, 1, 1);
  }
}
function paintFlowers(x: Ctx, v: number) {
  paintGrass(x, v, false);
  for (let k = 0; k < 3; k++) {
    const fx = 2 + ((hash(v, k, 12) * 12) | 0), fy = 2 + ((hash(v, k, 13) * 12) | 0);
    x.fillStyle = (k + v) % 2 ? '#fff6e8' : '#f39ac0';
    x.fillRect(fx - 1, fy, 3, 1); x.fillRect(fx, fy - 1, 1, 3);
    x.fillStyle = '#f5c542'; x.fillRect(fx, fy, 1, 1);
  }
}
function paintTall(x: Ctx) {
  x.fillStyle = '#5d9f3e'; x.fillRect(0, 0, 16, 16);
  ([[1, 7], [9, 7], [5, 14], [11, 15]] as const).forEach(([bx, by]) => {
    x.fillStyle = '#3f7d2d';
    x.fillRect(bx, by - 3, 1, 3); x.fillRect(bx + 2, by - 4, 1, 4); x.fillRect(bx + 4, by - 3, 1, 3); x.fillRect(bx, by, 5, 1);
    x.fillStyle = '#93d464';
    x.fillRect(bx, by - 4, 1, 1); x.fillRect(bx + 2, by - 5, 1, 1); x.fillRect(bx + 4, by - 4, 1, 1);
  });
}
function edgeLoop(fn: (i: number, h: number) => void) { for (let i = 0; i < 16; i++) fn(i, ((i >> 1) % 2) ? 2 : 1); }
function paintPath(x: Ctx, v: number, m: number) {
  x.fillStyle = '#d3ac70'; x.fillRect(0, 0, 16, 16);
  for (let k = 0; k < 6; k++) { x.fillStyle = k % 2 ? '#b78f57' : '#e4c792'; x.fillRect((hash(v, k, 3) * 15) | 0, (hash(v, k, 4) * 15) | 0, k % 3 ? 1 : 2, 1); }
  const g = GR.base, e = '#a8834e';
  if (m & 1) edgeLoop((i, h) => { x.fillStyle = g; x.fillRect(i, 0, 1, h); x.fillStyle = e; x.fillRect(i, h, 1, 1); });
  if (m & 4) edgeLoop((i, h) => { x.fillStyle = g; x.fillRect(i, 16 - h, 1, h); x.fillStyle = e; x.fillRect(i, 15 - h, 1, 1); });
  if (m & 8) edgeLoop((i, h) => { x.fillStyle = g; x.fillRect(0, i, h, 1); x.fillStyle = e; x.fillRect(h, i, 1, 1); });
  if (m & 2) edgeLoop((i, h) => { x.fillStyle = g; x.fillRect(16 - h, i, h, 1); x.fillStyle = e; x.fillRect(15 - h, i, 1, 1); });
}
function paintStone(x: Ctx, v: number, m: number) {
  x.fillStyle = '#aca59b'; x.fillRect(0, 0, 16, 16);
  x.fillStyle = '#8c867c'; x.fillRect(0, 7, 16, 1); x.fillRect(0, 15, 16, 1); x.fillRect(7, 0, 1, 7); x.fillRect(15, 0, 1, 7); x.fillRect(3, 8, 1, 7); x.fillRect(11, 8, 1, 7);
  x.fillStyle = '#c6bfb4'; x.fillRect(0, 0, 7, 1); x.fillRect(8, 0, 7, 1); x.fillRect(0, 8, 3, 1); x.fillRect(4, 8, 7, 1); x.fillRect(12, 8, 4, 1);
  if (v === 1) { x.fillStyle = '#8c867c'; x.fillRect(4, 3, 2, 1); x.fillRect(5, 4, 1, 1); }
  if (v === 3) { x.fillStyle = '#7fa05a'; x.fillRect(12, 6, 2, 1); x.fillRect(1, 14, 2, 1); }
  x.fillStyle = '#6f695f';
  if (m & 1) x.fillRect(0, 0, 16, 1); if (m & 4) x.fillRect(0, 15, 16, 1);
  if (m & 8) x.fillRect(0, 0, 1, 16); if (m & 2) x.fillRect(15, 0, 1, 16);
}
function paintWater(x: Ctx, v: number, f: number, m: number) {
  x.fillStyle = '#3e7dcb'; x.fillRect(0, 0, 16, 16);
  for (let k = 0; k < 3; k++) {
    const wx = ((hash(v, k, 5) * 16) | 0) + f, wy = 3 + ((hash(v, k, 6) * 10) | 0);
    x.fillStyle = k === 0 ? '#9fcaf5' : '#5b97dd';
    ([[0, 0], [1, -1], [2, -1], [3, 0]] as const).forEach(([a, b]) => x.fillRect((wx + a) % 16, wy + b, 1, 1));
  }
  const dk = '#2b5a98', fo = '#d8ecff';
  if (m & 1) { x.fillStyle = dk; x.fillRect(0, 0, 16, 1); x.fillStyle = fo; for (let i = 0; i < 16; i += 3) x.fillRect((i + f) % 16, 1, 2, 1); }
  if (m & 4) { x.fillStyle = dk; x.fillRect(0, 15, 16, 1); x.fillStyle = fo; for (let i = 0; i < 16; i += 3) x.fillRect((i + 15 - f) % 16, 14, 2, 1); }
  if (m & 8) { x.fillStyle = dk; x.fillRect(0, 0, 1, 16); x.fillStyle = fo; for (let i = 0; i < 16; i += 3) x.fillRect(1, (i + f) % 16, 1, 2); }
  if (m & 2) { x.fillStyle = dk; x.fillRect(15, 0, 1, 16); x.fillStyle = fo; for (let i = 0; i < 16; i += 3) x.fillRect(14, (i + 15 - f) % 16, 1, 2); }
}
function paintBridge(x: Ctx, m: number) {
  x.fillStyle = '#ab7646'; x.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y += 4) { x.fillStyle = '#c99260'; x.fillRect(0, y, 16, 1); x.fillStyle = '#7c4f2b'; x.fillRect(0, y + 3, 16, 1); }
  if (m & 8) { x.fillStyle = '#5e3a1f'; x.fillRect(0, 0, 2, 16); x.fillStyle = '#8a5a33'; x.fillRect(0, 0, 1, 16); }
  if (m & 2) { x.fillStyle = '#5e3a1f'; x.fillRect(14, 0, 2, 16); x.fillStyle = '#8a5a33'; x.fillRect(15, 0, 1, 16); }
}
function paintCliff(x: Ctx, v: number, m: number) {
  x.fillStyle = '#9b6641'; x.fillRect(0, 0, 16, 16);
  for (let k = 0; k < 6; k++) {
    const cx = (hash(v, k, 8) * 15) | 0, cy = (hash(v, k, 9) * 12) | 0, len = 3 + ((hash(v, k, 10) * 4) | 0);
    x.fillStyle = '#744629'; x.fillRect(cx, cy, 1, len); x.fillStyle = '#ba824f'; x.fillRect(cx + 1, cy, 1, len);
  }
  x.fillStyle = '#80502f'; x.fillRect(0, 9, 16, 1);
  if (m & 1) {
    for (let i = 0; i < 16; i++) { const h = 3 + ((hash(v, i, 14) * 2) | 0); x.fillStyle = GR.base; x.fillRect(i, 0, 1, h); x.fillStyle = '#3e7a2e'; x.fillRect(i, h, 1, 1); }
    x.fillStyle = GR.lt; x.fillRect(3, 0, 2, 1); x.fillRect(10, 1, 1, 1);
  }
  if (m & 4) { x.fillStyle = '#5a3721'; x.fillRect(0, 14, 16, 2); }
}

// Vizinhos fora do mapa contam como iguais ao tile, para a borda do mundo não ganhar contorno.
function nb(map: WorldMap, tx: number, ty: number, self: string) { return map.inBounds(tx, ty) ? map.tiles[ty][tx] : self; }
function maskOf(map: WorldMap, tx: number, ty: number, test: (c: string) => boolean) {
  const s = map.tiles[ty][tx]; let m = 0;
  if (test(nb(map, tx, ty - 1, s))) m |= 1; if (test(nb(map, tx + 1, ty, s))) m |= 2;
  if (test(nb(map, tx, ty + 1, s))) m |= 4; if (test(nb(map, tx - 1, ty, s))) m |= 8;
  return m;
}
export function tileFor(map: WorldMap, tx: number, ty: number, wf: number) {
  const c = map.tiles[ty][tx], v = (hash(tx, ty, 11) * 4) | 0;
  switch (c) {
    case '.': return tileImg('.' + v, x => paintGrass(x, v, false));
    case ',': return tileImg(',' + v, x => paintGrass(x, v + 10, true));
    case 'f': return tileImg('f' + v, x => paintFlowers(x, v));
    case 'g': return tileImg('g', paintTall);
    case 'p': case 'd': { const m = maskOf(map, tx, ty, ch => GRASSY.has(ch)); return tileImg(c + v + '_' + m, x => paintPath(x, v + (c === 'd' ? 20 : 0), m)); }
    case 'x': { const m = maskOf(map, tx, ty, ch => GRASSY.has(ch)); return tileImg('x' + v + '_' + m, x => paintStone(x, v, m)); }
    case 'w': { const m = maskOf(map, tx, ty, ch => ch !== 'w' && ch !== 'k'), vv = v % 3; return tileImg('w' + vv + '_' + wf + '_' + m, x => paintWater(x, vv, wf, m)); }
    case 'k': { const m = maskOf(map, tx, ty, ch => ch !== 'k'); return tileImg('k' + m, x => paintBridge(x, m)); }
    case 'c': { const m = (nb(map, tx, ty - 1, 'c') !== 'c' ? 1 : 0) | (nb(map, tx, ty + 1, 'c') !== 'c' ? 4 : 0); return tileImg('c' + v + '_' + m, x => paintCliff(x, v, m)); }
    case 'o': return tileImg('o' + v, x => { paintStone(x, v, 0); x.drawImage(OBJ.o, 0, 0); });
    default: return tileImg(c + v, x => { paintGrass(x, v, false); x.drawImage(OBJ[c], 0, 0); });
  }
}
// Só os tiles que aparecem na câmera.
export function drawTiles(ctx: Ctx, map: WorldMap, cx: number, cy: number, w: number, h: number, wf: number) {
  const tx0 = Math.max(0, Math.floor(cx / TS)), ty0 = Math.max(0, Math.floor(cy / TS));
  const tx1 = Math.min(map.cols - 1, Math.floor((cx + w - 1) / TS)), ty1 = Math.min(map.rows - 1, Math.floor((cy + h - 1) / TS));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) ctx.drawImage(tileFor(map, tx, ty, wf), tx * TS, ty * TS);
}

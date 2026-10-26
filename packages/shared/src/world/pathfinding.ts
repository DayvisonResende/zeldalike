import { D, TS } from '../constants';
import type { WorldMap } from './map';
import { blocksShot } from './tiles';

// Mapa de distâncias (em passos de tile) até a fonte mais próxima. Infinity = inalcançável.
export interface DistMap { cols: number; d: Float64Array }

export function tileOf(map: WorldMap, x: number, y: number): [number, number] {
  return [Math.max(0, Math.min(map.cols - 1, Math.floor(x / TS))), Math.max(0, Math.min(map.rows - 1, Math.floor(y / TS)))];
}
// BFS a partir de várias fontes ao mesmo tempo: cada tile aponta para a fonte mais perto.
// `maxDist` limita a busca à vizinhança, para não varrer o mundo inteiro.
export function bfs(map: WorldMap, sources: readonly (readonly [number, number])[], maxDist = Infinity): DistMap {
  const cols = map.cols, d = new Float64Array(cols * map.rows).fill(Infinity), q: number[] = [];
  for (const [x, y] of sources) if (!map.solid(x, y) && d[y * cols + x] !== 0) { d[y * cols + x] = 0; q.push(y * cols + x); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % cols, y = (i / cols) | 0, v = d[i] + 1;
    if (v > maxDist) continue;
    for (const [dx, dy] of D) {
      const nx = x + dx, ny = y + dy, j = ny * cols + nx;
      if (map.solid(nx, ny) || d[j] !== Infinity) continue;
      d[j] = v; q.push(j);
    }
  }
  return { cols, d };
}
export function distAt(m: DistMap, tx: number, ty: number) {
  return tx < 0 || ty < 0 || tx >= m.cols ? Infinity : (m.d[ty * m.cols + tx] ?? Infinity);
}
export function nextLower(m: DistMap, x: number, y: number): [number, number] | null {
  let best: [number, number] | null = null, bv = distAt(m, x, y);
  for (const [dx, dy] of D) { const n = distAt(m, x + dx, y + dy); if (n < bv) { bv = n; best = [x + dx, y + dy]; } }
  return best;
}
export function lineOfSight(map: WorldMap, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
  for (let i = 1; i < n; i++) {
    const tx = Math.floor((x0 + (x1 - x0) * i / n) / TS), ty = Math.floor((y0 + (y1 - y0) * i / n) / TS);
    if (!map.inBounds(tx, ty) || blocksShot(map.tiles[ty][tx])) return false;
  }
  return true;
}

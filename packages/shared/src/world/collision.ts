import { TS } from '../constants';
import type { WorldMap } from './map';

export interface Body { x: number; y: number; hw: number; hh: number }

export function blockedAt(map: WorldMap, x: number, y: number, hw: number, hh: number) {
  const x0 = Math.floor((x - hw) / TS), x1 = Math.floor((x + hw - 0.01) / TS), y0 = Math.floor((y - hh) / TS), y1 = Math.floor((y + hh - 0.01) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (map.solid(tx, ty)) return true;
  return false;
}
export function overlapsTile(b: Body, tx: number, ty: number) {
  return b.x + b.hw > tx * TS && b.x - b.hw < (tx + 1) * TS && b.y + b.hh > ty * TS && b.y - b.hh < (ty + 1) * TS;
}
function stepAxis(map: WorldMap, e: Body, dx: number, dy: number) {
  if (!blockedAt(map, e.x + dx, e.y + dy, e.hw, e.hh)) { e.x += dx; e.y += dy; return false; }
  const n = Math.ceil(Math.abs(dx + dy) / 0.25), sx = dx / n, sy = dy / n;
  for (let i = 0; i < n; i++) { if (blockedAt(map, e.x + sx, e.y + sy, e.hw, e.hh)) break; e.x += sx; e.y += sy; }
  return true;
}
// Desliza nas quinas: se há espaço livre a até 7px para o lado, empurra 1px nessa direção.
function nudge(map: WorldMap, e: Body, dx: number, dy: number) {
  const s = Math.sign(dx || dy);
  for (let o = 1; o <= 7; o++) for (const d of [-1, 1]) {
    const nx = dx ? e.x + s : e.x + d * o, ny = dx ? e.y + d * o : e.y + s;
    if (!blockedAt(map, nx, ny, e.hw, e.hh)) {
      if (dx) { if (!blockedAt(map, e.x, e.y + d, e.hw, e.hh)) e.y += d; }
      else if (!blockedAt(map, e.x + d, e.y, e.hw, e.hh)) e.x += d;
      return;
    }
  }
}
// Retorna true se bateu em algo.
export function move(map: WorldMap, e: Body, dx: number, dy: number, slide = false) {
  let b = false;
  if (dx && stepAxis(map, e, dx, 0)) { b = true; if (slide && !dy) nudge(map, e, dx, 0); }
  if (dy && stepAxis(map, e, 0, dy)) { b = true; if (slide && !dx) nudge(map, e, 0, dy); }
  return b;
}

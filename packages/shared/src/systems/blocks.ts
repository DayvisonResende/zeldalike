import { TS, ticks } from '../constants';
import type { Player } from '../entities/player';
import { overlapsTile } from '../world/collision';
import { nearCave } from '../world/tiles';
import type { World } from '../world';
import { sfx } from './fx';

/* ---------- Blocos empurráveis e placas de pressão (estilo Zelda) ---------- */
// Andar contra um bloco (B) por meio segundo o empurra um tile, se o outro lado estiver livre.
// Placa (P) fica apertada com um bloco em cima (Q) ou com alguém de pé nela. Todas as placas de um grupo apertadas:
// os portões perto abrem; uma solta: fecham. Bloco tirado do lugar volta sozinho depois de regrow.block sem ninguém perto.
export const PUSH_TICKS = 30;
const FLOORS = new Set(['.', ',', 'f', 'p', 'd', 'x', 'q', 'P']);
const GROUP = 6, GATES = 8, AWAY = 5;   // tiles
export interface BlockHome { home: [number, number]; at: number }
export const isBlock = (c: string) => c === 'B' || c === 'Q';
const key = (x: number, y: number) => x + ',' + y;
const floorAt = (w: World, tx: number, ty: number) => nearCave((a, b) => w.map.get(a, b), tx, ty) ? 'q' : 'x';
const occupied = (w: World, tx: number, ty: number) => [...w.players.values(), ...w.enemies].some(b => !(b as { dead?: boolean }).dead && overlapsTile(b, tx, ty));

// Chamado pelo controle quando o jogador anda contra algo numa direção só. Devolve true se é um bloco (conta o empurrão).
export function pushAgainst(w: World, p: Player, dx: number, dy: number) {
  const tx = Math.floor((p.x + dx * (p.hw + 1)) / TS), ty = Math.floor((p.y + dy * (p.hh + 1)) / TS);
  if (!isBlock(w.map.get(tx, ty))) return false;
  if (dx ? Math.abs(p.y - (ty * TS + 8)) > 6 : Math.abs(p.x - (tx * TS + 8)) > 6) return false;   // de frente para o bloco, não de quina
  if (++p.shove >= PUSH_TICKS) { p.shove = 0; slideBlock(w, tx, ty, dx, dy, p.id); }
  return true;
}
// Move o bloco um tile, se der. `by`: quem empurrou (o cliente dele já animou).
export function slideBlock(w: World, tx: number, ty: number, dx: number, dy: number, by?: string) {
  const nx = tx + dx, ny = ty + dy, dest = w.map.get(nx, ny);
  if (!w.map.inBounds(nx, ny) || !FLOORS.has(dest) || w.map.solid(nx, ny) || occupied(w, nx, ny)) return false;
  const from = w.map.get(tx, ty);
  w.setTile(tx, ty, from === 'Q' ? 'P' : floorAt(w, tx, ty));
  w.setTile(nx, ny, dest === 'P' ? 'Q' : 'B');
  const h = w.blockHomes.get(key(tx, ty)); w.blockHomes.delete(key(tx, ty));
  const home = h?.home ?? [tx, ty];
  if (home[0] !== nx || home[1] !== ny) w.blockHomes.set(key(nx, ny), { home, at: w.tick + ticks(w.rules.regrow.block) });
  w.emit(by ? { t: 'slide', fx: tx, fy: ty, tx: nx, ty: ny, by } : { t: 'slide', fx: tx, fy: ty, tx: nx, ty: ny });
  sfx(w, 'scrape', { x: nx * TS + 8, y: ny * TS + 8 }, by);
  return true;
}

// Placas do mapa (nunca surgem novas) agrupadas pela distância.
function plateGroups(w: World) {
  if (w.plateGroups) return w.plateGroups;
  const plates: [number, number][] = [];
  w.map.tiles.forEach((r, y) => r.forEach((c, x) => { if (c === 'P' || c === 'Q') plates.push([x, y]); }));
  const groups: [number, number][][] = [], seen = new Set<number>();
  plates.forEach((_, i) => {
    if (seen.has(i)) return;
    const g: [number, number][] = [], q = [i]; seen.add(i);
    while (q.length) {
      const [x, y] = plates[q.pop()!]; g.push([x, y]);
      plates.forEach(([ox, oy], j) => { if (!seen.has(j) && Math.max(Math.abs(ox - x), Math.abs(oy - y)) <= GROUP) { seen.add(j); q.push(j); } });
    }
    groups.push(g);
  });
  return w.plateGroups = groups;
}
const pressed = (w: World, x: number, y: number) => w.map.get(x, y) === 'Q'
  || [...w.players.values()].some(p => p.state !== 'dead' && p.state !== 'flying' && Math.floor(p.x / TS) === x && Math.floor(p.y / TS) === y);

// No servidor, a cada poucos passos: abre/fecha portões das placas e devolve blocos esquecidos.
export function updateBlocks(w: World) {
  if (w.tick % 6) return;
  for (const g of plateGroups(w)) {
    const on = g.every(([x, y]) => pressed(w, x, y));
    const near = (f: (x: number, y: number) => void) => {
      const done = new Set<string>();
      for (const [px, py] of g) for (let y = py - GATES; y <= py + GATES; y++) for (let x = px - GATES; x <= px + GATES; x++) if (!done.has(key(x, y))) { done.add(key(x, y)); f(x, y); }
    };
    let changed = false;
    near((x, y) => {
      if (on && w.map.get(x, y) === 'G') { w.setTile(x, y, floorAt(w, x, y)); w.plateGates.add(key(x, y)); changed = true; }
      else if (!on && w.plateGates.has(key(x, y)) && !occupied(w, x, y)) { w.setTile(x, y, 'G'); w.plateGates.delete(key(x, y)); changed = true; }
    });
    if (changed) { const [x, y] = g[0]; sfx(w, on ? 'chest' : 'thunk', { x: x * TS + 8, y: y * TS + 8 }); }
  }
  if (w.tick % 60) return;
  for (const [k, h] of w.blockHomes) {
    if (w.tick < h.at) continue;
    const [cx, cy] = k.split(',').map(Number), [hx, hy] = h.home;
    const close = (x: number, y: number) => [...w.players.values()].some(p => Math.max(Math.abs(p.x / TS - x - 0.5), Math.abs(p.y / TS - y - 0.5)) < AWAY);
    const nearby = close(cx, cy) || close(hx, hy);   // ninguém mexendo no quebra-cabeça (nem perto de onde o bloco volta)
    const dest = w.map.get(hx, hy);
    if (nearby || !isBlock(w.map.get(cx, cy)) || !FLOORS.has(dest) || occupied(w, hx, hy)) continue;
    w.setTile(cx, cy, w.map.get(cx, cy) === 'Q' ? 'P' : floorAt(w, cx, cy));
    w.setTile(hx, hy, dest === 'P' ? 'Q' : 'B');
    w.blockHomes.delete(k);
    w.emit({ t: 'poof', x: cx * TS + 8, y: cy * TS + 8 }); w.emit({ t: 'poof', x: hx * TS + 8, y: hy * TS + 8 });
  }
}

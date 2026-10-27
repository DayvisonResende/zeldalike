import { D, TS } from '../constants';
import type { Player } from '../entities/player';
import { ITEMS, addItem, canFit, type ItemId } from '../items';
import { hash } from '../rng';
import type { World } from '../world';
import { isNight } from './daynight';
import { sfx, burst } from './fx';

/* ---------- Pesca ----------
   Roda dentro do passo da jogadora (como andar), com sorteios que dependem só de `p.steps`: o cliente prevê exatamente
   a mesma barra que o servidor julga, então o atraso da rede não atrapalha o timing.
   Qual peixe veio (depende da hora e do lugar) e o tamanho só o servidor decide, na hora da captura. */
export type FishPhase = 'wait' | 'bite' | 'reel';
export interface Fishing { phase: FishPhase; t: number; seed: number; biteAt: number; tier: 0 | 1 | 2; zone: number }

// Dificuldade da fisgada: largura da zona (fração da barra) e velocidade do cursor.
export const TIERS = [{ zone: 0.3, speed: 1 }, { zone: 0.2, speed: 1.35 }, { zone: 0.12, speed: 1.8 }] as const;
const BITE_WINDOW = 45;    // passos para fisgar depois do "!" (0,75 s)
const REEL_LIMIT = 300;    // passos para acertar a zona (5 s)

export interface FishDef { item: ItemId; tier: 0 | 1 | 2; weight: number; min: number; max: number; when?: 'night'; where?: 'cave' | 'outside' }
export const FISH: FishDef[] = [
  { item: 'lambari', tier: 0, weight: 60, min: 6, max: 15, where: 'outside' },
  { item: 'boot', tier: 0, weight: 15, min: 0, max: 0 },
  { item: 'tilapia', tier: 1, weight: 50, min: 15, max: 40, where: 'outside' },
  { item: 'blindfish', tier: 1, weight: 60, min: 10, max: 30, where: 'cave' },
  { item: 'trout', tier: 2, weight: 40, min: 30, max: 60, where: 'outside' },
  { item: 'moonfish', tier: 2, weight: 50, min: 20, max: 50, when: 'night', where: 'outside' }
];

// Posição da boia: um pouco à frente de quem pesca (todo mundo calcula igual, sem precisar enviar).
export const bobberOf = (p: { x: number; y: number; dir: 0 | 1 | 2 | 3 }) => ({ x: p.x + D[p.dir][0] * 22, y: p.y + D[p.dir][1] * 20 - 2 });
// Cursor da barra (0..1) e onde fica a zona verde.
export function reelCursor(f: Fishing) { return (Math.sin(f.t * 0.07 * TIERS[f.tier].speed - Math.PI / 2) + 1) / 2; }

// Água bem na frente? Então dá para pescar.
export function waterAhead(w: World, p: Player) {
  const b = bobberOf(p), tx = Math.floor(b.x / TS), ty = Math.floor((b.y + 2) / TS);
  return w.map.inBounds(tx, ty) && w.map.tiles[ty][tx] === 'w';
}
export function cast(w: World, p: Player) {
  const r = (k: number) => hash(p.steps, k, p.dir + 7);
  const roll = r(2);
  p.fish = { phase: 'wait', t: 0, seed: p.steps, biteAt: 90 + Math.floor(r(1) * 240), tier: roll < 0.55 ? 0 : roll < 0.88 ? 1 : 2, zone: 0.25 + r(3) * 0.5 };
  p.state = 'fish';
  const b = bobberOf(p);
  sfx(w, 'cast', b, p.id);
}
function stop(p: Player) { p.fish = null; p.state = 'walk'; }

// Um passo de pesca: `tap` = apertou E/F neste passo; `moving` = mexeu as setas (recolhe a linha).
export function updateFishing(w: World, p: Player, tap: boolean, moving: boolean) {
  const f = p.fish;
  if (!f || moving) { if (f) w.emit({ t: 'notice', to: p.id, text: 'Você recolheu a linha.' }); stop(p); return; }
  f.t++;
  const b = bobberOf(p);
  if (f.phase === 'wait') {
    if (tap) { w.emit({ t: 'notice', to: p.id, text: 'Ainda não mordeu…' }); return; }
    if (f.t >= f.biteAt) { f.phase = 'bite'; f.t = 0; sfx(w, 'bite', b, p.id); burst(w, b.x, b.y, 'water', 4, { s: 0.5, z: 0, up: 1.2 }, p.id); }
  } else if (f.phase === 'bite') {
    if (tap) { f.phase = 'reel'; f.t = 0; return; }
    if (f.t > BITE_WINDOW) { w.emit({ t: 'notice', to: p.id, text: 'O peixe soltou a isca.' }); stop(p); }
  } else {
    if (tap) {
      if (Math.abs(reelCursor(f) - f.zone) <= TIERS[f.tier].zone / 2) catchFish(w, p, f);
      else { w.emit({ t: 'notice', to: p.id, text: 'Escapou!' }); sfx(w, 'splash', b, p.id); }
      stop(p);
    } else if (f.t > REEL_LIMIT) { w.emit({ t: 'notice', to: p.id, text: 'Escapou!' }); stop(p); }
  }
}

// O servidor decide qual peixe veio (da dificuldade sorteada, da hora e do lugar) e o tamanho.
function catchFish(w: World, p: Player, f: Fishing) {
  const cave = !!w.map.data.dark, night = isNight(w);
  const pool = FISH.filter(x => x.tier === f.tier && (!x.when || night) && (!x.where || (x.where === 'cave') === cave));
  const total = pool.reduce((s, x) => s + x.weight, 0);
  let roll = w.rng.next() * total, fish = pool[0];
  for (const x of pool) { roll -= x.weight; if (roll < 0) { fish = x; break; } }
  const size = fish.max ? Math.round(fish.min + (fish.max - fish.min) * Math.pow(w.rng.next(), 1.8)) : 0;   // a maioria sai pequena
  const b = bobberOf(p);
  burst(w, b.x, b.y, 'water', 10, { s: 0.9, z: 0, up: 2.4 }, p.id); sfx(w, 'splash', b, p.id);
  const name = ITEMS[fish.item].name;
  if (canFit(p.bag, fish.item, w.rules.inventory.stack)) { addItem(p.bag, fish.item, 1, w.rules.inventory.stack); p.bagVersion++; }
  else w.emit({ t: 'notice', to: p.id, text: 'Inventário cheio: você soltou o peixe.' });
  w.emit({ t: 'gain', to: p.id, x: p.x, y: p.y, text: size ? `+${name} (${size} cm)` : `+${name}` });
  w.emit({ t: 'fish', id: p.id, item: fish.item, size });
}

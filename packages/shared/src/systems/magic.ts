import { TS, ticks } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { GearId } from '../gear';
import { blocksShot, nearCave } from '../world/tiles';
import { breakTile } from './regrowth';
import type { World } from '../world';
import { damage, hitsBody } from './combat';
import { burst, sfx } from './fx';
import { canHarm, harmPlayer } from './pvp';

/* ---------- Magias dos cajados e do grimório (gastam mana; números em magic no config) ---------- */
// Fogo: bola de fogo na mira; carregada, explode em área.   Luz: cura quem estiver perto; carregada, cura mais e empurra monstros.
// Sombra: projétil que deixa lento e rouba vida; carregada, maldição (mais lenta e mais forte).
export type SpellKind = 'fire' | 'shadow';
export interface Spell { id: number; owner: string; kind: SpellKind; big: boolean; x: number; y: number; vx: number; vy: number; life: number; dead?: boolean }
const SPEED = { fire: 3, shadow: 2.4 }, LIFE = 55;

// Custo da magia que esse cajado solta (rápida ou carregada).
export function manaCost(w: World, g: GearId, big: boolean) {
  const m = w.rules.magic;
  if (g === 'firestaff') return big ? m.blast.mana : m.fire.mana;
  if (g === 'lightstaff') return big ? m.bigHeal.mana : m.heal.mana;
  if (g === 'darktome') return big ? m.curse.mana : m.shadow.mana;
  return 0;
}
// Solta a magia do cajado em uso. Sem mana suficiente na hora, falha numa fumacinha.
export function cast(w: World, p: Player) {
  const g = p.using!, cost = manaCost(w, g, p.big);
  if (p.mp < cost) { burst(w, p.x, p.y - 10, 'dust', 4, { s: 0.6, z: 8 }, p.id); sfx(w, 'poof', p, p.id); return; }
  p.mp -= cost;
  if (g === 'lightstaff') { heal(w, p, p.big); return; }
  const kind: SpellKind = g === 'firestaff' ? 'fire' : 'shadow', ca = Math.cos(p.aim), sa = Math.sin(p.aim), sp = SPEED[kind] * (p.big ? 0.85 : 1);
  w.spells.push({ id: w.nextId++, owner: p.id, kind, big: p.big, x: p.x + ca * 7, y: p.y - 6 + sa * 5, vx: ca * sp, vy: sa * sp, life: LIFE });
  sfx(w, kind, p, p.id);
}
function heal(w: World, p: Player, big: boolean) {
  const h = big ? w.rules.magic.bigHeal : w.rules.magic.heal;
  for (const o of w.players.values()) {
    if (o.state === 'dead' || Math.hypot(o.x - p.x, o.y - p.y) > h.radius) continue;
    const n = Math.min(h.amount + p.stats.magic, o.maxHp - o.hp);
    if (n > 0) { o.hp += n; w.emit({ t: 'gain', to: o.id, x: o.x, y: o.y - 8, text: `+${Math.round(n)} vida` }); }
    burst(w, o.x, o.y - 8, 'heal', 8, { s: 0.9, z: 10, up: 1.6 });
  }
  if (big) for (const e of w.enemies) {   // empurra (sem ferir) quem estiver na roda; o Rei é pesado demais
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (e.dying || e.type === 'king' || d > h.radius - 8 || d < 1) continue;
    e.kx = (e.x - p.x) / d * 3.4; e.ky = (e.y - p.y) / d * 3.4; e.hurtT = Math.max(e.hurtT, 10);
  }
  burst(w, p.x, p.y - 4, 'heal', big ? 26 : 14, { s: big ? 2 : 1.3, z: 4, up: 1.2 }, p.id);
  sfx(w, 'heal', p, p.id);
  reveal(w, p.x, p.y, h.radius + 16);
}
/* ---------- Magia no mundo (estilo Zelda) ---------- */
// Fogo queima arbusto e mato e acende tocha apagada; acesas todas as tochas do grupo, os portões perto abrem.
const GROUP = 6, GATES = 8;   // tiles: raio do grupo de tochas e dos portões que ele abre
const floorAt = (w: World, tx: number, ty: number, field: string) => nearCave((a, b) => w.map.get(a, b), tx, ty) ? 'q' : field;
function scorch(w: World, tx: number, ty: number) {
  const c = w.map.get(tx, ty);
  if (c === 'b' || c === 'g') { breakTile(w, tx, ty, floorAt(w, tx, ty, '.')); burst(w, tx * TS + 8, ty * TS + 8, 'fire', 10, { s: 1.2, z: 4, up: 1.4 }); return true; }
  if (c === 'j') { lightTorch(w, tx, ty); return true; }
  return false;
}
function lightTorch(w: World, tx: number, ty: number) {
  breakTile(w, tx, ty, 't');
  burst(w, tx * TS + 8, ty * TS + 2, 'fire', 8, { s: 0.8, z: 2, up: 1.2 }); sfx(w, 'fire', { x: tx * TS + 8, y: ty * TS + 8 });
  const near = (r: number, f: (x: number, y: number, c: string) => void) => {
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (w.map.inBounds(x, y)) f(x, y, w.map.tiles[y][x]);
  };
  let unlit = 0; near(GROUP, (_x, _y, c) => { if (c === 'j') unlit++; });
  if (unlit) return;
  let opened = 0;
  near(GATES, (x, y, c) => { if (c === 'G') { breakTile(w, x, y, floorAt(w, x, y, 'x')); burst(w, x * TS + 8, y * TS + 8, 'spark', 10, { s: 1.2, z: 6 }); opened++; } });
  if (opened) sfx(w, 'chest', { x: tx * TS + 8, y: ty * TS + 8 });
}
// Luz revela paredes ilusórias em volta e deixa um clarão no escuro.
function reveal(w: World, x: number, y: number, r: number) {
  const t0x = Math.floor((x - r) / TS), t1x = Math.floor((x + r) / TS), t0y = Math.floor((y - r) / TS), t1y = Math.floor((y + r) / TS);
  for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
    if (w.map.get(tx, ty) !== 'I' || Math.hypot(tx * TS + 8 - x, ty * TS + 8 - y) > r + 8) continue;
    breakTile(w, tx, ty, 'q'); burst(w, tx * TS + 8, ty * TS + 8, 'heal', 12, { s: 1.2, z: 6, up: 1 });
  }
  w.emit({ t: 'glow', x, y, r: r + 24, s: 10 });
}

// Lento: monstro anda em passos alternados; jogador anda mais devagar.
export const slowed = (w: World, x: { slowUntil?: number }) => (x.slowUntil ?? 0) > w.tick;
function shadowHit(w: World, s: Spell, caster: Player | undefined, target: Enemy | Player, isPlayer: boolean) {
  const m = s.big ? w.rules.magic.curse : w.rules.magic.shadow;
  target.slowUntil = w.tick + ticks(m.slow);
  if (isPlayer) harmPlayer(w, caster!, target as Player, 'sword', m.pvp, caster!.stats.magic);
  else damage(w, target as Enemy, m.damage + (caster?.stats.magic ?? 0), s.x - s.vx * 3, s.y - s.vy * 3, caster);
  if (caster && caster.state !== 'dead') {
    const n = Math.min(m.drain, caster.maxHp - caster.hp);
    if (n > 0) { caster.hp += n; w.emit({ t: 'gain', to: caster.id, x: caster.x, y: caster.y - 8, text: `+${Math.round(n)} vida` }); }
  }
  burst(w, s.x, s.y, 'shadow', s.big ? 16 : 9, { s: 1.1, z: 6 });
}
function explode(w: World, s: Spell, caster: Player | undefined) {
  if (!s.big) { burst(w, s.x, s.y, 'fire', 8, { s: 0.9, z: 6 }); return; }
  const b = w.rules.magic.blast;
  for (let ty = Math.floor((s.y - b.radius) / TS); ty <= Math.floor((s.y + 6 + b.radius) / TS); ty++)
    for (let tx = Math.floor((s.x - b.radius) / TS); tx <= Math.floor((s.x + b.radius) / TS); tx++)
      if (Math.hypot(tx * TS + 8 - s.x, ty * TS + 8 - s.y - 6) <= b.radius + 6) scorch(w, tx, ty);
  for (const e of w.enemies) if (!e.dying && Math.hypot(e.x - s.x, e.y - s.y) < b.radius + e.hw) damage(w, e, b.damage + (caster?.stats.magic ?? 0), s.x, s.y, caster);
  if (caster) for (const v of w.players.values()) if (Math.hypot(v.x - s.x, v.y - s.y) < b.radius + v.hw && canHarm(w, caster, v)) harmPlayer(w, caster, v, 'bomb', b.pvp, caster.stats.magic);
  burst(w, s.x, s.y, 'fire', 24, { s: 2, z: 4, up: 1.6 }); sfx(w, 'boom', s);
  for (const p of w.players.values()) { const d = Math.hypot(p.x - s.x, p.y - s.y); if (d < 90) w.emit({ t: 'shake', to: p.id, n: d < b.radius * 2 ? 8 : 4 }); }
}

export function updateSpells(w: World) {
  for (const s of w.spells) {
    s.x += s.vx; s.y += s.vy;
    const caster = w.players.get(s.owner), tx = Math.floor(s.x / TS), ty = Math.floor((s.y + 6) / TS);
    if (s.kind === 'fire' && !s.big && scorch(w, tx, ty) && blocksShot(w.map.get(tx, ty))) { s.dead = true; continue; }   // acendeu a tocha: para ali
    if (--s.life <= 0 || !w.map.inBounds(tx, ty) || blocksShot(w.map.tiles[ty][tx])) { s.dead = true; if (s.kind === 'fire') explode(w, s, caster); continue; }
    if (w.tick % 3 === 0) burst(w, s.x, s.y, s.kind, 1, { s: 0.4, z: 6, up: 0.3 });
    const e = w.enemies.find(e => !e.dying && e.type !== 'chicken' && e.hurtT === 0 && hitsBody(e, s.x, s.y + 6));
    const v = !e && caster ? [...w.players.values()].find(v => v !== caster && v.inv === 0 && hitsBody(v, s.x, s.y + 6) && canHarm(w, caster, v)) : undefined;
    if (!e && !v) continue;
    s.dead = true;
    if (s.kind === 'shadow') shadowHit(w, s, caster, (e ?? v)!, !e);
    else if (s.big) explode(w, s, caster);
    else { if (e) damage(w, e, w.rules.magic.fire.damage + (caster?.stats.magic ?? 0), s.x - s.vx * 3, s.y - s.vy * 3, caster); else harmPlayer(w, caster!, v!, 'sword', w.rules.magic.fire.pvp, caster!.stats.magic); explode(w, s, caster); }
  }
  w.spells = w.spells.filter(s => !s.dead);
}

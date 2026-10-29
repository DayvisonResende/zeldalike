import { FACE, SPIN, SWING, TS, angDir } from '../constants';
import type { Player } from '../entities/player';
import { BUTTON, type Button } from '../input';
import { blockedAt, move } from '../world/collision';
import type { World } from '../world';
import { interact, throwObj } from './carry';
import { dashHits, pokeTip, swordHits } from './combat';
import { burst, sfx } from './fx';
import { fireArrow } from './projectiles';
import { updateFishing } from './fishing';
import { struggle, throwPlayer } from './throwing';
import { gearIn, type GearId, type GearSlot } from '../gear';
import { cast, manaCost } from './magic';
import { pushAgainst } from './blocks';
import { SWEEP_HOLD, pickAll } from './loot';

export function faceAim(p: Player) { p.aim = p.input.aim ?? FACE[p.dir]; p.dir = angDir(p.aim); }
function startSwing(w: World, p: Player) { faceAim(p); p.state = 'swing'; p.t = 0; p.hit.clear(); sfx(w, 'swing', p, p.id); }
// Usa o que está no botão. Cajado sem mana para a magia rápida vira bastão: bate de perto como a espada (sem carregar).
function useGear(w: World, p: Player, g: GearId, slot: GearSlot) {
  p.using = g; p.useBtn = slot; p.big = false;
  if (g === 'bow') { faceAim(p); p.state = 'bow'; p.t = 0; return; }
  if (g === 'sword' || p.mp < manaCost(w, g, false)) { startSwing(w, p); return; }
  faceAim(p); p.state = 'cast'; p.t = 0;
}
const CAST_AT = 6, CAST_END = 14;

/* ---------- Dash (Shift/Q) e pulo do barranco ---------- */
function startDash(w: World, p: Player, ix: number, iy: number) {
  const a = (ix || iy) ? Math.atan2(iy, ix) : FACE[p.dir];
  p.aim = a; p.dir = angDir(a);
  p.dvx = Math.abs(Math.cos(a)) < 0.01 ? 0 : Math.cos(a) * 3.3;
  p.dvy = Math.abs(Math.sin(a)) < 0.01 ? 0 : Math.sin(a) * 3.3;
  p.state = 'dash'; p.t = 0; sfx(w, 'dash', p, p.id);
}
function bonk(w: World, p: Player) {
  p.state = 'bonk'; p.t = 26; p.kx = -p.dvx * 0.45; p.ky = -p.dvy * 0.45;
  w.emit({ t: 'shake', to: p.id, n: 12, by: p.id }); sfx(w, 'bonk', p, p.id);
  burst(w, p.x + Math.cos(p.aim) * 8, p.y - 4 + Math.sin(p.aim) * 6, 'spark', 7, { s: 1.1, z: 6 }, p.id);
}
function updateDash(w: World, p: Player, ix: number, iy: number) {
  p.t++; p.walkT += 2; p.step = ((p.walkT >> 2) % 2) + 1;
  if ((ix || iy) && ix * p.dvx + iy * p.dvy < -0.5) { p.state = 'walk'; return; }   // direção oposta freia
  if (p.t % 4 === 0) burst(w, p.x - p.dvx * 2, p.y + 3, 'dust', 1, { s: 0.4, z: 1, up: 0.6 }, p.id);
  dashHits(w, p);
  const down = p.dvy > 0 && p.dvx === 0;
  if (down && tryLedge(w, p)) return;
  if (move(w.map, p, p.dvx, p.dvy)) { if (down && tryLedge(w, p)) return; bonk(w, p); }
}
// Borda de penhasco: o tile abaixo é 'c' com a beirada de grama em cima; procura chão livre logo depois da parede.
function tryLedge(w: World, p: Player) {
  const t = w.map.tiles, rows = w.map.rows, ty = Math.floor((p.y + p.hh + 1) / TS);
  if (ty <= 0 || ty >= rows) return false;
  const x0 = Math.floor((p.x - p.hw) / TS), x1 = Math.floor((p.x + p.hw - 0.01) / TS);
  let land = -1;
  for (let tx = x0; tx <= x1; tx++) {
    if (tx < 0 || tx >= w.map.cols || t[ty][tx] !== 'c' || t[ty - 1][tx] === 'c') return false;
    let r = ty; while (r < rows && t[r][tx] === 'c') r++;
    if (r >= rows || r - ty > 4) return false;
    land = Math.max(land, r);
  }
  for (let tx = x0; tx <= x1; tx++) for (let r = ty; r < land; r++) if (t[r][tx] !== 'c') return false;
  const ly = land * TS + 6;
  if (blockedAt(w.map, p.x, ly, p.hw, p.hh)) return false;
  const n = land - ty;
  p.hop = { y0: p.y, y1: ly, t: 0, dur: 18 + n * 6, h: 10 + n * 4 };
  p.state = 'hop'; p.push = 0; sfx(w, 'hop', p, p.id);
  return true;
}
function updateHop(w: World, p: Player) {
  const h = p.hop!;
  h.t++;
  const t = Math.min(1, h.t / h.dur);
  p.y = h.y0 + (h.y1 - h.y0) * t;
  p.z = Math.sin(t * Math.PI) * h.h;
  p.step = 0;
  if (t >= 1) {
    p.z = 0; p.state = p.carry ? 'carry' : 'walk';
    burst(w, p.x, p.y + 3, 'dust', 6, { s: 0.9, z: 1, up: 0.8 }, p.id); sfx(w, 'land', p, p.id); w.emit({ t: 'shake', to: p.id, n: 3, by: p.id });
  }
}

export function updatePlayer(w: World, p: Player) {
  const inp = p.input;
  p.steps++;
  if (p.inv > 0) p.inv--;
  const ix = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), iy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  const tap = (b: Button) => (inp.tap & BUTTON[b]) !== 0;
  let speed = (p.slowUntil > w.tick ? 0.6 : 1) * 1.35, turn = true;
  switch (p.state) {
    case 'dead': case 'flying': return;   // voando: quem manda é o arremesso (ver throwing)
    case 'held': struggle(w, p); return;
    case 'fish': updateFishing(w, p, tap('b'), !!(ix || iy)); return;
    case 'hurt': p.t--; move(w.map, p, p.kx, p.ky); p.kx *= 0.86; p.ky *= 0.86; if (p.t <= 0) p.state = p.carry ? 'carry' : 'walk'; return;
    case 'lift': if (++p.t >= 12) p.state = 'carry'; return;
    case 'throw': if (--p.t <= 0) p.state = 'walk'; return;
    case 'swing': p.t++; swordHits(w, p); if (p.t >= SWING) { if (inp[p.useBtn] && p.using === 'sword') { p.state = 'charge'; p.charge = 0; p.charged = false; } else p.state = 'walk'; } return;
    case 'cast':   // ergue o cajado, solta a magia; segurando o botão (e com mana) começa a carregar a forte
      p.t++; if (p.t <= CAST_AT - 2 && inp.aim !== null) faceAim(p);
      if (p.t === CAST_AT) cast(w, p);
      if (p.t >= CAST_END) { if (!p.big && inp[p.useBtn] && p.mp >= manaCost(w, p.using!, true)) { p.state = 'charge'; p.charge = 0; p.charged = false; } else p.state = 'walk'; }
      return;
    case 'spin': p.t++; swordHits(w, p); if (p.t >= SPIN) p.state = 'walk'; return;
    case 'dashprep':
      if (!inp.d) { p.state = 'walk'; return; }
      p.t++; p.step = ((p.t >> 2) % 2) + 1;
      if (p.t % 5 === 0) { burst(w, p.x, p.y + 3, 'dust', 2, { s: 0.5, z: 1, up: 0.8 }, p.id); sfx(w, 'step', p, p.id); }
      if (p.t >= 20) startDash(w, p, ix, iy);
      return;
    case 'dash': updateDash(w, p, ix, iy); return;
    case 'bonk':
      p.t--; move(w.map, p, p.kx, p.ky); p.kx *= 0.88; p.ky *= 0.88;
      p.z = Math.max(0, Math.sin((1 - p.t / 26) * Math.PI) * 7);
      if (p.t <= 0) { p.z = 0; p.state = p.carry ? 'carry' : 'walk'; }
      return;
    case 'hop': updateHop(w, p); return;
    case 'bow': p.t++; if (p.t <= 7 && inp.aim !== null) faceAim(p); if (p.t === 7) fireArrow(w, p); if (p.t >= 17) p.state = 'walk'; return;
    case 'charge':
      if (!inp[p.useBtn]) {
        if (p.charged && p.using === 'sword') { p.state = 'spin'; p.t = 0; p.hit.clear(); sfx(w, 'spin', p, p.id); }
        else if (p.charged) { p.state = 'cast'; p.t = 0; p.big = true; }   // solta a magia forte
        else p.state = 'walk';
        p.charged = false; return;
      }
      if (++p.charge === 40) { p.charged = true; sfx(w, 'charge', p, p.id); }
      if (inp.aim !== null) faceAim(p);
      if (p.using === 'sword') pokeTip(w, p);
      speed = 0.75; turn = false; break;
    case 'carry':
      if (tap('a') || tap('b')) { if (p.carry === 'player') throwPlayer(w, p); else throwObj(w, p); return; }
      speed = 1.1; break;
    default:
      if (inp.b) { if (++p.holdB === SWEEP_HOLD) pickAll(w, p); } else p.holdB = 0;   // segurar B: pega tudo em volta
      if (tap('a')) { useGear(w, p, gearIn(p, 'a'), 'a'); return; }
      if (tap('c')) { useGear(w, p, gearIn(p, 'c'), 'c'); return; }
      if (tap('d')) { p.state = 'dashprep'; p.t = 0; return; }
      if (tap('b') && interact(w, p)) return;
  }
  if (turn) {
    if (ix && !iy) p.dir = ix < 0 ? 2 : 3;
    else if (iy && !ix) p.dir = iy < 0 ? 1 : 0;
    else if (ix && iy) { const hd = ix < 0 ? 2 : 3, vd = iy < 0 ? 1 : 0; if (p.dir !== hd && p.dir !== vd) p.dir = vd; }
  }
  if (ix || iy) { const k = (ix && iy) ? 0.7071 : 1; move(w.map, p, ix * speed * k, iy * speed * k, true); p.walkT++; } else p.walkT = 0;
  // andando contra um bloco numa direção só: conta o empurrão
  if (!(p.state === 'walk' && !ix !== !iy && blockedAt(w.map, p.x + ix, p.y + iy, p.hw, p.hh) && pushAgainst(w, p, ix, iy))) p.shove = 0;
  p.step = (ix || iy) ? ((p.walkT >> 3) % 2) + 1 : 0;
  // empurrando para baixo contra a beira de um penhasco por alguns quadros → pula
  if (iy > 0 && !ix && (p.state === 'walk' || p.state === 'carry') && blockedAt(w.map, p.x, p.y + 1, p.hw, p.hh)) {
    if (++p.push >= 5 && tryLedge(w, p)) return;
  } else p.push = 0;
}

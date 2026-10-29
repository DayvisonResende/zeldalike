import { TS } from '../constants';
import type { Player } from '../entities/player';
import { nearCave } from '../world/tiles';
import type { World } from '../world';
import { burst, sfx } from './fx';

/* ---------- Masmorra: chaves, portas trancadas, salas que trancam e fragmentos de vida ----------
   As chaves são do mapa (da cópia do grupo, numa masmorra), não de quem pegou: qualquer um do grupo abre a porta. */
export type RoomState = 'idle' | 'locked' | 'cleared';
const notice = (w: World, p: Player, text: string) => w.emit({ t: 'notice', to: p.id, text });

// Chaves do mapa no chão, como drops que não somem e qualquer um pega.
export function spawnKeys(w: World) {
  for (const k of w.map.data.keys ?? [])
    w.drops.push({ id: w.nextId++, item: 'key', n: 1, x: k.x, y: k.y, owner: null, ownerUntil: 0, expires: Infinity, born: -Infinity });
}
// Porta trancada à frente: gasta uma chave e vira chão. Sem chave, avisa.
export function openDoor(w: World, p: Player, tx: number, ty: number) {
  if (w.predicting) return;   // a previsão não sabe das chaves: o servidor abre
  if (w.keys <= 0) { notice(w, p, 'Trancada. Precisa de uma chave.'); sfx(w, 'bonk', p); return; }
  w.keys--;
  w.setTile(tx, ty, nearCave((x, y) => w.map.get(x, y), tx, ty) ? 'q' : 'x');
  burst(w, tx * TS + 8, ty * TS + 8, 'spark', 12, { s: 1.2, z: 6 }); sfx(w, 'chest', { x: tx * TS + 8, y: ty * TS + 8 });
  for (const o of w.players.values()) notice(w, o, `${p.name} abriu uma porta.${w.keys ? ` Chaves: ${w.keys}` : ''}`);
}

/* ---------- Salas que trancam ---------- */
const inside = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= r.x * TS && x < (r.x + r.w) * TS && y >= r.y * TS && y < (r.y + r.h) * TS;
// Grades da sala: as que estão dentro dela ou na borda (um tile em volta).
function grateTiles(w: World, r: { x: number; y: number; w: number; h: number }, code: string) {
  const out: [number, number][] = [];
  for (let ty = r.y - 1; ty <= r.y + r.h; ty++) for (let tx = r.x - 1; tx <= r.x + r.w; tx++) if (w.map.get(tx, ty) === code) out.push([tx, ty]);
  return out;
}
function grates(w: World, r: { x: number; y: number; w: number; h: number }, from: string, to: string) { for (const [tx, ty] of grateTiles(w, r, from)) w.setTile(tx, ty, to); }
export function updateRooms(w: World) {
  const rooms = w.map.data.rooms; if (!rooms || w.tick % 6) return;
  rooms.forEach((r, i) => {
    const st = w.rooms[i] ?? 'idle'; if (st === 'cleared') return;
    const alive = w.enemies.some(e => !e.dying && !e.dead && w.spawns[e.spawn] && inside(r, w.spawns[e.spawn].tx * TS + 8, w.spawns[e.spawn].ty * TS + 8));
    const someone = [...w.players.values()].some(p => p.state !== 'dead' && inside(r, p.x, p.y));
    // ninguém em cima de uma grade: ela fecharia em cima da pessoa
    const onGrate = grateTiles(w, r, 'O').some(([tx, ty]) => [...w.players.values()].some(p => Math.abs(p.x - (tx * TS + 8)) < 8 + p.hw && Math.abs(p.y - (ty * TS + 8)) < 8 + p.hh));
    if (st === 'idle' && alive && someone && !onGrate) {
      w.rooms[i] = 'locked'; grates(w, r, 'O', 'D');
      sfx(w, 'boom', { x: (r.x + r.w / 2) * TS, y: (r.y + r.h / 2) * TS });
      for (const p of w.players.values()) if (inside(r, p.x, p.y)) notice(w, p, 'A sala trancou! Derrube todos os monstros.');
    } else if (st === 'locked' && !alive) {
      w.rooms[i] = 'cleared'; grates(w, r, 'D', 'O');
      const cx = (r.x + r.w / 2) * TS, cy = (r.y + r.h / 2) * TS;
      if (r.reward) w.drops.push({ id: w.nextId++, item: r.reward === 'chave' ? 'key' : r.reward, n: 1, x: cx, y: cy, owner: null, ownerUntil: 0, expires: Infinity, born: w.tick });
      burst(w, cx, cy, 'spark', 16, { s: 1.4, z: 8 }); sfx(w, 'chest', { x: cx, y: cy });
      for (const p of w.players.values()) if (inside(r, p.x, p.y)) notice(w, p, r.reward ? 'Sala limpa! Algo apareceu.' : 'Sala limpa!');
    } else if (st === 'locked' && !someone) { w.rooms[i] = 'idle'; grates(w, r, 'D', 'O'); }   // todos caíram ou saíram: destranca (tranca de novo ao voltar)
  });
}

/* ---------- Fragmentos de vida ---------- */
// Cada fragmento, uma vez por personagem: + rules.player.fragment de vida máxima, para sempre.
export const fragmentKey = (w: World, tx: number, ty: number) => `${w.id}:${tx},${ty}`;
export const fragmentHp = (w: World, p: Player) => p.fragments.length * w.rules.player.fragment;
export function collectFragments(w: World) {
  const list = w.map.data.fragments; if (!list || w.tick % 4) return;
  for (const p of w.players.values()) {
    if (p.state === 'dead') continue;
    for (const f of list) {
      const key = fragmentKey(w, f.x, f.y);
      if (p.fragments.includes(key) || Math.hypot(p.x - (f.x * TS + 8), p.y - (f.y * TS + 10)) > 10) continue;
      p.fragments.push(key); p.maxHp += w.rules.player.fragment; p.hp += w.rules.player.fragment;
      burst(w, f.x * TS + 8, f.y * TS + 6, 'heal', 18, { s: 1.4, z: 8, up: 1.6 }); sfx(w, 'levelup', p);
      notice(w, p, `Fragmento de vida! +${w.rules.player.fragment} de vida máxima (${p.fragments.length} achados).`);
    }
  }
}

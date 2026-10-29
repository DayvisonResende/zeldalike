import { TS, ticks } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { World } from '../world';
import { bfs, distAt, type DistMap } from '../world/pathfinding';
import { gainXp } from './progress';
import { inSafeZone } from './pvp';
import { createEnemy } from './spawner';

/* ---------- Evento do servidor: invasão de gelecas na Clareira ---------- */
// De tempos em tempos (events.invasion.every) um aviso, depois uma horda marcha até a zona `zone`.
// Durante a invasão a zona deixa de proteger contra monstros (o PvP continua proibido lá).
// Vence quem limpar a horda antes do tempo: cada um que derrubou alguma ganha a recompensa.
export interface Invasion {
  zone: string; phase: 'warn' | 'fight'; until: number;   // until: fim do aviso ou da luta
  left: number;                                          // gelecas que ainda vão chegar
  flow: DistMap; spots: [number, number][];              // caminho até a zona e onde a horda aparece
  score: Record<string, number>;                         // id do jogador → gelecas derrubadas
}
const SPAWN_EVERY = 15;          // ticks entre uma geleca e a próxima
const NEAR = 12, FAR = 30;       // a horda aparece entre esses tantos tiles de caminho da zona

// A zona está sendo invadida neste ponto? (então monstros entram e mordem lá dentro)
export function invaded(w: World, x: number, y: number) {
  if (!w.invasion || w.invasion.phase !== 'fight') return false;
  const r = w.map.regionAt(x, y);
  return !!r && r.id === w.invasion.zone;
}
export const monsterSafe = (w: World, x: number, y: number) => inSafeZone(w, x, y) && !invaded(w, x, y);
export const remaining = (w: World) => w.invasion ? w.invasion.left + w.enemies.filter(e => e.invader && !e.dying).length : 0;

export function startInvasion(w: World) {
  const cfg = w.rules.events.invasion, r = w.map.data.regions.find(r => r.id === cfg.zone);
  if (w.invasion || !r) return false;
  const src: [number, number][] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) src.push([x, y]);
  const flow = bfs(w.map, src, FAR), spots: [number, number][] = [];
  for (let y = 0; y < w.map.rows; y++) for (let x = 0; x < w.map.cols; x++) {
    const d = distAt(flow, x, y);
    if (d >= NEAR && d <= FAR && !inSafeZone(w, x * TS + 8, y * TS + 8)) spots.push([x, y]);
  }
  if (!spots.length) return false;
  w.invasion = { zone: cfg.zone, phase: 'warn', until: w.tick + ticks(cfg.warning), left: cfg.count, flow, spots, score: {} };
  w.emit({ t: 'announce', text: `Gelecas avistadas! Defendam ${r.name}: a horda chega em ${Math.round(cfg.warning)}s.` });
  return true;
}

export function onInvaderDead(w: World, killer: string | undefined) {
  if (w.invasion && killer) w.invasion.score[killer] = (w.invasion.score[killer] ?? 0) + 1;
}

function finish(w: World, won: boolean) {
  const inv = w.invasion!, cfg = w.rules.events.invasion;
  w.invasion = null; w.nextInvasion = w.tick + ticks(cfg.every);
  if (!won) {
    for (const e of w.enemies) if (e.invader && !e.dead) { e.dead = true; w.emit({ t: 'poof', x: e.x, y: e.y - 4 }); }
    w.emit({ t: 'announce', text: 'As gelecas recuaram para a floresta. Fica para a próxima!' });
    return;
  }
  let best: string | null = null;
  for (const [id, n] of Object.entries(inv.score)) {
    const p = w.players.get(id); if (!p) continue;   // saiu do mapa antes do fim: fica sem prêmio
    gainXp(w, p, cfg.reward.xp);
    const g = Math.round(cfg.reward.gold * w.rules.rates.gold);
    if (g > 0) { p.gold += g; w.emit({ t: 'gain', to: p.id, x: p.x, y: p.y - 8, text: `+${g} de ouro` }); }
    if (!best || n > inv.score[best]) best = id;
  }
  const hero = best && w.players.get(best);
  w.emit({ t: 'announce', text: 'A Clareira resistiu à invasão!' + (hero ? ` Melhor defensor: ${hero.name} (${inv.score[best!]} gelecas).` : '') });
}

// Uma vez por passo, só no mapa principal: agenda, avisa, solta a horda e decide o fim.
export function updateInvasion(w: World) {
  const cfg = w.rules.events.invasion;
  if (!w.home) return;
  if (w.invasionEvery !== cfg.every) { w.invasionEvery = cfg.every; w.nextInvasion = w.tick + ticks(cfg.every); }   // config mudou: reagenda
  const inv = w.invasion;
  // every 0: nenhuma automática (mas uma começada à mão por um administrador, /invasao, segue até o fim)
  if (!inv) { if (cfg.every > 0 && w.tick >= w.nextInvasion && w.players.size && !startInvasion(w)) w.nextInvasion = w.tick + ticks(cfg.every); return; }
  if (inv.phase === 'warn') {
    if (w.tick < inv.until) return;
    inv.phase = 'fight'; inv.until = w.tick + ticks(cfg.duration);
    w.emit({ t: 'announce', text: 'A invasão começou! As gelecas estão chegando!' });
    return;
  }
  if (inv.left > 0 && w.tick % SPAWN_EVERY === 0) {
    const [tx, ty] = inv.spots[w.rng.int(inv.spots.length)];
    const e: Enemy = createEnemy(w, 'slime', tx, ty, -1);
    e.invader = true; e.timer = w.rng.int(20);
    w.enemies.push(e); inv.left--;
    w.emit({ t: 'poof', x: e.x, y: e.y - 4 });
  }
  if (!remaining(w)) finish(w, true);
  else if (w.tick >= inv.until) finish(w, false);
}

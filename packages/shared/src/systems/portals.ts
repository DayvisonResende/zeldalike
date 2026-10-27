import type { Player } from '../entities/player';
import type { World } from '../world';
import { sfx } from './fx';

// Pisou num portal: no mesmo mapa, teleporta aqui; para outro mapa, avisa o servidor (ele transfere o jogador).
// Só dispara ao entrar na área, então chegar em cima de um portal não manda a pessoa de volta.
export function updatePortals(w: World) {
  const portals = w.map.data.portals ?? [];
  for (const p of w.players.values()) {
    if (p.state === 'dead' || p.state === 'hop' || p.state === 'held' || p.state === 'flying') continue;
    const at = portals.find(o => p.x >= o.x && p.x < o.x + o.w && p.y >= o.y && p.y < o.y + o.h);
    if (p.portalWait > 0) { p.portalWait--; p.inPortal = !!at; continue; }   // acabou de chegar: portais quietos por um instante
    if (!at) { p.inPortal = false; continue; }
    if (p.inPortal) continue;
    p.inPortal = true;
    if (at.to) { w.emit({ t: 'portal', id: p.id, to: at.to, arrive: at.arrive }); continue; }
    const dest = w.map.data.points?.[at.arrive];
    if (dest) { arrive(p, dest); w.emit({ t: 'poof', x: p.x, y: p.y - 4 }); sfx(w, 'hop', p); }
  }
}
// Chegada num ponto: zera movimentos em andamento.
export function arrive(p: Player, at: { x: number; y: number }) {
  p.fish = null;
  if (p.carry === 'player') p.carry = null;   // quem estava no colo fica para trás (e desce sozinho)
  p.holding = null;
  p.x = at.x; p.y = at.y; p.z = 0; p.kx = p.ky = 0; p.dvx = p.dvy = 0; p.hop = null; p.push = 0;
  if (p.state !== 'dead') p.state = p.carry ? 'carry' : 'walk';
  p.region = null; p.inPortal = true; p.portalWait = PORTAL_WAIT;
}
const PORTAL_WAIT = 60;   // passos (1 s) sem portais depois de chegar: ninguém volta sem querer segurando a tecla

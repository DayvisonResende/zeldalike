import { ticks } from '../constants';
import type { World } from '../world';

/* ---------- Dia e noite: um relógio só, do servidor (todos os mapas têm a mesma hora) ---------- */
// 0 = meia-noite, 0,25 = 6h, 0,5 = meio-dia, 0,75 = 18h.
export function dayTime(w: World) {
  const cyc = ticks(w.rules.daynight.cycle);
  return ((w.rules.daynight.start * cyc + w.tick) % cyc) / cyc;
}
// Quanto de sol: 1 das 7h às 17h, 0 das 19h às 5h, e uma rampa no amanhecer e no entardecer.
export function sunlight(t: number) {
  const h = t * 24;
  if (h >= 7 && h < 17) return 1;
  if (h >= 5 && h < 7) return (h - 5) / 2;
  if (h >= 17 && h < 19) return (19 - h) / 2;
  return 0;
}
// É noite para os monstros "só de noite"? Mapa escuro (caverna) é sempre noite.
export const isNight = (w: World) => !!w.map.data.dark || sunlight(dayTime(w)) < 0.5;

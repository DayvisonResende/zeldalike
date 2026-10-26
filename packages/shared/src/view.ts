import { VIEW_H, VIEW_W } from './constants';

// O que aparece na tela de um jogador: centrado nele, mas preso às bordas do mundo.
// A câmera do cliente e o servidor (que decide o que enviar a cada um) usam esta mesma conta.
export interface Rect { x: number; y: number; w: number; h: number }
export function viewRect(world: { width: number; height: number }, x: number, y: number): Rect {
  return {
    x: Math.max(0, Math.min(world.width - VIEW_W, x - VIEW_W / 2)),
    y: Math.max(0, Math.min(world.height - VIEW_H, y - 8 - VIEW_H / 2)),
    w: VIEW_W, h: VIEW_H
  };
}
export const inRect = (r: Rect, x: number, y: number, margin = 0) =>
  x >= r.x - margin && x <= r.x + r.w + margin && y >= r.y - margin && y <= r.y + r.h + margin;

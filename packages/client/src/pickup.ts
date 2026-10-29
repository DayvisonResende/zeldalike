import { PICK_RANGE, type DropView, type PlayerView } from '@vale/shared';

// O item que o botão de Ação pegaria agora: o mais perto, que não esteja reservado a outro jogador.
// É o mesmo critério do servidor (quem entrega de verdade é ele); serve para a setinha e o "Pegar" no botão.
export function pickable(me: PlayerView | undefined, drops: readonly DropView[]) {
  if (!me || me.state === 'dead') return null;
  let best: DropView | null = null, bd = PICK_RANGE;
  for (const d of drops) { const k = Math.hypot(d.x - me.x, d.y - me.y); if (!d.reserved && k <= bd) { bd = k; best = d; } }
  return best;
}

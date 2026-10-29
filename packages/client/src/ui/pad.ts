import { GEAR_NAME, REVIVE_RANGE, gearIn, type DropView, type PlayerView } from '@vale/shared';
import { pickable } from '../pickup';
import { ITEM_ICON } from '../render/sprites';
import type { Inventory } from '../session/types';
import type { PadSize } from './settings';

// Parte do controle de toque que muda com o jogo: quantos itens restam nos atalhos e o nome do botão B.
const pad = document.getElementById('pad')!, bLabel = document.querySelector('#btnB span')!;
const aLabel = document.querySelector('#btnA span')!, cLabel = document.querySelector('#btnC span')!, gearLine = document.getElementById('gearLine')!;
let lastGear = '';
const quick = (['heart', 'mana', 'bomb'] as const).map((id, i) => {
  const el = document.getElementById('q' + (i + 1))!;
  el.querySelector('canvas')!.getContext('2d')!.drawImage(ITEM_ICON[id], 0, 0);
  return { id, el, count: el.querySelector('b')!, last: -1 };
});
// botão de bomba do arco (deitado): mesmo ícone e contador do atalho 3
const bomb = document.getElementById('btnBomb')!, bombCount = bomb.querySelector('b')!;
bomb.querySelector('canvas')!.getContext('2d')!.drawImage(ITEM_ICON.bomb, 0, 0);
let lastB = '';
export function updatePad(me: PlayerView | undefined, inv: Inventory | null, size: PadSize, drops: readonly DropView[], players: readonly PlayerView[] = []) {
  if (pad.dataset.size !== size) pad.dataset.size = size;
  for (const q of quick) {
    const n = inv ? inv.bag.reduce((t, s) => t + (s?.id === q.id ? s.n : 0), 0) : 0;
    if (n === q.last) continue;
    q.last = n; q.count.textContent = String(n); q.el.classList.toggle('empty', n === 0);
    if (q.id === 'bomb') { bombCount.textContent = String(n); bomb.classList.toggle('empty', n === 0); }
  }
  if (inv) {   // o que está no A e no C: nos botões do celular e numa linha do HUD
    const a = GEAR_NAME[gearIn(inv, 'a')], c = GEAR_NAME[gearIn(inv, 'c')];
    if (a + c !== lastGear) { lastGear = a + c; aLabel.textContent = a; cLabel.textContent = c; gearLine.textContent = `A ${a} · C ${c}`; }
  }
  const fallen = !!me && me.state !== 'dead' && players.some(o => o.id !== me.id && o.state === 'dead' && Math.hypot(o.x - me.x, o.y - me.y) <= REVIVE_RANGE);
  const b = me?.carry ? 'Arremessar' : me?.state === 'fish' ? 'Puxar' : pickable(me, drops) ? 'Pegar' : fallen ? 'Levantar' : 'Ação';
  if (b !== lastB) { lastB = b; bLabel.textContent = b; }
}

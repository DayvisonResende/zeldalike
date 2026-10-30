import { gearName, REVIVE_RANGE, gearIn, nextGear, type DropView, type PlayerView } from '@vale/shared';
import { pickable } from '../pickup';
import { iconsVersion, itemIcon } from '../render/icons';
import type { Inventory } from '../session/types';
import type { PadSize } from './settings';

// Parte do controle de toque que muda com o jogo: quantos itens restam nos atalhos e o nome do botão B.
const pad = document.getElementById('pad')!, bLabel = document.querySelector('#btnB span')!;
const aLabel = document.querySelector('#btnA span')!, cLabel = document.querySelector('#btnC span')!, gearBtns = { a: document.querySelector<HTMLButtonElement>('#gearLine [data-gear=a]')!, c: document.querySelector<HTMLButtonElement>('#gearLine [data-gear=c]')! };
let lastGear = '';
const quick = (['heart', 'mana', 'bomb'] as const).map((id, i) => {
  const el = document.getElementById('q' + (i + 1))!;
  return { id, el, count: el.querySelector('b')!, last: -1 };
});
// botão de bomba do arco (deitado): mesmo ícone e contador do atalho 3
const bomb = document.getElementById('btnBomb')!, bombCount = bomb.querySelector('b')!;
let lastB = '', lastIcons = -1;
// Ícones dos atalhos: desenhados de novo quando os ícones carregam (ou mudam).
function drawQuickIcons() {
  const put = (el: HTMLElement, id: string) => { const cv = el.querySelector('canvas')!, x = cv.getContext('2d')!; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(itemIcon(id), 0, 0); };
  for (const q of quick) put(q.el, q.id);
  put(bomb, 'bomb');
}
export function updatePad(me: PlayerView | undefined, inv: Inventory | null, size: PadSize, drops: readonly DropView[], players: readonly PlayerView[] = []) {
  if (pad.dataset.size !== size) pad.dataset.size = size;
  if (iconsVersion() !== lastIcons) { lastIcons = iconsVersion(); drawQuickIcons(); }
  for (const q of quick) {
    const n = inv ? inv.bag.reduce((t, s) => t + (s?.id === q.id ? s.n : 0), 0) : 0;
    if (n === q.last) continue;
    q.last = n; q.count.textContent = String(n); q.el.classList.toggle('empty', n === 0);
    if (q.id === 'bomb') { bombCount.textContent = String(n); bomb.classList.toggle('empty', n === 0); }
  }
  if (inv) {   // o que está no A e no C: nos botões do celular e numa linha do HUD
    const a = gearName(gearIn(inv, 'a')), c = gearName(gearIn(inv, 'c')), more = String(!!nextGear(inv, 'a')) + !!nextGear(inv, 'c');
    if (a + c + more !== lastGear) {
      lastGear = a + c + more; aLabel.textContent = a; cLabel.textContent = c;
      for (const [k, name] of [['a', a], ['c', c]] as const) {   // sem outra arma para trocar, o botão fica parado
        gearBtns[k].querySelector('span')!.textContent = name; gearBtns[k].disabled = !nextGear(inv, k);
        gearBtns[k].setAttribute('aria-label', `${k.toUpperCase()}: ${name}${gearBtns[k].disabled ? '' : '. Trocar'}`);
      }
    }
  }
  const fallen = !!me && me.state !== 'dead' && players.some(o => o.id !== me.id && o.state === 'dead' && Math.hypot(o.x - me.x, o.y - me.y) <= REVIVE_RANGE);
  const b = me?.carry ? 'Arremessar' : me?.state === 'fish' ? 'Puxar' : pickable(me, drops) ? 'Pegar' : fallen ? 'Levantar' : 'Ação';
  if (b !== lastB) { lastB = b; bLabel.textContent = b; }
}

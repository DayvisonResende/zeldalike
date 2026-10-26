import { ITEMS, type Slot } from '@vale/shared';
import { ITEM_ICON } from '../render/sprites';
import type { Inventory } from '../session/types';

export interface BagHooks { inventory(): Inventory | null; use(slot: number): void; drop(slot: number): void; closed(): void }

// Painel do inventário (I): grade de espaços, detalhe do item escolhido, usar e largar.
export class BagPanel {
  private el = document.getElementById('bag')!;
  private grid = document.getElementById('bagGrid')!;
  private info = document.getElementById('bagInfo')!;
  private useBtn = document.getElementById('bagUse') as HTMLButtonElement;
  private dropBtn = document.getElementById('bagDrop') as HTMLButtonElement;
  private sel = -1; private shown = '';

  constructor(private hooks: BagHooks) {
    this.useBtn.addEventListener('click', () => { if (this.sel >= 0) this.hooks.use(this.sel); });
    this.dropBtn.addEventListener('click', () => { if (this.sel >= 0) this.hooks.drop(this.sel); });
    this.el.addEventListener('pointerdown', e => { if (e.target === this.el) this.close(); });
  }
  get open() { return !this.el.hidden; }
  toggle() { if (this.open) this.close(); else { this.el.hidden = false; this.shown = ''; this.render(); this.grid.querySelector<HTMLElement>('.slot')?.focus(); } }
  close() { if (!this.open) return; this.el.hidden = true; this.hooks.closed(); }

  // Redesenha só quando o inventário muda.
  render() {
    if (!this.open) return;
    const inv = this.hooks.inventory(); if (!inv) return;
    const key = JSON.stringify([inv.bag, inv.gold, this.sel]);
    if (key === this.shown) return;
    this.shown = key;
    document.getElementById('bagGold')!.textContent = `${inv.gold} de ouro`;
    const focused = (document.activeElement as HTMLElement)?.dataset?.slot;
    this.grid.replaceChildren(...inv.bag.map((s, i) => this.slot(s, i)));
    if (focused) this.grid.querySelector<HTMLElement>(`[data-slot="${focused}"]`)?.focus();
    const cur = inv.bag[this.sel];
    if (!cur) { this.sel = -1; this.info.textContent = 'Escolha um item.'; }
    else { const d = ITEMS[cur.id]; this.info.textContent = `${d.name}${cur.n > 1 ? ' ×' + cur.n : ''} — ${d.desc}`; }
    this.useBtn.disabled = !cur || (!ITEMS[cur.id].heal && !ITEMS[cur.id].mana);
    this.dropBtn.disabled = !cur;
  }
  private slot(s: Slot, i: number) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'slot'; b.dataset.slot = String(i);
    b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(i === this.sel));
    b.setAttribute('aria-label', s ? `${ITEMS[s.id].name}, ${s.n}` : 'Vazio');
    if (s) {
      const cv = document.createElement('canvas'), icon = ITEM_ICON[s.id];
      cv.width = icon.width; cv.height = icon.height; cv.getContext('2d')!.drawImage(icon, 0, 0);
      b.append(cv);
      if (s.n > 1) b.append(Object.assign(document.createElement('b'), { textContent: String(s.n) }));
    }
    b.addEventListener('click', () => { this.sel = i; this.render(); });
    b.addEventListener('dblclick', () => { if (s) this.hooks.use(i); });   // dois cliques: usa
    return b;
  }
}

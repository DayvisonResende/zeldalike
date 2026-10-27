import { GEAR, GEAR_NAME, ITEMS, gearIn, owns, type GearId, type GearSlot, type ItemId, type Slot } from '@vale/shared';
import { ITEM_ICON } from '../render/sprites';
import type { Inventory } from '../session/types';

export interface BagHooks { inventory(): Inventory | null; use(slot: number): void; drop(slot: number): void; equip(gear: GearId, slot: GearSlot): void; closed(): void }

// Painel do inventário (I): grade de espaços, detalhe do item escolhido, usar e largar.
export class BagPanel {
  private el = document.getElementById('bag')!;
  private grid = document.getElementById('bagGrid')!;
  private info = document.getElementById('bagInfo')!;
  private useBtn = document.getElementById('bagUse') as HTMLButtonElement;
  private dropBtn = document.getElementById('bagDrop') as HTMLButtonElement;
  private equipC = document.getElementById('bagEquipC') as HTMLButtonElement;
  private gearBtn = { a: document.getElementById('gearA') as HTMLButtonElement, c: document.getElementById('gearC') as HTMLButtonElement };
  private sel = -1; private shown = '';

  constructor(private hooks: BagHooks) {
    // item de equipamento selecionado: "Usar" vira "Equipar no A"
    this.useBtn.addEventListener('click', () => { const g = this.selGear(); if (g) this.hooks.equip(g, 'a'); else if (this.sel >= 0) this.hooks.use(this.sel); });
    this.equipC.addEventListener('click', () => { const g = this.selGear(); if (g) this.hooks.equip(g, 'c'); });
    // A: / C: no topo alternam entre o que você tem e não está no outro botão (espada e arco sempre)
    for (const slot of ['a', 'c'] as const) this.gearBtn[slot].addEventListener('click', () => {
      const inv = this.hooks.inventory(); if (!inv) return;
      const other = gearIn(inv, slot === 'a' ? 'c' : 'a'), mine = GEAR.filter(g => owns(inv, g) && g !== other), cur = gearIn(inv, slot);
      this.hooks.equip(mine[(mine.indexOf(cur) + 1) % mine.length], slot);
    });
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
    const key = JSON.stringify([inv.bag, inv.gold, inv.gear, this.sel]);
    if (key === this.shown) return;
    this.shown = key;
    document.getElementById('bagGold')!.textContent = `${inv.gold} de ouro`;
    const focused = (document.activeElement as HTMLElement)?.dataset?.slot;
    this.grid.replaceChildren(...inv.bag.map((s, i) => this.slot(s, i)));
    if (focused) this.grid.querySelector<HTMLElement>(`[data-slot="${focused}"]`)?.focus();
    const cur = inv.bag[this.sel];
    if (!cur) { this.sel = -1; this.info.textContent = 'Escolha um item.'; }
    else { const d = ITEMS[cur.id]; this.info.textContent = `${d.name}${cur.n > 1 ? ' ×' + cur.n : ''} — ${d.desc}`; }
    for (const slot of ['a', 'c'] as const) {
      const g = gearIn(inv, slot); this.gearBtn[slot].textContent = `${slot.toUpperCase()}: ${GEAR_NAME[g]} ⟳`;
      this.gearBtn[slot].setAttribute('aria-label', `Botão ${slot.toUpperCase()}: ${GEAR_NAME[g]}. Trocar`);
    }
    const gear = !!cur && !!ITEMS[cur.id].gear;
    this.useBtn.textContent = gear ? 'Equipar no A' : 'Usar'; this.equipC.hidden = !gear;
    this.useBtn.disabled = !cur || (!gear && !ITEMS[cur.id].heal && !ITEMS[cur.id].mana);
    this.dropBtn.disabled = !cur;
  }
  private selGear(): GearId | null {
    const s = this.hooks.inventory()?.bag[this.sel];
    return s && ITEMS[s.id].gear ? s.id as GearId : null;
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
      if (ITEMS[s.id].gear) { const inv = this.hooks.inventory(); for (const k of ['a', 'c'] as const) if (inv && gearIn(inv, k) === (s.id as ItemId as GearId)) b.append(Object.assign(document.createElement('i'), { className: 'eq', textContent: k.toUpperCase() })); }
      if (s.n > 1) b.append(Object.assign(document.createElement('b'), { textContent: String(s.n) }));
    }
    b.addEventListener('click', () => { this.sel = i; this.render(); });
    b.addEventListener('dblclick', () => { if (s) this.hooks.use(i); });   // dois cliques: usa
    return b;
  }
}

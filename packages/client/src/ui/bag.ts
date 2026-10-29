import { gearName, ownedGear, ITEMS, formatStat, gearIn, gearLines, statDiff, type GearId, type GearRules, type GearSlot, type ItemId, type Slot } from '@vale/shared';
import { iconsVersion, itemIcon } from '../render/icons';
import type { Inventory } from '../session/types';

export interface BagHooks { inventory(): Inventory | null; rules(): GearRules | null; use(slot: number): void; drop(slot: number): void; equip(gear: GearId, slot: GearSlot): void; closed(): void }

// Painel do inventário (I): grade de espaços, detalhe do item escolhido, usar e largar.
export class BagPanel {
  private el = document.getElementById('bag')!;
  private grid = document.getElementById('bagGrid')!;
  private info = document.getElementById('bagInfo')!;
  private lines = document.getElementById('bagLines')!;
  private gearStats = document.getElementById('gearStats')!;
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
      const other = gearIn(inv, slot === 'a' ? 'c' : 'a'), mine = ownedGear(inv).filter(g => g !== other), cur = gearIn(inv, slot);
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
    const rules = this.hooks.rules();
    const key = JSON.stringify([inv.bag, inv.gold, inv.gear, this.sel, rules, iconsVersion()]);
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
      const g = gearIn(inv, slot); this.gearBtn[slot].textContent = `${slot.toUpperCase()}: ${gearName(g)} ⟳`;
      this.gearBtn[slot].setAttribute('aria-label', `Botão ${slot.toUpperCase()}: ${gearName(g)}. Trocar`);
    }
    const gear = !!cur && !!ITEMS[cur.id].gear;
    this.gearInfo(inv, rules, gear ? cur!.id as GearId : null);
    this.useBtn.textContent = gear ? 'Equipar no A' : 'Usar'; this.equipC.hidden = !gear;
    this.useBtn.disabled = !cur || (!gear && !ITEMS[cur.id].heal && !ITEMS[cur.id].mana);
    this.dropBtn.disabled = !cur;
  }
  // O que cada botão faz agora e, com uma arma escolhida, o que ela faz e o que muda ao equipar (verde melhora, vermelho piora).
  private gearInfo(inv: Inventory, rules: GearRules | null, g: GearId | null) {
    const a = gearIn(inv, 'a'), c = gearIn(inv, 'c'), li = (text: string, cls = '') => Object.assign(document.createElement('li'), { textContent: text, className: cls });
    this.gearStats.replaceChildren(...([['A', a], ['C', c]] as const).map(([k, id]) => {
      const d = document.createElement('div');
      d.append(Object.assign(document.createElement('b'), { textContent: `${k}: ${gearName(id)} ` }), document.createTextNode(rules ? gearLines(rules, id).join(' · ') : ''));
      return d;
    }));
    this.lines.hidden = !g || !rules;
    if (!g || !rules) { this.lines.replaceChildren(); return; }
    const out = gearLines(rules, g).map(t => li(t));
    for (const slot of ['a', 'c'] as const) {
      const other = slot === 'a' ? c : a, now = gearIn(inv, slot);
      if (g === now) { out.push(li(`Já está no ${slot.toUpperCase()}.`, 'cmp')); continue; }
      const diff = g === other ? [] : statDiff(rules, [a, c], [g, other]);   // já no outro botão: os dois trocam, nada muda
      const line = li(`No ${slot.toUpperCase()} (no lugar de ${gearName(now)}): `, 'cmp');
      if (!diff.length) line.append('atributos iguais');
      diff.forEach((d, i) => line.append(Object.assign(document.createElement('span'), { className: d.v > 0 ? 'up' : 'down', textContent: (i ? ', ' : '') + formatStat(d.k, d.v) })));
      out.push(line);
    }
    this.lines.replaceChildren(...out);
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
      const cv = document.createElement('canvas'), icon = itemIcon(s.id);
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

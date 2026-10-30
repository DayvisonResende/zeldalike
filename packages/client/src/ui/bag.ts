import { RARITY_COLOR, RARITY_NAME, STAT_KEYS, WEAR_NAME, WEAR_SLOTS, gearIdOf, groupOf, rarityOf, gearName, ITEMS, formatStat, gearIn, gearLines, nextGear, statDiff, statLines, EFFECT_NAME, EFFECT_UNIT, type GearId, type GearRules, type GearSlot, type Slot, type Stats, type WearSlot } from '@vale/shared';
import { iconsVersion, itemIcon } from '../render/icons';
import type { Inventory } from '../session/types';

export interface BagHooks {
  inventory(): Inventory | null; rules(): GearRules | null; use(slot: number): void; drop(slot: number): void; equip(gear: GearId, slot: GearSlot): void;
  wear(slot: number): void; unwear(part: WearSlot): void; sort(): void; closed(): void;
}
type Tab = 'all' | 'gear' | 'use' | 'material';

// Atributos de algo que se veste (os do item mais o sorteio do exemplar).
function wearStats(s: Slot): Partial<Stats> {
  const out: Partial<Stats> = { ...(s && ITEMS[s.id]?.wear?.stats) };
  for (const [k, v] of Object.entries(s?.roll ?? {}) as [keyof Stats, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}

/* Painel do inventário (I): armas no A e no C, o que está vestido (cabeça, colar, corpo, anel, pés), a mochila com
   abas por tipo e o botão Organizar, e o detalhe do item escolhido (usar, equipar, vestir, tirar, largar). */
export class BagPanel {
  private el = document.getElementById('bag')!;
  private grid = document.getElementById('bagGrid')!;
  private doll = document.getElementById('doll')!;
  private info = document.getElementById('bagInfo')!;
  private lines = document.getElementById('bagLines')!;
  private gearStats = document.getElementById('gearStats')!;
  private useBtn = document.getElementById('bagUse') as HTMLButtonElement;
  private dropBtn = document.getElementById('bagDrop') as HTMLButtonElement;
  private equipC = document.getElementById('bagEquipC') as HTMLButtonElement;
  private gearBtn = { a: document.getElementById('gearA') as HTMLButtonElement, c: document.getElementById('gearC') as HTMLButtonElement };
  private sel = -1; private selWear: WearSlot | null = null; private tab: Tab = 'all'; private shown = '';

  constructor(private hooks: BagHooks) {
    // o botão principal faz o que faz sentido para o escolhido: usar, equipar no A, vestir ou tirar
    this.useBtn.addEventListener('click', () => {
      if (this.selWear) { this.hooks.unwear(this.selWear); return; }
      const s = this.current(); if (!s) return;
      if (ITEMS[s.id].gear) this.hooks.equip(gearIdOf(s), 'a');
      else if (ITEMS[s.id].wear) this.hooks.wear(this.sel);
      else this.hooks.use(this.sel);
    });
    this.equipC.addEventListener('click', () => { const s = this.current(); if (s && ITEMS[s.id].gear) this.hooks.equip(gearIdOf(s), 'c'); });
    // A: / C: no topo alternam entre o que você tem e não está no outro botão (espada e arco sempre)
    for (const slot of ['a', 'c'] as const) this.gearBtn[slot].addEventListener('click', () => {
      const inv = this.hooks.inventory(), g = inv && nextGear(inv, slot);
      if (g) this.hooks.equip(g, slot);
    });
    for (const b of this.doll.querySelectorAll<HTMLButtonElement>('[data-wear]')) b.addEventListener('click', () => { this.selWear = b.dataset.wear as WearSlot; this.sel = -1; this.render(); });
    this.el.querySelectorAll<HTMLButtonElement>('[data-bagtab]').forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.bagtab as Tab; this.render(); }));
    document.getElementById('bagSort')!.addEventListener('click', () => { this.sel = -1; this.hooks.sort(); });
    this.dropBtn.addEventListener('click', () => { if (this.sel >= 0) this.hooks.drop(this.sel); });
    this.el.addEventListener('pointerdown', e => { if (e.target === this.el) this.close(); });
  }
  get open() { return !this.el.hidden; }
  toggle() { if (this.open) this.close(); else { this.el.hidden = false; this.shown = ''; this.render(); this.grid.querySelector<HTMLElement>('.slot')?.focus(); } }
  close() { if (!this.open) return; this.el.hidden = true; this.hooks.closed(); }
  private current() { return this.sel >= 0 ? this.hooks.inventory()?.bag[this.sel] ?? null : null; }

  // Redesenha só quando o inventário muda.
  render() {
    if (!this.open) return;
    const inv = this.hooks.inventory(); if (!inv) return;
    const rules = this.hooks.rules();
    const key = JSON.stringify([inv.bag, inv.wear, inv.gold, inv.gear, this.sel, this.selWear, this.tab, rules, iconsVersion()]);
    if (key === this.shown) return;
    this.shown = key;
    document.getElementById('bagGold')!.textContent = `${inv.gold} de ouro`;
    const focused = (document.activeElement as HTMLElement)?.dataset?.slot;
    // mochila: "Tudo" mostra os espaços (vazios também); as outras abas, só os itens daquele tipo
    const shown = inv.bag.map((s, i) => [s, i] as const).filter(([s]) => this.tab === 'all' || (!!s && (this.tab === 'gear' ? groupOf(s.id) === 'gear' || groupOf(s.id) === 'wear' : groupOf(s.id) === this.tab)));
    this.grid.replaceChildren(...shown.map(([s, i]) => this.slot(s, i)));
    if (!shown.length) this.grid.replaceChildren(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Nada deste tipo na mochila.' }));
    if (focused) this.grid.querySelector<HTMLElement>(`[data-slot="${focused}"]`)?.focus();
    this.el.querySelectorAll<HTMLButtonElement>('[data-bagtab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.bagtab === this.tab)));
    this.renderDoll(inv);
    for (const slot of ['a', 'c'] as const) {
      const g = gearIn(inv, slot); this.gearBtn[slot].textContent = `${slot.toUpperCase()}: ${gearName(g)} ⟳`;
      this.gearBtn[slot].setAttribute('aria-label', `Botão ${slot.toUpperCase()}: ${gearName(g)}. Trocar`);
    }
    // o escolhido: um espaço da mochila ou uma parte vestida
    const worn = this.selWear ? inv.wear[this.selWear] : null;
    if (this.selWear && !worn) this.selWear = null;
    const cur = worn ?? inv.bag[this.sel] ?? null;
    if (!cur) { this.sel = -1; this.info.textContent = 'Escolha um item.'; }
    else {   // nome na cor da raridade (e a raridade escrita, para quem não distingue as cores)
      const d = ITEMS[cur.id], r = rarityOf(cur.id);
      this.info.replaceChildren(Object.assign(document.createElement('b'), { textContent: d.name, style: `color:${RARITY_COLOR[r]}` }),
        document.createTextNode(`${cur.n > 1 ? ' ×' + cur.n : ''}${r !== 'common' ? ` (${RARITY_NAME[r]})` : ''}${worn ? ` · vestido (${WEAR_NAME[this.selWear!].toLowerCase()})` : ''} — ${d.desc}`));
    }
    const gear = !!cur && !worn && !!ITEMS[cur.id].gear, wear = !!cur && !!ITEMS[cur.id].wear;
    this.gearInfo(inv, rules, gear ? gearIdOf(cur!) : null);
    if (wear) this.wearInfo(inv, cur!, !!worn);
    this.useBtn.textContent = worn ? 'Tirar' : gear ? 'Equipar no A' : wear ? 'Vestir' : 'Usar';
    this.equipC.hidden = !gear;
    this.useBtn.disabled = !cur || (!gear && !wear && !ITEMS[cur.id].heal && !ITEMS[cur.id].mana && cur.id !== 'bomb');
    this.dropBtn.disabled = !cur || !!worn;   // o vestido, tire antes de largar
  }
  // O que está vestido: cada espaço com o ícone (ou o nome do espaço, vazio).
  private renderDoll(inv: Inventory) {
    for (const b of this.doll.querySelectorAll<HTMLButtonElement>('[data-wear]')) {
      const part = b.dataset.wear as WearSlot, s = inv.wear[part];
      b.replaceChildren(); b.style.removeProperty('--rar');
      b.setAttribute('aria-selected', String(this.selWear === part));
      b.setAttribute('aria-label', `${WEAR_NAME[part]}: ${s ? ITEMS[s.id]?.name ?? s.id : 'vazio'}`);
      if (!s) { b.append(Object.assign(document.createElement('small'), { textContent: WEAR_NAME[part] })); continue; }
      const cv = document.createElement('canvas'), icon = itemIcon(s.id);
      cv.width = icon.width; cv.height = icon.height; cv.getContext('2d')!.drawImage(icon, 0, 0);
      b.append(cv);
      if (rarityOf(s.id) !== 'common') b.style.setProperty('--rar', RARITY_COLOR[rarityOf(s.id)]);
      if (s.roll) b.append(Object.assign(document.createElement('i'), { className: 'roll', textContent: '+', title: 'Atributo sorteado' }));
    }
  }
  // Algo que se veste: os atributos dele e o que muda vestindo no lugar do atual (verde melhora, vermelho piora).
  private wearInfo(inv: Inventory, s: NonNullable<Slot>, worn: boolean) {
    const d = ITEMS[s.id].wear!, li = (text: string, cls = '') => Object.assign(document.createElement('li'), { textContent: text, className: cls });
    const mine = wearStats(s), out = [li(`Veste em: ${WEAR_NAME[d.slot]}`), ...statLines(mine).map(t => li(t))];
    if (d.effect) out.push(li(`${EFFECT_NAME[d.effect.kind]}: ${EFFECT_UNIT[d.effect.kind](d.effect.value)}`));
    if (!worn) {
      const now = inv.wear[d.slot], theirs = wearStats(now);
      const line = li(now ? `No lugar de ${ITEMS[now.id]?.name ?? now.id}: ` : 'Vestindo: ', 'cmp');
      const diff = STAT_KEYS.map(k => ({ k, v: (mine[k] ?? 0) - (theirs[k] ?? 0) })).filter(x => x.v);
      if (!diff.length) line.append('atributos iguais');
      diff.forEach((x, i) => line.append(Object.assign(document.createElement('span'), { className: x.v > 0 ? 'up' : 'down', textContent: (i ? ', ' : '') + formatStat(x.k, x.v) })));
      out.push(line);
    }
    this.lines.hidden = false; this.lines.replaceChildren(...out);
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
  private slot(s: Slot, i: number) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'slot'; b.dataset.slot = String(i);
    b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(i === this.sel));
    b.setAttribute('aria-label', s ? `${ITEMS[s.id].name}, ${RARITY_NAME[rarityOf(s.id)]}, ${s.n}` : 'Vazio');
    if (s && rarityOf(s.id) !== 'common') b.style.setProperty('--rar', RARITY_COLOR[rarityOf(s.id)]);   // borda na cor da raridade
    if (s) {
      const cv = document.createElement('canvas'), icon = itemIcon(s.id);
      cv.width = icon.width; cv.height = icon.height; cv.getContext('2d')!.drawImage(icon, 0, 0);
      b.append(cv);
      if (ITEMS[s.id].gear) { const inv = this.hooks.inventory(); for (const k of ['a', 'c'] as const) if (inv && gearIn(inv, k) === gearIdOf(s)) b.append(Object.assign(document.createElement('i'), { className: 'eq', textContent: k.toUpperCase() })); }
      if (s.n > 1) b.append(Object.assign(document.createElement('b'), { textContent: String(s.n) }));
      if (s.roll) b.append(Object.assign(document.createElement('i'), { className: 'roll', textContent: '+', title: 'Atributo sorteado' }));
    }
    b.addEventListener('click', () => { this.sel = i; this.selWear = null; this.render(); });
    // dois cliques: usa (ou veste)
    b.addEventListener('dblclick', () => { if (!s) return; if (ITEMS[s.id].wear) this.hooks.wear(i); else if (!ITEMS[s.id].gear) this.hooks.use(i); });
    return b;
  }
}

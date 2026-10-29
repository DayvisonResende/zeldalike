import { gearName, gearIn, gearLines, type GearRules } from '@vale/shared';
import type { Inventory } from '../session/types';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}) => Object.assign(document.createElement(tag), props);
const n = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
let shown = '';

/* Ficha "Atributos" (aba do menu): seus números e o que cada botão faz. Só mexe no DOM quando algo muda. */
export function renderSheet(inv: Inventory | null, rules: GearRules | null) {
  const sheet = document.getElementById('statSheet')!, gearEl = document.getElementById('statGear')!;
  const key = JSON.stringify([inv?.stats, inv?.maxHp, inv?.maxMp, inv?.level, inv?.gear, inv?.bag.map(s => s?.id), rules]);
  if (key === shown) return;
  shown = key;
  if (!inv) { sheet.replaceChildren(el('dd', { className: 'note', textContent: 'Entre no jogo para ver seus atributos.' })); gearEl.replaceChildren(); return; }
  const s = inv.stats, cut = s.defense > 0 ? Math.round(100 - 10000 / (100 + s.defense)) : 0;
  const row = (label: string, value: string, note: string) => [el('dt', { textContent: label }), el('dd', { textContent: value }), el('dd', { className: 'note', textContent: note })];
  const parts = (base: number, extra: number) => extra ? `nível ${n(base)} + equipamento ${n(extra)}` : `do nível ${inv.level}`;
  sheet.replaceChildren(
    ...row('Vida', n(inv.maxHp), parts(inv.maxHp - s.hp, s.hp)),
    ...row('Mana', n(inv.maxMp), parts(inv.maxMp - s.mp, s.mp)),
    ...row('Ataque', `+${n(s.attack)}`, 'no dano da espada e da flecha'),
    ...row('Poder mágico', `+${n(s.magic)}`, 'no dano das magias e na cura'),
    ...row('Velocidade de ataque', `+${n(s.attackSpeed)}%`, 'golpear, atirar, conjurar e carregar'),
    ...row('Defesa', n(s.defense), cut ? `−${cut}% do dano recebido` : 'sem redução de dano'),
    ...row('Regeneração', `+${n(s.hpRegen)} · +${n(s.mpRegen)}`, 'vida e mana por segundo, a mais')
  );
  gearEl.replaceChildren(...(['a', 'c'] as const).map(k => {
    const g = gearIn(inv, k), d = el('div');
    d.append(el('b', { textContent: `${k.toUpperCase()}: ${gearName(g)}` }), ...(rules ? gearLines(rules, g) : ['Carregando…']).map(t => el('span', { textContent: t })));
    return d;
  }));
}

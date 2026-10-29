import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, ITEMS, World, emptyInput, gearLines, kindOf, ownedGear, setItems, weaponDamage, type ItemDef, type MapData } from '../src';

// Equipamentos novos, como a Oficina cria: "comporta-se como" + números próprios.
const NEW: Record<string, ItemDef> = {
  'espada-de-ferro': { name: 'Espada de Ferro', desc: '', gear: { like: 'sword', damage: 15, stats: { defense: 20 }, color: '#9fb8ff' } },
  'arco-longo': { name: 'Arco Longo', desc: '', gear: { like: 'bow', damage: 20 } },
  'cajado-velho': { name: 'Cajado Velho', desc: '', gear: { like: 'firestaff', stats: { magic: 5 } } }
};
let before: Record<string, ItemDef>;
beforeAll(() => { before = { ...ITEMS }; setItems({ ...before, ...NEW }); });
afterAll(() => setItems(before));

function field(): MapData {
  const row = 'T' + '.'.repeat(18) + 'T';
  return { name: 'campo', cols: 20, rows: 8, spawn: { x: 40, y: 40 }, regions: [{ id: 'campo', name: 'Campo', x: 0, y: 0, w: 20, h: 8 }],
    tiles: ['T'.repeat(20), ...Array(6).fill(row), 'T'.repeat(20)], enemies: [{ type: 'slime', x: 9, y: 4 }], signs: {} };
}
// Ana com `gear` no A, colada numa geleca parada.
function setup(gear: string, alone = false) {
  const w = new World(field(), { ...DEFAULT_RULES, player: { ...DEFAULT_RULES.player, hpRegen: 0, manaRegen: 0 } });
  const e = w.enemies[0]; e.mode = 'idle'; e.timer = 1e6;
  const p = w.addPlayer('a', 'Ana', e.x - 14, e.y); p.dir = 3; p.aim = 0;
  p.bag[0] = { id: gear, n: 1 }; p.gear = { a: gear, c: 'bow' };
  if (alone) w.enemies = [];   // sem a geleca: a flecha e a magia não somem acertando nela
  w.step();
  return { w, p, e };
}
function press(w: World, steps: number) {
  w.setInput('a', { ...emptyInput(), a: true, tap: BUTTON.a }); w.step(); w.setInput('a', emptyInput());
  for (let i = 0; i < steps; i++) w.step();
}

describe('equipamentos da Oficina', () => {
  it('comporta-se como a arma de base', () => {
    expect([kindOf('espada-de-ferro'), kindOf('arco-longo'), kindOf('cajado-velho'), kindOf('sword'), kindOf('firestaff')]).toEqual(['sword', 'bow', 'firestaff', 'sword', 'firestaff']);
  });
  it('espada com dano próprio: golpe 15, giro e dash na mesma proporção', () => {
    const { w, e } = setup('espada-de-ferro');
    press(w, 15);
    expect(e.hp).toBe(20 - 15);
    expect([weaponDamage(w, 'espada-de-ferro', 'spin'), weaponDamage(w, 'espada-de-ferro', 'dash'), weaponDamage(w, 'sword', 'sword')]).toEqual([30, 30, 10]);
  });
  it('atributos do item valem enquanto ele estiver num botão', () => {
    const { w, p } = setup('espada-de-ferro');
    expect(p.stats.defense).toBe(20);
    p.gear = { a: 'sword', c: 'bow' }; w.step();
    expect(p.stats.defense).toBe(0);
  });
  it('arco com dano próprio: a flecha leva a força do arco', () => {
    const { w, p } = setup('arco-longo', true);
    press(w, 8);
    expect(w.arrows[0]?.k).toBe(2);
    expect(p.state).toBe('bow');
  });
  it('cajado da Oficina solta a magia do cajado de base, com o poder mágico dele', () => {
    const { w, p } = setup('cajado-velho', true);
    const mp = p.mp;
    press(w, 8);
    expect(w.spells.length).toBe(1);
    expect(p.mp).toBe(mp - w.rules.magic.fire.mana);
    expect(p.stats.magic).toBe(5);
  });
  it('mochila: equipamentos que dá para pôr num botão, e a descrição com os números do item', () => {
    const { w, p } = setup('espada-de-ferro');
    p.bag[1] = { id: 'heart', n: 2 }; p.bag[2] = { id: 'cajado-velho', n: 1 };
    expect(ownedGear(p)).toEqual(['sword', 'bow', 'espada-de-ferro', 'cajado-velho']);
    expect(gearLines(w.rules, 'espada-de-ferro')).toEqual(['Dano 15 · giro 30 · dash 30', '+20 defesa']);
  });
});

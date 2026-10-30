import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, ITEMS, World, addItem, emptyInput, emptyInventory, gearIdOf, ownedGear, parseInventory, refreshStats, rollFor, rollOf, sellItem, setItems, type ItemDef, type MapData } from '../src';

// Itens de teste: uma espada rara com sorteio, um arco épico que atravessa, uma espada lendária com onda e explosão.
const NEW: Record<string, ItemDef> = {
  'espada-rara': { name: 'Espada Rara', desc: '', rarity: 'rare', gear: { like: 'sword', rolls: { attack: [2, 4], defense: [5, 5], hp: [10, 10] } } },
  'arco-epico': { name: 'Arco Épico', desc: '', rarity: 'epic', gear: { like: 'bow', effect: { kind: 'pierce', value: 2 } } },
  'lamina-lendaria': { name: 'Lâmina Lendária', desc: '', rarity: 'legendary', gear: { like: 'sword', effect: { kind: 'lifesteal', value: 50 } } },
  'adaga-venenosa': { name: 'Adaga', desc: '', rarity: 'epic', gear: { like: 'sword', effect: { kind: 'poison', value: 4 } } },
  'espada-onda': { name: 'Espada da Onda', desc: '', rarity: 'legendary', gear: { like: 'sword', effect: { kind: 'wave', value: 25 } } },
  'martelo': { name: 'Martelo', desc: '', rarity: 'legendary', gear: { like: 'sword', effect: { kind: 'explode', value: 30 } } }
};
let before: Record<string, ItemDef>;
beforeAll(() => { before = { ...ITEMS }; setItems({ ...before, ...NEW }); });
afterAll(() => setItems(before));

function field(enemies: MapData['enemies'] = []): MapData {
  const row = 'T' + '.'.repeat(18) + 'T';
  return { name: 'campo', cols: 20, rows: 8, spawn: { x: 40, y: 40 }, regions: [{ id: 'campo', name: 'Campo', x: 0, y: 0, w: 20, h: 8 }],
    tiles: ['T'.repeat(20), ...Array(6).fill(row), 'T'.repeat(20)], enemies, signs: {} };
}
function setup(gear: string, enemies: MapData['enemies'] = [{ type: 'slime', x: 9, y: 4 }]) {
  const w = new World(field(enemies), { ...DEFAULT_RULES, player: { ...DEFAULT_RULES.player, hpRegen: 0 } });
  for (const e of w.enemies) { e.mode = 'idle'; e.timer = 1e6; }
  const e = w.enemies[0];
  const p = w.addPlayer('a', 'Ana', (e?.x ?? 150) - 14, e?.y ?? 74); p.dir = 3; p.aim = 0;
  p.bag[0] = { id: gear, n: 1 }; p.gear = { a: gear, c: 'bow' };
  w.step();
  return { w, p, e };
}
const press = (w: World, b: 'a' | 'c', steps: number) => { w.setInput('a', { ...emptyInput(), [b]: true, tap: BUTTON[b] }); w.step(); w.setInput('a', emptyInput()); for (let i = 0; i < steps; i++) w.step(); };

describe('raridade e sorteio', () => {
  it('raro sorteia 2 atributos do item, cada um dentro da faixa', () => {
    const { w } = setup('espada-rara', []);
    for (let i = 0; i < 20; i++) {
      const r = rollFor(w, 'espada-rara')!;
      expect(Object.keys(r).length).toBe(2);
      if (r.attack !== undefined) expect(r.attack).toBeGreaterThanOrEqual(2), expect(r.attack).toBeLessThanOrEqual(4);
    }
    expect(rollFor(w, 'arco-epico')).toBeUndefined();   // épico é fixo
  });
  it('exemplar sorteado: id próprio, não empilha, e os atributos do sorteio contam', () => {
    const { w, p } = setup('sword', []);
    const inv = emptyInventory(4);
    addItem(inv, 'espada-rara', 1, 99, { defense: 5 }); addItem(inv, 'espada-rara', 1, 99, { hp: 10 });
    expect(inv.filter(Boolean).length).toBe(2);
    const g = gearIdOf(inv[0]!);
    expect(g).toBe('espada-rara#defense=5');
    expect(rollOf(g)).toEqual({ defense: 5 });
    p.bag = inv; p.gear = { a: g, c: 'bow' }; refreshStats(w, p);
    expect(p.stats.defense).toBe(5);
    expect(ownedGear(p)).toEqual(['sword', 'bow', 'espada-rara#defense=5', 'espada-rara#hp=10']);
    // vai ao banco e volta igual
    expect(parseInventory(JSON.parse(JSON.stringify(inv)), 4, 99)[1]).toEqual({ id: 'espada-rara', n: 1, roll: { hp: 10 } });
  });
  it('a loja vende primeiro o exemplar sem sorteio e fora dos botões', () => {
    const { w, p } = setup('sword', []);
    w.rules = { ...w.rules, shops: { s: { buy: {}, sell: { 'espada-rara': 5 } } } };
    w.map.data.npcs = [{ x: Math.floor(p.x / 16) + 1, y: Math.floor(p.y / 16), name: 'Rosa', pages: ['oi'], look: { cloak: 0, hair: 0 }, dir: 0, shop: 's' }];
    p.bag = emptyInventory(4); addItem(p.bag, 'espada-rara', 1, 99, { attack: 4 }); addItem(p.bag, 'espada-rara', 1, 99);
    expect(sellItem(w, p, 's', 'espada-rara', 1)).toEqual({ ok: true });
    expect(p.bag.filter(Boolean)).toEqual([{ id: 'espada-rara', n: 1, roll: { attack: 4 } }]);
  });
});

describe('efeitos', () => {
  it('roubo de vida: metade do dano volta', () => {
    const { w, p } = setup('lamina-lendaria');
    p.hp = 50; press(w, 'a', 15);
    expect(p.hp).toBe(55);   // golpe de 10 → +5
  });
  it('veneno: depois do golpe, o monstro perde vida por segundo', () => {
    const { w, e } = setup('adaga-venenosa');
    press(w, 'a', 15);
    const hp = e.hp;
    for (let i = 0; i < 125; i++) w.step();
    expect(hp - e.hp).toBe(8);   // 2 segundos × 4
  });
  it('flecha que atravessa: passa por 2 monstros e acerta o terceiro', () => {
    const { w, p } = setup('sword', [{ type: 'slime', x: 7, y: 4 }, { type: 'slime', x: 9, y: 4 }, { type: 'slime', x: 11, y: 4 }]);
    w.enemies = w.enemies.slice(); p.x = 3 * 16; p.bag[1] = { id: 'arco-epico', n: 1 }; p.gear = { a: 'sword', c: 'arco-epico' }; w.step();
    press(w, 'c', 60);
    expect(w.enemies.filter(e => e.hp < 20).length).toBe(3);
  });
  it('explode ao derrubar: o vizinho também apanha', () => {
    const { w, p } = setup('martelo', [{ type: 'slime', x: 9, y: 4 }, { type: 'slime', x: 10, y: 4 }]);
    const [a, b] = w.enemies; a.hp = 5;
    press(w, 'a', 40);
    expect(a.dead).toBe(true);
    expect(b.hp).toBeLessThan(20);
    expect(p.effects).toEqual({ explode: 30 });
  });
  it('onda ao girar: o giro carregado fere quem está em volta, longe da espada', () => {
    const { w, p, e } = setup('espada-onda');
    e.x = p.x + 36;   // fora do alcance da espada, dentro da onda
    w.setInput('a', { ...emptyInput(), a: true, tap: BUTTON.a }); w.step();
    for (let i = 0; i < 60; i++) { w.setInput('a', { ...emptyInput(), a: true }); w.step(); }   // segura até carregar
    w.setInput('a', emptyInput()); w.step(); w.step();
    expect(e.dying).toBe(true);   // 25 de dano na geleca de 20
  });
});

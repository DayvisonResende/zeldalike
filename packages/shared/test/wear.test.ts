import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, ITEMS, World, addItem, emptyInventory, refreshStats, rollFor, setItems, sortBag, unwearItem, wearItem, type ItemDef, type MapData } from '../src';

const NEW: Record<string, ItemDef> = {
  'elmo': { name: 'Elmo', desc: '', rarity: 'uncommon', wear: { slot: 'head', stats: { defense: 10 }, rolls: { hp: [5, 5] } } },
  'elmo-velho': { name: 'Elmo Velho', desc: '', wear: { slot: 'head', stats: { defense: 2 } } },
  'anel-vampiro': { name: 'Anel Vampiro', desc: '', rarity: 'legendary', wear: { slot: 'ring', effect: { kind: 'lifesteal', value: 10 } } },
  'botas': { name: 'Botas', desc: '', wear: { slot: 'feet', stats: { hp: 20 } } }
};
let before: Record<string, ItemDef>;
beforeAll(() => { before = { ...ITEMS }; setItems({ ...before, ...NEW }); });
afterAll(() => setItems(before));

function setup() {
  const row = 'T' + '.'.repeat(8) + 'T';
  const map: MapData = { name: 'c', cols: 10, rows: 5, spawn: { x: 40, y: 40 }, regions: [{ id: 'c', name: 'C', x: 0, y: 0, w: 10, h: 5 }], tiles: ['T'.repeat(10), row, row, row, 'T'.repeat(10)], enemies: [], signs: {} };
  const w = new World(map, DEFAULT_RULES), p = w.addPlayer('a', 'Ana', 40, 40);
  p.bag = emptyInventory(4);
  return { w, p };
}

describe('vestir', () => {
  it('vestir tira da mochila e soma os atributos (com o sorteio); tirar devolve', () => {
    const { w, p } = setup();
    addItem(p.bag, 'elmo', 1, 99, { hp: 5 }); addItem(p.bag, 'botas', 1, 99);
    expect(wearItem(w, p, 0)).toEqual({ ok: true });
    expect(wearItem(w, p, 1)).toEqual({ ok: true });
    expect(p.bag.filter(Boolean)).toEqual([]);
    refreshStats(w, p);
    expect([p.stats.defense, p.stats.hp, p.maxHp]).toEqual([10, 25, 125]);
    expect(unwearItem(w, p, 'head')).toEqual({ ok: true });
    expect(p.bag[0]).toEqual({ id: 'elmo', n: 1, roll: { hp: 5 } });
    refreshStats(w, p);
    expect(p.stats.defense).toBe(0);
  });
  it('vestir no lugar de outro: os dois trocam (o velho volta para o mesmo espaço)', () => {
    const { w, p } = setup();
    addItem(p.bag, 'elmo-velho', 1, 99); wearItem(w, p, 0);
    addItem(p.bag, 'elmo', 1, 99); wearItem(w, p, 0);
    expect(p.wear.head?.id).toBe('elmo');
    expect(p.bag[0]?.id).toBe('elmo-velho');
  });
  it('mochila cheia: não dá para tirar; o que não se veste é recusado', () => {
    const { w, p } = setup();
    addItem(p.bag, 'botas', 1, 99); wearItem(w, p, 0);
    for (let i = 0; i < 4; i++) addItem(p.bag, 'heart', 99, 99);
    expect(unwearItem(w, p, 'feet')).toEqual({ ok: false, reason: 'Mochila cheia: libere um espaço para tirar.' });
    expect(wearItem(w, p, 0)).toEqual({ ok: false, reason: 'Isso não se veste.' });
  });
  it('efeito de acessório vale como o da arma', () => {
    const { w, p } = setup();
    addItem(p.bag, 'anel-vampiro', 1, 99); wearItem(w, p, 0); refreshStats(w, p);
    expect(p.effects.lifesteal).toBe(10);
  });
  it('sorteio também em armadura; organizar agrupa armas, vestir, consumíveis e materiais, raros primeiro', () => {
    const { w, p } = setup();
    expect(rollFor(w, 'elmo')).toEqual({ hp: 5 });
    p.bag = emptyInventory(6);
    addItem(p.bag, 'jelly', 2, 99); addItem(p.bag, 'heart', 1, 99); addItem(p.bag, 'elmo-velho', 1, 99); addItem(p.bag, 'firestaff', 1, 99); addItem(p.bag, 'elmo', 1, 99);
    sortBag(p);
    expect(p.bag.map(s => s?.id ?? null)).toEqual(['firestaff', 'elmo', 'elmo-velho', 'heart', 'jelly', null]);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, World, buyItem, emptyInput, sellItem, type GameEvent, type MapData, type Rules } from '../src';

// Praça 10×6 com a Rosa (loja "praca") em (5,2).
function plaza(): MapData {
  return {
    name: 'praça', cols: 10, rows: 6, spawn: { x: 40, y: 40 },
    regions: [{ id: 'praca', name: 'Praça', x: 0, y: 0, w: 10, h: 6 }],
    tiles: ['TTTTTTTTTT', 'T........T', 'T........T', 'T........T', 'T........T', 'TTTTTTTTTT'],
    enemies: [], signs: {},
    npcs: [{ x: 5, y: 2, name: 'Rosa', pages: ['Olá!'], look: { cloak: 0, hair: 0 }, dir: 0, shop: 'praca' }]
  };
}
const rules: Rules = { ...DEFAULT_RULES, inventory: { slots: 3, stack: 9 }, shops: { praca: { buy: { heart: 10, bomb: 25 }, sell: { jelly: 3 } } } };
function setup() {
  const w = new World(plaza(), rules), p = w.addPlayer('a', 'Ana', 5 * 16 + 8, 3 * 16 + 8);
  p.gold = 100;
  return { w, p };
}

describe('loja', () => {
  it('falar com o lojista abre a fala com a oferta da loja', () => {
    const { w, p } = setup();
    p.dir = 1;   // olhando para a Rosa, logo acima
    w.setInput('a', { ...emptyInput(), b: true, tap: 2 }); const ev = w.step() as GameEvent[];
    const d = ev.find(e => e.t === 'dialog') as Extract<GameEvent, { t: 'dialog' }>;
    expect(d.shop).toEqual({ id: 'praca', name: 'Rosa', buy: [['heart', 10], ['bomb', 25]], sell: [['jelly', 3]] });
  });
  it('compra: cobra, põe no inventário e recusa o que a loja não vende', () => {
    const { w, p } = setup();
    expect(buyItem(w, p, 'praca', 'heart', 3)).toEqual({ ok: true });
    expect(p.gold).toBe(70); expect(p.bag[0]).toEqual({ id: 'heart', n: 3 });
    expect(buyItem(w, p, 'praca', 'mana', 1).ok).toBe(false);
    expect(buyItem(w, p, 'praca', 'heart', 0).ok).toBe(false);
  });
  it('sem ouro suficiente não compra nada', () => {
    const { w, p } = setup();
    const r = buyItem(w, p, 'praca', 'bomb', 5);
    expect(r).toEqual({ ok: false, reason: 'Falta ouro: 5 custam 125.' });
    expect(p.gold).toBe(100); expect(p.bag.every(s => !s)).toBe(true);
  });
  it('inventário quase cheio: compra só o que cabe e cobra só por isso', () => {
    const { w, p } = setup();
    p.bag = [{ id: 'jelly', n: 9 }, { id: 'shell', n: 9 }, { id: 'heart', n: 7 }];
    const r = buyItem(w, p, 'praca', 'heart', 5);
    expect(r.ok).toBe(false); expect(p.bag[2]).toEqual({ id: 'heart', n: 9 }); expect(p.gold).toBe(80);
    expect(buyItem(w, p, 'praca', 'heart', 1)).toEqual({ ok: false, reason: 'Inventário cheio.' });
  });
  it('vende: paga pelo que tinha, juntando de vários espaços', () => {
    const { w, p } = setup();
    p.bag = [{ id: 'jelly', n: 2 }, null, { id: 'jelly', n: 4 }];
    expect(sellItem(w, p, 'praca', 'jelly', 5)).toEqual({ ok: true });
    expect(p.gold).toBe(115); expect(p.bag).toEqual([null, null, { id: 'jelly', n: 1 }]);
    expect(sellItem(w, p, 'praca', 'heart', 1).ok).toBe(false);   // a Rosa não compra coração
  });
  it('longe do lojista (ou caído) não negocia', () => {
    const { w, p } = setup();
    p.x = 1 * 16 + 8; p.y = 4 * 16 + 8;
    expect(buyItem(w, p, 'praca', 'heart', 1)).toEqual({ ok: false, reason: 'Chegue mais perto do lojista.' });
    p.x = 5 * 16 + 8; p.y = 3 * 16 + 8; p.state = 'dead';
    expect(buyItem(w, p, 'praca', 'heart', 1).ok).toBe(false);
    expect(p.gold).toBe(100);
  });
});

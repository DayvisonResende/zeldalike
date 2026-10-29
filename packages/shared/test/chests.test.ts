import { describe, expect, it } from 'vitest';
import { BUTTON, World, blockedAt, chestWait, emptyInput, openChests, parseLoot, type GameEvent, type MapData } from '../src';

// Sala 8×4 com um baú no meio; a jogadora começa olhando para ele.
function room(): MapData {
  return {
    name: 'sala', cols: 8, rows: 4, spawn: { x: 40, y: 40 },
    regions: [{ id: 'sala', name: 'Sala', x: 0, y: 0, w: 8, h: 4 }],
    tiles: ['TTTTTTTT', 'T......T', 'T......T', 'TTTTTTTT'], enemies: [], signs: {},
    chests: [{ x: 4, y: 1, loot: [{ item: 'gold', chance: 1, min: 5, max: 5 }, { item: 'heart', chance: 1, min: 1, max: 1 }], respawn: 600 }]
  };
}
function setup() {
  const w = new World(room()); let t = 1_000_000; w.now = () => t;
  const p = w.addPlayer('a', 'Ana', 4 * 16 + 8, 2 * 16 + 4); p.dir = 1;   // encostada embaixo do baú, olhando para cima
  const press = () => { w.setInput('a', { ...emptyInput(), b: true, tap: BUTTON.b }); const ev: GameEvent[] = w.step(); for (let i = 0; i < 40; i++) { w.setInput('a', emptyInput()); ev.push(...w.step()); } return ev; };
  return { w, p, press, later: (ms: number) => { t += ms; } };
}

describe('baús', () => {
  it('ocupam o tile: ninguém atravessa', () => {
    const { w } = setup();
    expect(blockedAt(w.map, 4 * 16 + 8, 1 * 16 + 8, 5, 4)).toBe(true);
  });
  it('abrir solta o conteúdo, que vai para quem abriu', () => {
    const { w, p, press } = setup();
    press();
    expect(p.gold).toBe(5);
    expect(p.bag[0]).toEqual({ id: 'heart', n: 1 });
    expect(openChests(w, p)).toEqual(['4,1']);
  });
  it('depois de aberto, fica vazio para você até encher de novo', () => {
    const { w, p, press, later } = setup();
    press();
    const ev = press();
    expect(ev).toContainEqual({ t: 'notice', to: 'a', text: 'Vazio. Enche de novo em 10 min.' });
    expect(p.gold).toBe(5);
    later(601_000);
    expect(chestWait(w, p, w.map.data.chests![0])).toBe(0);
    press();
    expect(p.gold).toBe(10);
  });
  it('mochila cheia: o que não cabe fica guardado no baú para quem abriu; abrir de novo entrega', () => {
    const { w, p, press } = setup();
    for (let i = 0; i < p.bag.length; i++) p.bag[i] = { id: 'jelly', n: 99 };
    const ev = press();
    expect(p.gold).toBe(5);                                   // ouro entra na carteira mesmo assim
    expect(ev).toContainEqual({ t: 'notice', to: 'a', text: 'Mochila cheia: o resto ficou guardado no baú para você.' });
    expect(openChests(w, p)).toEqual([]);                     // aparece fechado: ainda tem coisa para você
    const b = w.addPlayer('b', 'Beto', 4 * 16 + 8, 2 * 16 + 10);
    expect(b.chestLoot).toEqual({});                          // o resto é só da Ana
    w.removePlayer('b');
    p.bag[0] = null;                                          // abriu espaço
    press();
    expect(p.bag[0]).toEqual({ id: 'heart', n: 1 });
    expect(p.gold).toBe(5);                                   // o ouro não vem de novo
    expect(openChests(w, p)).toEqual(['4,1']);
  });
  it('cada personagem tem o seu: outro jogador ainda pode abrir', () => {
    const { w, press } = setup();
    press();
    const b = w.addPlayer('b', 'Beto', 4 * 16 + 8, 2 * 16 + 10);
    expect(openChests(w, b)).toEqual([]);
  });
});

describe('conteúdo do baú no Tiled', () => {
  it('aceita quantidade, faixa, chance e nomes em português', () => {
    expect(parseLoot('gold:10-20, heart:2, shell:1@50%, poção:1')).toEqual([
      { item: 'gold', min: 10, max: 20, chance: 1 }, { item: 'heart', min: 2, max: 2, chance: 1 },
      { item: 'shell', min: 1, max: 1, chance: 0.5 }, { item: 'mana', min: 1, max: 1, chance: 1 }
    ]);
  });
  it('explica o que está errado', () => {
    expect(parseLoot('espada:1')).toMatch(/item "espada" não existe/);
    expect(parseLoot('gold:dez')).toMatch(/não entendi "gold:dez"/);
    expect(parseLoot('')).toMatch(/falta a propriedade "conteudo"/);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, World, addItem, dropItem, emptyInventory, gainXp, parseInventory, useItem, xpToNext, type MapData, type Rules } from '../src';
import vale from './fixtures';

const calm = (): MapData => ({ ...(vale as MapData), enemies: [{ type: 'slime', x: 20, y: 7 }] });
// geleca que sempre solta 2 de ouro e 1 coração
const rules: Rules = {
  ...DEFAULT_RULES,
  enemies: { ...DEFAULT_RULES.enemies, slime: { ...DEFAULT_RULES.enemies.slime, hp: 1, drops: [{ item: 'gold', chance: 1, min: 2, max: 2 }, { item: 'heart', chance: 1, min: 1, max: 1 }] } },
  loot: { ownerTime: 2, lifetime: 5 }
};
const run = (w: World, s: number) => { for (let i = 0; i < s * TICK_RATE; i++) w.step(); };
// mata a geleca com Ana como autora do golpe
function kill(w: World, by: string) {
  const e = w.enemies[0]; e.lastHitBy = by; e.hp = 0; e.dying = true; e.hurtT = 1; e.mode = 'idle'; e.timer = 999;
  w.step();
  return e;
}

describe('XP e níveis', () => {
  it('curva: cada nível pede mais', () => {
    const w = new World(calm(), rules);
    expect([1, 2, 5].map(l => xpToNext(w, l))).toEqual([50, 141, 559]);
  });
  it('derrubar monstro dá XP a quem deu o último golpe; subir de nível enche vida e aumenta o máximo', () => {
    const w = new World(calm(), rules), p = w.addPlayer('a', 'Ana');
    p.xp = 48; p.hp = 30;
    kill(w, 'a');
    expect(p.level).toBe(2);
    expect(p.xp).toBe(48 + 5 - 50);
    const l = rules.leveling, hp = rules.player.maxHp + l.hpPerLevel, mp = rules.player.maxMana + l.manaPerLevel;
    expect([p.hp, p.maxHp, p.maxMp]).toEqual([hp, hp, mp]);
  });
  it('taxa de XP do config multiplica', () => {
    const w = new World(calm(), { ...rules, rates: { ...rules.rates, xp: 2 } }), p = w.addPlayer('a', 'Ana');
    gainXp(w, p, 5);
    expect(p.xp).toBe(10);
  });
});

describe('drops', () => {
  it('caem no chão e ficam reservados a quem derrubou; depois, qualquer um pega', () => {
    const w = new World(calm(), rules);
    const a = w.addPlayer('a', 'Ana', 24 * 16, 7 * 16), b = w.addPlayer('b', 'Beto');
    const e = kill(w, 'a');
    expect(w.drops.map(d => [d.item, d.n])).toEqual([['gold', 2], ['heart', 1]]);
    b.x = e.x; b.y = e.y;                     // Beto em cima do loot da Ana
    run(w, 1);
    expect([b.gold, w.drops.length]).toEqual([0, 2]);
    run(w, 1.5);                              // passou o tempo de reserva
    expect(b.gold).toBe(2);
    expect(b.bag[0]).toEqual({ id: 'heart', n: 1 });
    expect(a.gold).toBe(0);
  });
  it('somem depois do tempo de vida', () => {
    const w = new World(calm(), rules); w.addPlayer('a', 'Ana', 40 * 16, 24 * 16);
    kill(w, 'a');
    run(w, 5.2);
    expect(w.drops).toHaveLength(0);
  });
  it('inventário cheio: o item fica no chão, mas o ouro entra', () => {
    const w = new World(calm(), rules), a = w.addPlayer('a', 'Ana');
    for (let i = 0; i < a.bag.length; i++) a.bag[i] = { id: 'jelly', n: 99 };
    const e = kill(w, 'a'); a.x = e.x; a.y = e.y;
    run(w, 0.5);
    expect(a.gold).toBe(2);
    expect(w.drops.map(d => d.item)).toEqual(['heart']);
  });
});

describe('inventário', () => {
  it('empilha até o limite e usa o próximo espaço', () => {
    const inv = emptyInventory(3);
    expect(addItem(inv, 'jelly', 150, 99)).toBe(0);
    expect(inv).toEqual([{ id: 'jelly', n: 99 }, { id: 'jelly', n: 51 }, null]);
    expect(addItem(inv, 'shell', 200, 99)).toBe(101);   // só coube um espaço
  });
  it('coração cura, some do inventário e não é gasto com vida cheia', () => {
    const w = new World(calm(), rules), p = w.addPlayer('a', 'Ana');
    p.bag[0] = { id: 'heart', n: 2 };
    expect(useItem(w, p, 0)).toEqual({ ok: false, reason: 'Sua vida já está cheia.' });
    p.hp = 50;
    expect(useItem(w, p, 0)).toEqual({ ok: true });
    expect([p.hp, p.bag[0]]).toEqual([75, { id: 'heart', n: 1 }]);
    p.hp = 50;
    expect(useItem(w, p, 0)).toMatchObject({ ok: false });   // meio segundo entre um item e outro
  });
  it('largar no chão deixa o item para qualquer um (passar para um amigo)', () => {
    const w = new World(calm(), rules), a = w.addPlayer('a', 'Ana'), b = w.addPlayer('b', 'Beto', a.x + 40, a.y);
    a.bag[3] = { id: 'shell', n: 4 };
    expect(dropItem(w, a, 3)).toEqual({ ok: true });
    expect(a.bag[3]).toBeNull();
    b.x = a.x; b.y = a.y + 6; a.x += 40;
    run(w, 1.5);
    expect(b.bag[0]).toEqual({ id: 'shell', n: 4 });
  });
  it('inventário vindo do banco: lixo vira espaço vazio', () => {
    expect(parseInventory([{ id: 'heart', n: 3 }, { id: 'espada-lendaria', n: 1 }, { id: 'mana', n: -2 }, null], 4, 99)).toEqual([{ id: 'heart', n: 3 }, null, null, null]);
  });
});

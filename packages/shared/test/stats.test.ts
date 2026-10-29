import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, TICK_RATE, World, damagePlayer, emptyInput, type MapData, type Rules, type Stats } from '../src';

function field(): MapData {
  const row = 'T' + '.'.repeat(18) + 'T';
  return { name: 'campo', cols: 20, rows: 8, spawn: { x: 40, y: 40 }, regions: [{ id: 'campo', name: 'Campo', x: 0, y: 0, w: 20, h: 8 }],
    tiles: ['T'.repeat(20), ...Array(6).fill(row), 'T'.repeat(20)], enemies: [{ type: 'slime', x: 9, y: 4 }], signs: {} };
}
// Ana olhando para a direita, colada numa geleca parada; `sword` = bônus da espada.
function setup(sword: Partial<Stats> = {}, extra: Partial<Rules> = {}) {
  const w = new World(field(), { ...DEFAULT_RULES, gear: { sword }, player: { ...DEFAULT_RULES.player, hpRegen: 0, manaRegen: 0 }, ...extra });
  const e = w.enemies[0]; e.mode = 'idle'; e.timer = 1e6;
  const p = w.addPlayer('a', 'Ana', e.x - 14, e.y); p.dir = 3; p.aim = 0;
  w.step();
  return { w, p, e };
}
// Um golpe de espada: devolve quantos passos ele durou.
function swing(w: World) {
  w.setInput('a', { ...emptyInput(), a: true, tap: BUTTON.a }); w.step(); w.setInput('a', emptyInput());
  let n = 1; while (w.players.get('a')!.state === 'swing' && n < 60) { w.step(); n++; }
  return n;
}

describe('atributos', () => {
  it('sem bônus, tudo como antes: a geleca leva 2 golpes', () => {
    const { w, e } = setup();
    swing(w); expect(e.hp).toBe(10);
  });
  it('ataque soma no dano da espada', () => {
    const { w, e } = setup({ attack: 10 });
    swing(w); expect(e.dying).toBe(true);
  });
  it('defesa reduz o dano recebido (100 = metade)', () => {
    const { w, p } = setup({ defense: 100 });
    damagePlayer(w, p, 20, { x: 0, y: 0 });
    expect(p.hp).toBe(p.maxHp - 10);
  });
  it('vida a mais sobe o máximo sem curar; perdendo o bônus, corta o que passou', () => {
    const { w, p } = setup({ hp: 30 });
    expect(p.maxHp).toBe(130);
    expect(p.hp).toBe(100);
    p.hp = 130;
    w.rules = { ...w.rules, gear: {} }; w.step();   // a espada deixou de dar vida
    expect([p.maxHp, p.hp]).toEqual([100, 100]);
  });
  it('regeneração a mais', () => {
    const { w, p } = setup({ hpRegen: 6 });
    p.hp = 50; p.hurtAt = -1e9;
    for (let i = 0; i < TICK_RATE; i++) w.step();
    expect(Math.round(p.hp)).toBe(56);
  });
  it('velocidade de ataque deixa o golpe mais curto (e tem teto)', () => {
    expect(swing(setup().w)).toBe(14);                        // o passo do toque + 13
    expect(swing(setup({ attackSpeed: 50 }).w)).toBe(10);     // 13 / 1,5
    expect(swing(setup({ attackSpeed: 300 }).w)).toBe(10);    // teto de 50%
  });
  it('poder mágico aumenta a cura do Cajado de Luz', () => {
    const { w, p } = setup({}, { gear: { lightstaff: { magic: 5 } } });
    p.bag[0] = { id: 'lightstaff', n: 1 }; p.gear = { a: 'lightstaff', c: 'bow' }; p.hp = 50; p.mp = 50;
    w.step();
    w.setInput('a', { ...emptyInput(), a: true, tap: BUTTON.a }); w.step(); w.setInput('a', emptyInput());
    for (let i = 0; i < 20; i++) w.step();
    expect(p.hp).toBe(50 + w.rules.magic.heal.amount + 5);
  });
});

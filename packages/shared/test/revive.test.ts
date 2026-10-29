import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, World, damagePlayer, emptyInput, type InputState, type MapData } from '../src';

function field(): MapData {
  const row = 'T' + '.'.repeat(14) + 'T';
  return { name: 'campo', cols: 16, rows: 6, spawn: { x: 24, y: 24 }, regions: [{ id: 'campo', name: 'Campo', x: 0, y: 0, w: 16, h: 6 }],
    tiles: ['T'.repeat(16), ...Array(4).fill(row), 'T'.repeat(16)], enemies: [], signs: {} };
}
function setup() {
  const w = new World(field(), DEFAULT_RULES);
  const a = w.addPlayer('a', 'Ana', 8 * 16, 3 * 16), b = w.addPlayer('b', 'Beto', 8 * 16 + 10, 3 * 16);
  damagePlayer(w, a, 999, { x: 0, y: 0 });
  const run = (s: number, inp: Partial<InputState> = {}) => { for (let i = 0; i < s * TICK_RATE; i++) { w.setInput('a', emptyInput()); w.setInput('b', { ...emptyInput(), ...inp }); w.step(); } };
  return { w, a, b, run };
}

describe('levantar amigo caído', () => {
  it('segurar o botão de Ação ao lado levanta com metade da vida, ali mesmo', () => {
    const { a, run } = setup();
    expect(a.state).toBe('dead');
    const x = a.x;
    run(1.6, { b: true });
    expect(a.state).toBe('walk');
    expect([a.hp, a.x]).toEqual([Math.ceil(a.maxHp / 2), x]);
  });
  it('enquanto alguém levanta, a contagem para (mesmo começando no fim)', () => {
    const { a, run } = setup();
    run(4.5);                       // quase renascendo
    run(1.6, { b: true });          // passaria do tempo, mas a contagem parou
    expect(a.state).toBe('walk');
    expect(a.x).toBe(8 * 16);       // não renasceu no ponto de partida
  });
  it('soltar recomeça o progresso; longe demais não levanta; sem ninguém, renasce no tempo de sempre', () => {
    const { a, b, run } = setup();
    run(1, { b: true }); run(0.2);  // soltou antes de terminar
    expect(a.revive).toBe(0);
    b.x += 60;                       // longe
    run(2, { b: true });
    expect(a.state).toBe('dead');
    run(3);
    expect(a.state).toBe('walk');
    expect(a.x).toBe(24);           // renasceu no ponto de partida
  });
});

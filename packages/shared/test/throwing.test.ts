import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, TICK_RATE, World, damagePlayer, emptyInput, type MapData } from '../src';

// Campo 12×6 com um rio no meio (colunas 6 e 7) e uma geleca parada do outro lado.
function field(): MapData {
  return {
    name: 'campo', cols: 12, rows: 6, spawn: { x: 40, y: 40 },
    regions: [{ id: 'campo', name: 'Campo', x: 0, y: 0, w: 12, h: 6 }],
    tiles: ['TTTTTTTTTTTT', 'T.....ww...T', 'T.....ww...T', 'T.....ww...T', 'T.....ww...T', 'TTTTTTTTTTTT'],
    enemies: [{ type: 'slime', x: 10, y: 4 }], signs: {}
  };
}
function setup() {
  const w = new World(field());
  const a = w.addPlayer('a', 'Ana', 3 * 16 + 8, 2 * 16 + 8), b = w.addPlayer('b', 'Beto', 4 * 16 + 4, 2 * 16 + 8);
  a.dir = 3; a.aim = 0;
  const s = w.enemies[0]; s.mode = 'idle'; s.timer = 1e9;
  const tap = (id: string, bits: number) => { w.setInput(id, { ...emptyInput(), b: !!(bits & BUTTON.b), tap: bits }); w.step(); };
  const run = (n: number) => { for (let i = 0; i < n; i++) { w.setInput('a', emptyInput()); w.setInput('b', emptyInput()); w.step(); } };
  return { w, a, b, slime: s, tap, run };
}

describe('levantar e arremessar amigos', () => {
  it('E de frente para alguém levanta; a pessoa acompanha quem carrega', () => {
    const { a, b, tap, run } = setup();
    tap('a', BUTTON.b);
    expect([a.carry, b.state, b.heldBy]).toEqual(['player', 'held', 'a']);
    run(15);
    a.x += 10; run(1);
    expect([b.x, b.z]).toEqual([a.x, 16]);
  });
  it('arremessar faz voar por cima do rio e cair em chão livre do outro lado', () => {
    const { a, b, tap, run } = setup();
    tap('a', BUTTON.b); run(15);
    tap('a', BUTTON.b);
    expect(b.state).toBe('flying');
    run(60);
    expect(b.state).not.toBe('flying');
    expect(b.x).toBeGreaterThan(8 * 16);            // atravessou o rio
    expect(b.hp).toBe(b.maxHp);                     // sem dano
  });
  it('quem está no colo aperta as teclas rápido e se solta', () => {
    const { w, a, b, tap } = setup();
    tap('a', BUTTON.b);
    for (let i = 0; i < DEFAULT_RULES.fun.struggle; i++) {
      w.setInput('b', { ...emptyInput(), up: i % 2 === 0, down: i % 2 === 1 }); w.step();
    }
    expect([b.state, a.carry]).toEqual(['walk', null]);
  });
  it('quem carrega e apanha larga a pessoa; caída na água vai para a margem', () => {
    const { w, a, b, tap, run } = setup();
    tap('a', BUTTON.b); run(15);
    a.x = 6 * 16 + 8;                               // em cima do rio (só para o teste)
    damagePlayer(w, a, 10, { x: a.x - 10, y: a.y });
    run(1);
    expect(b.state).toBe('walk');
    expect(w.map.get(Math.floor(b.x / 16), Math.floor(b.y / 16))).not.toBe('w');
  });
  it('arremessado em cima de um monstro, machuca o monstro', () => {
    const { a, b, slime, tap, run } = setup();
    slime.x = 10 * 16 + 4; slime.y = 2 * 16 + 8;   // onde o arco já vem baixo
    tap('a', BUTTON.b); run(15); tap('a', BUTTON.b);
    run(60);
    expect(slime.hp).toBeLessThan(DEFAULT_RULES.enemies.slime.hp);
  });
  it('dá para desligar na config', () => {
    const { w, b, tap } = setup();
    w.rules = { ...w.rules, fun: { ...w.rules.fun, liftPlayers: false } };
    tap('a', BUTTON.b);
    expect(b.state).toBe('walk');
  });
});

import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, TICK_RATE, World, emptyInput, type MapData, type Rules } from '../src';

// Pasto 14×6: zona segura à esquerda (colunas 0–3), uma galinha no meio.
function pasture(): MapData {
  return {
    name: 'pasto', cols: 14, rows: 6, spawn: { x: 40, y: 40 },
    regions: [{ id: 'abrigo', name: 'Abrigo', x: 0, y: 0, w: 4, h: 6 }, { id: 'pasto', name: 'Pasto', x: 4, y: 0, w: 10, h: 6 }],
    tiles: ['TTTTTTTTTTTTTT', 'T............T', 'T............T', 'T............T', 'T............T', 'TTTTTTTTTTTTTT'],
    enemies: [{ type: 'chicken', x: 9, y: 2 }], signs: {}
  };
}
const rules: Rules = { ...DEFAULT_RULES, fun: { ...DEFAULT_RULES.fun, swarmTime: 3 }, pvp: { ...DEFAULT_RULES.pvp, safeZones: ['abrigo'] } };
function setup() {
  const w = new World(pasture(), rules), a = w.addPlayer('a', 'Ana', 8 * 16 + 2, 2 * 16 + 8), b = w.addPlayer('b', 'Beto', 11 * 16, 4 * 16);
  const hen = w.enemies[0]; a.dir = 3;
  const hit = () => {   // a galinha volta para a frente da Ana e leva um golpe
    hen.x = a.x + 14; hen.y = a.y; hen.mode = 'idle'; hen.timer = 999;
    w.setInput('a', { ...emptyInput(), a: true, tap: BUTTON.a }); w.step();
    for (let i = 0; i < 16; i++) { w.setInput('a', emptyInput()); w.step(); }
  };
  const run = (s: number) => { for (let i = 0; i < s * TICK_RATE; i++) { w.setInput('a', emptyInput()); w.setInput('b', emptyInput()); w.step(); } };
  return { w, a, b, hen, hit, run };
}

describe('galinhas vingativas', () => {
  it('apanhar não machuca a galinha; ela foge', () => {
    const { w, hen, hit } = setup();
    hit();
    expect(w.enemies).toContain(hen);
    expect(hen.mode).toBe('hop');
  });
  it('encostar numa galinha comum não machuca ninguém', () => {
    const { w, b, hen, run } = setup();
    hen.x = b.x; hen.y = b.y; run(0.5);
    expect(b.hp).toBe(b.maxHp);
    expect(w.enemies).toHaveLength(1);
  });
  it('cinco golpes do mesmo jogador chamam o bando, que persegue e bica só ele', () => {
    const { w, a, b, hit, run } = setup();
    for (let i = 0; i < DEFAULT_RULES.fun.chickenAnger; i++) hit();
    const swarm = w.enemies.filter(e => e.swarm);
    expect(swarm).toHaveLength(DEFAULT_RULES.fun.swarmSize);
    expect(swarm.every(e => e.swarm!.target === 'a')).toBe(true);
    b.x = a.x + 6; b.y = a.y;   // Beto do lado: não é com ele
    run(2);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBe(b.maxHp);
  });
  it('o bando vai embora depois do tempo', () => {
    const { w, hit, run } = setup();
    for (let i = 0; i < DEFAULT_RULES.fun.chickenAnger; i++) hit();
    run(5);
    expect(w.enemies.filter(e => e.swarm)).toHaveLength(0);
  });
  it('na zona segura o bando não entra', () => {
    const { w, a, hit, run } = setup();
    for (let i = 0; i < DEFAULT_RULES.fun.chickenAnger; i++) hit();
    a.x = 1 * 16 + 8; a.y = 2 * 16 + 8; const hp = a.hp;
    run(2);
    expect(a.hp).toBe(hp);
    expect(w.enemies.filter(e => e.swarm).every(e => e.x > 4 * 16 - 2)).toBe(true);
  });
});

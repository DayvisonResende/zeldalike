import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, World, damagePlayer, respawnPos, type MapData, type Rules } from '../src';
import vale from './fixtures';

const rules: Rules = { ...DEFAULT_RULES, player: { ...DEFAULT_RULES.player, maxHp: 50, maxMana: 20, hpRegen: 10, manaRegen: 5, regenDelay: 1, respawnDelay: 2, invulnerableAfterRespawn: 1 } };
const run = (w: World, seconds: number) => { for (let i = 0; i < seconds * TICK_RATE; i++) w.step(); };
// mapa do Vale sem monstros, para nada interferir
const calm = (): MapData => ({ ...(vale as MapData), enemies: [] });

describe('vida e mana', () => {
  it('nasce com vida e mana cheias da config', () => {
    const p = new World(calm(), rules).addPlayer('a', 'Ana');
    expect([p.hp, p.maxHp, p.mp, p.maxMp]).toEqual([50, 50, 20, 20]);
  });
  it('encostar num monstro tira o dano configurado dele', () => {
    const map = { ...(vale as MapData), enemies: [{ type: 'slime' as const, x: 9, y: 4 }] };
    const w = new World(map, rules);
    const p = w.addPlayer('a', 'Ana');
    const e = w.enemies[0]; e.x = p.x; e.y = p.y; e.mode = 'idle'; e.timer = 999;
    w.step();
    expect(p.hp).toBe(50 - rules.enemies.slime.damage);
    expect(p.state).toBe('hurt');
  });
  it('a vida só regenera depois de um tempo sem dano; a mana regenera sempre', () => {
    const w = new World(calm(), rules), p = w.addPlayer('a', 'Ana');
    damagePlayer(w, p, 20, { x: p.x + 10, y: p.y }); p.mp = 0; p.inv = 0;
    run(w, 0.5);
    expect(p.hp).toBe(30);                       // ainda dentro do regenDelay
    expect(p.mp).toBeCloseTo(2.5, 1);
    run(w, 1.5);
    expect(p.hp).toBeGreaterThan(30);
    run(w, 10);
    expect([p.hp, p.mp]).toEqual([50, 20]);      // nunca passa do máximo
  });
});

describe('morte e renascimento', () => {
  it('zerar a vida derruba, larga o que carrega e renasce depois do tempo, invulnerável', () => {
    const w = new World(calm(), rules), p = w.addPlayer('a', 'Ana');
    p.x += 40; p.carry = 'r';
    damagePlayer(w, p, 999, { x: p.x, y: p.y + 5 });
    expect(p.state).toBe('dead');
    expect(p.carry).toBeNull();
    run(w, 1);
    expect(p.state).toBe('dead');
    run(w, 1.1);
    expect(p.state).toBe('walk');
    expect([p.x, p.y]).toEqual([vale.spawn.x, vale.spawn.y]);
    expect([p.hp, p.mp]).toEqual([50, 20]);
    expect(p.inv).toBeGreaterThan(0);
    damagePlayer(w, p, 10, p);
    expect(p.hp).toBe(50);                        // invulnerável logo após renascer
  });
  it('morto não anda e os monstros não o perseguem', () => {
    const map = { ...(vale as MapData), enemies: [{ type: 'beetle' as const, x: 11, y: 4 }] };
    const w = new World(map, rules), p = w.addPlayer('a', 'Ana');
    damagePlayer(w, p, 999, p);
    const [x, y] = [p.x, p.y];
    w.setInput('a', { up: false, down: false, left: false, right: true, a: true, b: false, c: false, d: false, tap: 1, aim: null });
    w.step();
    expect([p.x, p.y, p.state]).toEqual([x, y, 'dead']);
    run(w, 1);
    expect(w.enemies[0].mode).not.toBe('chase');
  });
  it('ponto de renascimento em outra região cai em chão livre dentro dela', () => {
    const w = new World(calm(), rules);
    const at = respawnPos(w, 'ruinas-de-aurel');
    expect(w.map.regionAt(at.x, at.y)?.id).toBe('ruinas-de-aurel');
  });
});

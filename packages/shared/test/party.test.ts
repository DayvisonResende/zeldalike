import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, World, canHarm, shareXp, type MapData } from '../src';

function field(): MapData {
  const row = 'T' + '.'.repeat(38) + 'T';
  return { name: 'campo', cols: 40, rows: 6, spawn: { x: 24, y: 24 }, regions: [{ id: 'campo', name: 'Campo', x: 0, y: 0, w: 40, h: 6 }],
    tiles: ['T'.repeat(40), ...Array(4).fill(row), 'T'.repeat(40)], enemies: [], signs: {} };
}
function setup() {
  const w = new World(field(), { ...DEFAULT_RULES, pvp: { ...DEFAULT_RULES.pvp, mode: 'open' }, party: { maxSize: 4, xpRange: 100 } });
  const a = w.addPlayer('a', 'Ana', 40, 40), b = w.addPlayer('b', 'Beto', 60, 40), c = w.addPlayer('c', 'Caio', 400, 40), d = w.addPlayer('d', 'Duda', 50, 40);
  return { w, a, b, c, d };
}

describe('grupo', () => {
  it('sem grupo, o XP é todo de quem derrubou', () => {
    const { w, a, b } = setup();
    shareXp(w, a, 12);
    expect([a.xp, b.xp]).toEqual([12, 0]);
  });
  it('em grupo, divide igualmente com quem está perto (arredondando para cima); longe, de fora do grupo ou caído não ganha', () => {
    const { w, a, b, c, d } = setup();
    a.party = b.party = c.party = 'g1';
    shareXp(w, a, 5);   // Ana e Beto perto; Caio longe; Duda perto, mas de fora
    expect([a.xp, b.xp, c.xp, d.xp]).toEqual([3, 3, 0, 0]);
    b.state = 'dead';
    shareXp(w, a, 4);
    expect([a.xp, b.xp]).toEqual([7, 3]);
  });
  it('do mesmo grupo não se ferem, mesmo com PvP', () => {
    const { w, a, b, d } = setup();
    w.step();   // calcula quem está com PvP ativo
    a.party = b.party = 'g1';
    expect(canHarm(w, a, b)).toBe(false);
    expect(canHarm(w, a, d)).toBe(true);
  });
});

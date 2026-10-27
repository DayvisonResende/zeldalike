import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, World, packEnemy, packPlayer, unpackEnemy, unpackPlayer, type EnemyType, type MapData } from '../src';

// Tudo que viaja pela rede precisa voltar igual do outro lado.
const map: MapData = { name: 'm', cols: 4, rows: 4, spawn: { x: 24, y: 24 }, regions: [{ id: 'm', name: 'M', x: 0, y: 0, w: 4, h: 4 }],
  tiles: ['....', '....', '....', '....'], enemies: [], signs: {} };

describe('protocolo', () => {
  it('todo tipo de monstro chega com o mesmo tipo do outro lado', () => {
    for (const type of Object.keys(DEFAULT_RULES.enemies) as EnemyType[]) {
      const w = new World({ ...map, enemies: [{ type, x: 1, y: 1 }] });
      expect(unpackEnemy(packEnemy(w.enemies[0])).type).toBe(type);
    }
  });
  it('jogador carregando bomba ou outra pessoa chega igual', () => {
    const w = new World(map), p = w.addPlayer('a', 'Ana');
    for (const carry of ['b', 'r', 'bomb', 'player'] as const) { p.carry = carry; expect(unpackPlayer(packPlayer(p)).carry).toBe(carry); }
    p.state = 'held'; p.heldBy = 'b';
    expect(unpackPlayer(packPlayer(p))).toMatchObject({ state: 'held', heldBy: 'b' });
  });
});

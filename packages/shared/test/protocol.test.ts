import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, World, decodeInput, emptyInput, encodeInput, ownSimKey, ownState, packEnemy, packPlayer, unpackEnemy, unpackPlayer, type EnemyType, type MapData } from '../src';
import vale from './fixtures';

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

describe('previsão do cliente', () => {
  it('com os mesmos inputs, servidor e previsão chegam ao mesmo estado (o cliente então não precisa refazer a previsão)', () => {
    const srv = new World({ ...vale, enemies: [] } as MapData), pred = new World({ ...vale, enemies: [] } as MapData); pred.predicting = true;
    const a = srv.addPlayer('me', 'Eu'), b = pred.addPlayer('me', 'Eu');
    for (let i = 0; i < 600; i++) {
      const raw = { ...emptyInput(), right: i % 200 < 80, down: i % 150 < 40, up: i % 150 > 100, aim: Math.sin(i / 37) * 3, a: i % 45 === 0, tap: i % 45 === 0 ? BUTTON.a : 0, d: i % 97 === 0 };
      const inp = decodeInput(encodeInput(i, raw))!.input;   // a mira viaja arredondada: a previsão usa a mesma
      srv.stepPlayer('me', inp); srv.step({ players: false });
      pred.setInput('me', inp); pred.step({ life: false });
      expect(ownSimKey(ownState(b)), `passo ${i}`).toBe(ownSimKey(ownState(a)));
    }
  });
});

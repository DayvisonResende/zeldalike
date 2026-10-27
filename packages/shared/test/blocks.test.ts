import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, World, emptyInput, type InputState, type MapData } from '../src';

// Praça 12×8 de pedra. Bloco em (3,3); placas em (3,5) e (7,5); portão em (10,2) numa parede de pilares.
function plaza(): MapData {
  return { name: 'praça', cols: 12, rows: 8, spawn: { x: 40, y: 40 }, regions: [{ id: 'p', name: 'Praça', x: 0, y: 0, w: 12, h: 8 }],
    tiles: ['TTTTTTTTTTTT', 'TxxxxxxxxoxT', 'TxxxxxxxxGxT', 'TxxBxxxxxoxT', 'TxxxxxxxxxxT', 'TxxPxxxPxxxT', 'TxxxxxxxxxxT', 'TTTTTTTTTTTT'],
    enemies: [], signs: {} };
}
function setup() {
  const w = new World(plaza(), { ...DEFAULT_RULES, regrow: { ...DEFAULT_RULES.regrow, block: 2 } });
  const a = w.addPlayer('a', 'Ana', 3 * 16 + 8, 2 * 16 + 8);
  const run = (inp: Partial<InputState>, s: number) => { for (let i = 0; i < s * TICK_RATE; i++) { w.setInput('a', { ...emptyInput(), ...inp }); w.step(); } };
  // anda até a condição valer (no máximo 5 s)
  const until = (inp: Partial<InputState>, ok: () => boolean) => { for (let i = 0; i < 5 * TICK_RATE && !ok(); i++) { w.setInput('a', { ...emptyInput(), ...inp }); w.step(); } };
  return { w, a, run, until };
}
const at = (w: World, x: number, y: number) => w.map.tiles[y][x];

describe('blocos e placas', () => {
  it('andar contra o bloco por meio segundo o empurra um tile', () => {
    const { w, run } = setup();
    run({ down: true }, 0.3);
    expect(at(w, 3, 3)).toBe('B');            // encostar rápido não empurra
    run({ down: true }, 0.6);
    expect([at(w, 3, 3), at(w, 3, 4)]).toEqual(['x', 'B']);
  });
  it('bloco não entra em parede nem em cima de alguém', () => {
    const { w, a, run } = setup();
    w.addPlayer('b', 'Beto', 3 * 16 + 8, 4 * 16 + 8);
    run({ down: true }, 1);
    expect(at(w, 3, 3)).toBe('B');
    w.removePlayer('b'); a.x = 1 * 16 + 8; a.y = 3 * 16 + 8;
    w.setTile(2, 3, 'o');                      // pilar no caminho
    run({ right: true }, 1);
    expect(at(w, 3, 3)).toBe('B');
  });
  it('todas as placas apertadas abrem o portão (bloco numa, alguém de pé na outra); soltar fecha', () => {
    const { w, a, run, until } = setup();
    until({ down: true }, () => at(w, 3, 5) === 'Q');   // empurra duas vezes: o bloco cai na placa (3,5)
    expect(at(w, 3, 5)).toBe('Q');
    a.y -= 6;                                            // solta o direcional antes do terceiro empurrão
    expect(at(w, 9, 2)).toBe('G');              // falta a outra placa
    a.x = 7 * 16 + 8; a.y = 5 * 16 + 8;         // Ana de pé na placa (7,5)
    run({}, 0.2);
    expect(at(w, 9, 2)).toBe('x');
    a.x = 5 * 16 + 8;                           // saiu da placa
    run({}, 0.2);
    expect(at(w, 9, 2)).toBe('G');
  });
  it('bloco esquecido volta ao lugar quando ninguém está perto', () => {
    const { w, a, run, until } = setup();
    until({ down: true }, () => at(w, 3, 4) === 'B');
    expect(at(w, 3, 4)).toBe('B');
    a.x = 6 * 16 + 8; a.y = 6 * 16 + 8;        // ainda perto (menos de 5 tiles): não volta
    run({}, 3);
    expect(at(w, 3, 4)).toBe('B');
    w.removePlayer('a');
    run({}, 1.2);
    expect([at(w, 3, 3), at(w, 3, 4)]).toEqual(['B', 'x']);
  });
});

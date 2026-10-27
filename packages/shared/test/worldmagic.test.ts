import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, TICK_RATE, World, emptyInput, equipGear, type GameEvent, type InputState, type MapData } from '../src';

// Caverna 16×9. Linha 4: Ana em (2,4) olhando para a direita, arbusto em (5,4), mato em (6,4) e tocha apagada em (10,4).
// Outra tocha apagada em (10,2); portão em (13,3). Parede ilusória em (4,6), logo abaixo e ao lado da Ana.
function cave(): MapData {
  return { name: 'gruta', cols: 16, rows: 9, spawn: { x: 40, y: 72 }, dark: true, regions: [{ id: 'gruta', name: 'Gruta', x: 0, y: 0, w: 16, h: 9 }],
    tiles: ['WWWWWWWWWWWWWWWW', 'WqqqqqqqqqqqqWqW', 'WqqqqqqqqqjqqWqW', 'WqqqqqqqqqqqqGqW', 'WqqqqbgqqqjqqWqW', 'WqqqqqqqqqqqqWqW', 'WqqqIqqqqqqqqWqW', 'WqqqqqqqqqqqqWqW', 'WWWWWWWWWWWWWWWW'],
    enemies: [], signs: {} };
}
function setup() {
  const w = new World(cave(), { ...DEFAULT_RULES, regrow: { ...DEFAULT_RULES.regrow, torch: 2 } });
  const a = w.addPlayer('a', 'Ana', 2 * 16 + 8, 4 * 16 + 8); a.dir = 3; a.aim = 0; a.mp = a.maxMp = 500;
  a.bag[0] = { id: 'firestaff', n: 1 }; a.bag[1] = { id: 'lightstaff', n: 1 };
  equipGear(a, 'firestaff', 'a'); equipGear(a, 'lightstaff', 'c');
  const seen: GameEvent[] = [];
  const step = (inp: Partial<InputState> = {}, n = 1) => { for (let i = 0; i < n; i++) { w.setInput('a', { ...emptyInput(), ...inp }); seen.push(...w.step()); } };
  const cast = (k: 'a' | 'c') => { step({ [k]: true, tap: BUTTON[k] }); step({}, 70); };
  return { w, a, step, cast, seen };
}
const at = (w: World, x: number, y: number) => w.map.tiles[y][x];

describe('magia no mundo', () => {
  it('a bola de fogo queima arbusto e mato no caminho e acende a tocha apagada', () => {
    const { w, cast } = setup();
    cast('a');
    expect([at(w, 5, 4), at(w, 6, 4), at(w, 10, 4)]).toEqual(['q', 'q', 't']);
    expect(at(w, 13, 3)).toBe('G');   // ainda falta a outra tocha do grupo
  });
  it('acesas todas as tochas do grupo, o portão abre; com o tempo apagam e o portão fecha', () => {
    const { w, a, step, cast } = setup();
    cast('a');
    a.x = 2 * 16 + 8; a.y = 2 * 16 + 8; a.dir = 3; a.aim = 0;
    cast('a');
    expect(at(w, 10, 2)).toBe('t');
    expect(at(w, 13, 3)).toBe('q');
    step({}, 4 * TICK_RATE);
    expect([at(w, 10, 2), at(w, 10, 4), at(w, 13, 3)]).toEqual(['j', 'j', 'G']);
  });
  it('o Cajado de Luz revela a parede ilusória perto e deixa um clarão', () => {
    const { w, cast, seen } = setup();
    cast('c');
    expect(at(w, 4, 6)).toBe('q');
    expect(seen.some(e => e.t === 'glow')).toBe(true);
  });
  it('parede ilusória longe da luz continua parede', () => {
    const { w, a, cast } = setup();
    a.x = 12 * 16; a.y = 7 * 16 + 8;
    cast('c');
    expect(at(w, 4, 6)).toBe('I');
  });
});

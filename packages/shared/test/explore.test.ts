import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, World, base64ToBits, bitsToBase64, exploredOf, isExplored, type MapData } from '../src';

function field(): MapData {
  const row = 'T' + '.'.repeat(38) + 'T';
  return { name: 'campo', cols: 40, rows: 20, spawn: { x: 24, y: 24 }, regions: [{ id: 'campo', name: 'Campo', x: 0, y: 0, w: 40, h: 20 }],
    tiles: ['T'.repeat(40), ...Array(18).fill(row), 'T'.repeat(40)], enemies: [], signs: {} };
}

describe('mapa explorado', () => {
  it('andando revela um círculo em volta; o resto continua escondido', () => {
    const w = new World(field(), DEFAULT_RULES), p = w.addPlayer('a', 'Ana', 5 * 16 + 8, 5 * 16 + 8);
    for (let i = 0; i < TICK_RATE; i++) w.step();
    const bits = exploredOf(w, p);
    expect(isExplored(bits, 40, 5, 5)).toBe(true);
    expect(isExplored(bits, 40, 11, 5)).toBe(true);
    expect(isExplored(bits, 40, 30, 15)).toBe(false);
    p.x = 30 * 16 + 8; p.y = 15 * 16 + 8;
    for (let i = 0; i < 20; i++) w.step();
    expect(isExplored(bits, 40, 30, 15)).toBe(true);
    expect(isExplored(bits, 40, 5, 5)).toBe(true);   // o que já viu continua visto
  });
  it('vai e volta em base64 (para o banco e para a rede), sem perder nada', () => {
    for (const size of [1, 2, 3, 100, 101, 102]) {
      const bits = Uint8Array.from({ length: size }, (_, i) => (i * 37 + 11) & 255);
      expect(base64ToBits(bitsToBase64(bits), size)).toEqual(bits);
    }
    expect(base64ToBits('lixo!!', 4)).toHaveLength(4);
  });
});

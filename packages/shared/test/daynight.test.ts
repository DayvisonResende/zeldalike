import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, World, blockedAt, dayTime, fromTiled, isNight, sunlight, type MapData, type Rules } from '../src';
import fs from 'node:fs';

const read = (f: string) => JSON.parse(fs.readFileSync(new URL('./maps/' + f, import.meta.url), 'utf8'));
// dia de 24 s (1 s por hora), começando às 8h
const rules: Rules = { ...DEFAULT_RULES, daynight: { cycle: 24, start: 8 / 24 } };
const run = (w: World, s: number) => { for (let i = 0; i < s * TICK_RATE; i++) w.step(); };
// Lagoa 10×5: água no meio; um morcego só de noite e uma geleca de sempre
function pond(dark = false): MapData {
  return {
    name: 'lagoa', cols: 10, rows: 5, spawn: { x: 24, y: 24 }, ...(dark ? { dark: true } : {}),
    regions: [{ id: 'lagoa', name: 'Lagoa', x: 0, y: 0, w: 10, h: 5 }],
    tiles: ['TTTTTTTTTT', 'T...ww..tT', 'T...ww...T', 'T...ww...T', 'TTTTTTTTTT'],
    enemies: [{ type: 'bat', x: 2, y: 2, when: 'night' }, { type: 'slime', x: 7, y: 3 }], signs: {}
  };
}

describe('relógio do dia', () => {
  it('sol pleno de dia, nada à noite, rampa no entardecer', () => {
    expect([sunlight(12 / 24), sunlight(0), sunlight(18 / 24)]).toEqual([1, 0, 0.5]);
  });
  it('anda com o tempo do servidor', () => {
    const w = new World(pond(), rules);
    expect(dayTime(w)).toBeCloseTo(8 / 24);
    run(w, 4);
    expect(dayTime(w)).toBeCloseTo(12 / 24, 2);
  });
});

describe('monstros por período', () => {
  it('o morcego só de noite aparece ao anoitecer e some ao amanhecer', () => {
    const w = new World(pond(), rules);
    const bats = () => w.enemies.filter(e => e.type === 'bat').length;
    expect([bats(), w.enemies.length]).toEqual([0, 1]);   // 8h: só a geleca
    run(w, 12);                                             // 20h
    expect(isNight(w)).toBe(true);
    expect(bats()).toBe(1);
    run(w, 12);                                             // 8h de novo
    expect(bats()).toBe(0);
  });
  it('mapa escuro (caverna) é sempre noite', () => {
    const w = new World(pond(true), rules);
    expect(isNight(w)).toBe(true);
    expect(w.enemies.some(e => e.type === 'bat')).toBe(true);
  });
  it('o morcego voa por cima da água', () => {
    const w = new World(pond(true), rules);
    const bat = w.enemies.find(e => e.type === 'bat')!;
    bat.x = 3 * 16 + 8; bat.y = 2 * 16 + 8; bat.vx = 0.6; bat.vy = 0; bat.timer = 1e9;
    run(w, 1);
    expect(bat.x).toBeGreaterThan(5 * 16);                  // atravessou as colunas de água
  });
  it('tocha ocupa o tile', () => {
    const w = new World(pond(), rules);
    expect(blockedAt(w.map, 8 * 16 + 8, 1 * 16 + 8, 5, 4)).toBe(true);
  });
});

describe('Tiled', () => {
  it('lê "quando: noite" dos monstros e "escuro" do mapa', () => {
    expect(fromTiled(read('vale.tmj'), read('vale.tsj')).map.enemies.filter(e => e.when === 'night').length).toBe(4);
    expect(fromTiled(read('caverna.tmj'), read('vale.tsj')).map.dark).toBe(true);
  });
});

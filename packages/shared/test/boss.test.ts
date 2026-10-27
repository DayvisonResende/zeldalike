import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, World, emptyInput, type GameEvent, type MapData } from '../src';
import { damage } from '../src/systems/combat';

// Toca 30×14 com o Rei no meio, em (10,6).
function lair(): MapData {
  const row = 'W' + 'q'.repeat(28) + 'W';
  return {
    name: 'Toca', cols: 30, rows: 14, spawn: { x: 40, y: 40 }, dark: true,
    regions: [{ id: 'toca', name: 'Toca', x: 0, y: 0, w: 30, h: 14 }],
    tiles: ['W'.repeat(30), ...Array(12).fill(row), 'W'.repeat(30)], enemies: [{ type: 'king', x: 10, y: 6 }], signs: {}
  };
}
function setup(players: [string, string, number, number][] = [['a', 'Ana', 27 * 16, 12 * 16]]) {
  const w = new World(lair(), DEFAULT_RULES), king = w.enemies[0];
  for (const [id, name, x, y] of players) w.addPlayer(id, name, x, y);
  const seen: GameEvent[] = [];
  const run = (s: number) => { for (let i = 0; i < s * TICK_RATE; i++) { for (const id of w.players.keys()) w.setInput(id, emptyInput()); seen.push(...w.step()); } };
  const said = () => seen.filter(e => e.t === 'announce').map(e => (e as { text: string }).text);
  return { w, king, run, said, seen };
}
const minions = (w: World) => w.enemies.filter(e => e.minion && !e.dying);

describe('Rei Geleca', () => {
  it('fica na toca quando ninguém chega perto', () => {
    const { king, run } = setup();
    const x0 = king.x, y0 = king.y;
    run(6);
    expect(Math.hypot(king.x - x0, king.y - y0)).toBeLessThan(4);
  });
  it('pula atrás de quem entra na toca e a onda de choque machuca quem está no chão', () => {
    const { w, king, run } = setup([['a', 'Ana', 14 * 16, 6 * 16 + 8], ['b', 'Beto', 27 * 16, 12 * 16]]);
    const a = w.players.get('a')!, b = w.players.get('b')!;
    run(3);
    expect(king.x).toBeGreaterThan(10 * 16 + 8 + 16);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBe(b.maxHp);
  });
  it('pula por cima de pedras e as esmaga ao cair; paredes continuam paredes', () => {
    const map = lair(); map.tiles = map.tiles.map((r, y) => y >= 4 && y <= 8 ? r.slice(0, 12) + 'rr' + r.slice(14) : r);
    const w = new World(map, DEFAULT_RULES), king = w.enemies[0], a = w.addPlayer('a', 'Ana', 16 * 16, 6 * 16 + 8);
    a.inv = 1e9;
    for (let i = 0; i < 6 * TICK_RATE; i++) { w.setInput('a', emptyInput()); w.step(); }
    expect(king.x).toBeGreaterThan(14 * 16);
    expect(w.map.tiles.slice(4, 9).flat().filter(c => c === 'r').length).toBeLessThan(10);   // alguma ficou esmagada
  });
  it('chama gelecas a cada três pulos, no máximo quatro de uma vez', () => {
    const { w, king, run } = setup([['a', 'Ana', 13 * 16, 6 * 16 + 8]]);
    w.players.get('a')!.inv = 1e9;   // imortal para o teste durar
    run(1);
    while ((king.lands ?? 0) < 3) run(0.1);
    expect(minions(w).length).toBe(2);
    run(20);
    expect(minions(w).length).toBeLessThanOrEqual(4);
  });
  it('com metade da vida fica furioso: chama ajuda na hora e descansa menos entre pulos', () => {
    const { w, king, run } = setup([['a', 'Ana', 13 * 16, 6 * 16 + 8]]);
    const a = w.players.get('a')!; a.inv = 1e9;
    damage(w, king, king.maxHp / 2, a.x, a.y, a);
    run(0.2);
    expect(king.enraged).toBe(true);
    expect(minions(w).length).toBe(3);
    const n = king.lands ?? 0;
    while ((king.lands ?? 0) === n) { w.setInput('a', emptyInput()); w.step(); }   // logo depois de cair: o descanso já é o curto
    expect(king.timer).toBeLessThanOrEqual(32);
  });
  it('todos que bateram ganham XP e o próprio loot; os filhotes se desfazem', () => {
    const { w, king, run, said } = setup([['a', 'Ana', 13 * 16, 6 * 16 + 8], ['b', 'Beto', 7 * 16, 6 * 16 + 8], ['c', 'Caio', 27 * 16, 12 * 16]]);
    const [a, b, c] = ['a', 'b', 'c'].map(id => w.players.get(id)!);
    for (const p of [a, b, c]) p.inv = 1e9;
    run(4);
    damage(w, king, 1, b.x, b.y, b);
    king.hurtT = 0; damage(w, king, king.hp, a.x, a.y, a);
    run(0.5);
    expect(w.enemies).not.toContain(king);
    expect(a.xp + (a.level - 1)).toBeGreaterThan(0); expect(b.level).toBeGreaterThan(1);
    expect(c.level).toBe(1); expect(c.xp).toBe(0);
    expect(w.drops.some(d => d.owner === 'a')).toBe(true); expect(w.drops.some(d => d.owner === 'b')).toBe(true);
    expect(w.drops.some(d => d.owner === 'c')).toBe(false);
    expect(minions(w)).toHaveLength(0);
    expect(said().at(-1)).toMatch(/Rei Geleca caiu.*(Ana e Beto|Beto e Ana)/);
  });
  it('sem ninguém por perto ele se cura e esquece quem bateu', () => {
    const { w, king, run } = setup([['a', 'Ana', 13 * 16, 6 * 16 + 8]]);
    const a = w.players.get('a')!; a.inv = 1e9;
    damage(w, king, 5, a.x, a.y, a);
    a.x = 27 * 16; a.y = 12 * 16;
    run(12);
    expect(king.hp).toBe(king.maxHp); expect(king.hitters).toBeUndefined();
  });
  it('renasce depois do tempo e avisa o servidor', () => {
    const { w, king, run, said } = setup([['a', 'Ana', 27 * 16, 12 * 16]]);
    w.rules = { ...DEFAULT_RULES, enemies: { ...DEFAULT_RULES.enemies, king: { ...DEFAULT_RULES.enemies.king, respawn: 2 } } };
    king.hp = 0; king.dying = true; king.hurtT = 1;
    run(3);
    expect(w.enemies.some(e => e.type === 'king')).toBe(true);
    expect(said().some(t => /despertou: Toca treme/.test(t))).toBe(true);
  });
});

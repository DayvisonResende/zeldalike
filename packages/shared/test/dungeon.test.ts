import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, TICK_RATE, World, emptyInput, type MapData } from '../src';

/* Mapinha de masmorra:
   WWWWWWWWWWWW
   Wq.qqqqqqqqW     sala de x=4..9, y=1..5 (dentro das paredes); grade O na entrada (x=3, y=3)
   WqqqWqqqqqqW
   WqqqOqqqqqqW     geleca minichefe em (7,3); chave no chão em (1,1); porta L em (10,6)
   WqqqWqqqqqqW     fragmento em (1,5)
   WqqqWqqqqqqW
   WqqqWWWWWWLW
   WWWWWWWWWWWW */
function dungeon(): MapData {
  const tiles = [
    'WWWWWWWWWWWW',
    'WqqqWqqqqqqW',
    'WqqqWqqqqqqW',
    'WqqqOqqqqqqW',
    'WqqqWqqqqqqW',
    'WqqqWqqqqqqW',
    'WqqqWWWWWWLW',
    'WWWWWWWWWWWW'
  ];
  return { name: 'masmorra', cols: 12, rows: 8, spawn: { x: 40, y: 56 }, regions: [{ id: 'm', name: 'Masmorra', x: 0, y: 0, w: 12, h: 8 }], tiles, signs: {},
    enemies: [{ type: 'slime', x: 7, y: 3, mini: true }], keys: [{ x: 24, y: 24 }], rooms: [{ x: 5, y: 1, w: 6, h: 5, reward: 'chave' }], fragments: [{ x: 1, y: 5 }] };
}
function setup() {
  const w = new World(dungeon(), DEFAULT_RULES); w.instance = true;
  const p = w.addPlayer('a', 'Ana', 40, 56), b = w.addPlayer('b', 'Beto', 40, 40);
  return { w, p, b };
}
const run = (w: World, s: number) => { for (let i = 0; i < s * TICK_RATE; i++) w.step(); };
const press = (w: World, id: string) => { w.setInput(id, { ...emptyInput(), b: true, tap: BUTTON.b }); w.step(); w.setInput(id, emptyInput()); w.step(); };

describe('masmorra', () => {
  it('minichefe: 6× a vida', () => {
    const { w } = setup();
    expect(w.enemies[0]).toMatchObject({ mini: true, maxHp: DEFAULT_RULES.enemies.slime.hp * 6 });
  });
  it('a chave é do grupo: qualquer um que pegue, qualquer um abre a porta (e gasta)', () => {
    const { w, p, b } = setup();
    p.x = 24; p.y = 26; press(w, 'a');
    expect(w.keys).toBe(1);
    b.x = 10 * 16 + 8; b.y = 5 * 16 + 10; b.dir = 0;   // Beto de frente para a porta
    press(w, 'b');
    expect(w.map.get(10, 6)).toBe('q');
    expect(w.keys).toBe(0);
  });
  it('sem chave, a porta não abre', () => {
    const { w, b } = setup();
    b.x = 10 * 16 + 8; b.y = 5 * 16 + 10; b.dir = 0;
    press(w, 'b');
    expect(w.map.get(10, 6)).toBe('L');
  });
  it('sala tranca com alguém dentro e monstro vivo; derrubado o monstro, abre e cai a recompensa', () => {
    const { w, p } = setup();
    p.x = 6 * 16 + 8; p.y = 2 * 16 + 8;   // dentro da sala, longe da grade
    run(w, 0.2);
    expect(w.rooms[0]).toBe('locked');
    expect(w.map.get(4, 3)).toBe('D');
    const e = w.enemies[0]; e.hp = 0; e.dying = true; e.hurtT = 1; e.timer = 999;
    run(w, 1);
    expect(w.rooms[0]).toBe('cleared');
    expect(w.map.get(4, 3)).toBe('O');
    expect(w.drops.some(d => d.item === 'key')).toBe(true);
    run(w, 5);
    expect(w.enemies.length).toBe(0);   // masmorra: não volta
  });
  it('não tranca com alguém em cima da grade', () => {
    const { w, p } = setup();
    p.x = 4 * 16 + 8; p.y = 3 * 16 + 8;
    run(w, 0.2);
    expect(w.rooms[0] ?? 'idle').toBe('idle');
  });
  it('fragmento de vida: uma vez por personagem, + vida máxima', () => {
    const { w, p } = setup();
    const max = p.maxHp;
    p.x = 1 * 16 + 8; p.y = 5 * 16 + 10;
    run(w, 0.2);
    expect(p.fragments).toEqual(['local:1,5']);
    expect(p.maxHp).toBe(max + DEFAULT_RULES.player.fragment);
    run(w, 0.5);
    expect(p.fragments.length).toBe(1);
  });
});

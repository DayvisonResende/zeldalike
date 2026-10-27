import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, TICK_RATE, World, bfs, distAt, emptyInput, type MapData } from '../src';
import vale from './fixtures';

// Mapa pequeno: corredor fechado, arbusto em (3,1), pedra em (5,1)
function tiny(enemies: MapData['enemies'] = []): MapData {
  return { name: 'teste', cols: 8, rows: 3, spawn: { x: 24, y: 24 }, regions: [{ id: 'a', name: 'Área', x: 0, y: 0, w: 8, h: 3 }],
    tiles: ['TTTTTTTT', 'T..b.r.T', 'TTTTTTTT'], enemies, signs: {} };
}
const rules = { ...DEFAULT_RULES, regrow: { ...DEFAULT_RULES.regrow, bush: 2, tallGrass: 1, rock: 3, secret: 3 } };
function hold(w: World, id: string, patch: Partial<ReturnType<typeof emptyInput>>, n: number) {
  for (let i = 0; i < n; i++) { w.setInput(id, { ...emptyInput(), ...patch }); w.step(); patch = { ...patch, tap: 0 }; }
}

describe('mapa do Vale', () => {
  it('carrega as 6 regiões num mapa contínuo', () => {
    const w = new World(vale as MapData);
    expect(w.map.cols).toBe(48);
    expect(w.map.rows).toBe(28);
    expect(w.map.data.regions.map(r => r.name)).toContain('Ruínas de Aurel');
    expect(w.enemies.length).toBe(20);   // de dia: sem os 4 morcegos noturnos
  });
  it('avisa a região ao entrar nela', () => {
    const w = new World(vale as MapData);
    w.addPlayer('p1', 'Íris');
    expect(w.step()).toContainEqual({ t: 'region', to: 'p1', name: 'Clareira' });
    expect(w.step().some(e => e.t === 'region')).toBe(false);
  });
});

describe('regeneração', () => {
  it('arbusto cortado volta depois do tempo configurado', () => {
    const w = new World(tiny(), rules);
    w.addPlayer('p1', 'Íris', 38, 24).dir = 3;
    hold(w, 'p1', { a: true, tap: BUTTON.a }, 1);
    hold(w, 'p1', {}, 20);
    expect(w.map.get(3, 1)).toBe('.');
    w.players.get('p1')!.x = 100;   // sai de perto para não bloquear o crescimento
    hold(w, 'p1', {}, 2 * TICK_RATE + 30);
    expect(w.map.get(3, 1)).toBe('b');
  });
  it('não renasce em cima de quem está no tile', () => {
    const w = new World(tiny(), rules);
    w.addPlayer('p1', 'Íris', 38, 24).dir = 3;
    hold(w, 'p1', { a: true, tap: BUTTON.a }, 1);
    hold(w, 'p1', {}, 20);
    const p = w.players.get('p1')!; p.x = 3 * 16 + 8; p.y = 24;
    hold(w, 'p1', {}, 3 * TICK_RATE);
    expect(w.map.get(3, 1)).toBe('.');
  });
});

describe('inimigos', () => {
  it('mapa de fluxo aponta para a jogadora mais próxima', () => {
    const w = new World(tiny());
    const m = bfs(w.map, [[1, 1], [6, 1]]);
    expect(distAt(m, 2, 1)).toBe(1);
    expect(distAt(m, 5, 1)).toBe(Infinity);   // pedra é sólida
  });
  it('renasce no ponto de origem depois de morto', () => {
    const w = new World(tiny([{ type: 'slime', x: 6, y: 1 }]), { ...rules, enemies: { ...rules.enemies, slime: { ...rules.enemies.slime, hp: 1, respawn: 1 } } });
    const e = w.enemies[0]; e.hp = 0; e.dying = true; e.hurtT = 1;
    w.step();
    expect(w.enemies.length).toBe(0);
    for (let i = 0; i < TICK_RATE + 30; i++) w.step();
    expect(w.enemies.length).toBe(1);
  });
});

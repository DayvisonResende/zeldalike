import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, TICK_RATE, World, damagePlayer, emptyInput, type GameEvent, type MapData } from '../src';

// Corredor 12×3: portal para outro mapa na ponta direita, portal no mesmo mapa na ponta esquerda.
function corridor(): MapData {
  return {
    name: 'corredor', cols: 12, rows: 3, spawn: { x: 88, y: 24 },
    points: { partida: { x: 88, y: 24 }, fundo: { x: 40, y: 24 } },
    portals: [{ x: 160, y: 16, w: 16, h: 16, to: 'caverna', arrive: 'entrada' }, { x: 16, y: 16, w: 16, h: 16, to: null, arrive: 'fundo' }],
    regions: [{ id: 'corredor', name: 'Corredor', x: 0, y: 0, w: 12, h: 3 }],
    tiles: ['TTTTTTTTTTTT', 'T.........hT', 'TTTTTTTTTTTT'], enemies: [], signs: {}
  };
}
const walk = (w: World, dx: number, steps: number) => {
  const evs: GameEvent[] = [];
  for (let i = 0; i < steps; i++) { w.setInput('a', { ...emptyInput(), right: dx > 0, left: dx < 0 }); evs.push(...w.step()); }
  return evs;
};

describe('portais', () => {
  it('para outro mapa: avisa o servidor uma vez, ao entrar', () => {
    const w = new World(corridor()); w.addPlayer('a', 'Ana');
    const evs = walk(w, 1, 80);
    expect(evs.filter(e => e.t === 'portal')).toEqual([{ t: 'portal', id: 'a', to: 'caverna', arrive: 'entrada' }]);
  });
  it('no mesmo mapa: teleporta para o ponto de chegada', () => {
    const w = new World(corridor()), p = w.addPlayer('a', 'Ana');
    let at: number[] = [];
    for (let i = 0; i < 60 && !at.length; i++) if (walk(w, -1, 1).some(e => e.t === 'poof')) at = [p.x, p.y];
    expect(at).toEqual([40, 24]);
  });
  it('depois de chegar, os portais ficam quietos por um instante (segurar a tecla não faz voltar)', () => {
    const w = new World(corridor()), p = w.addPlayer('a', 'Ana', 160 + 8 + 20, 24);
    p.portalWait = 60; p.inPortal = false;
    expect(walk(w, -1, 30).some(e => e.t === 'portal')).toBe(false);   // passa por cima do portal ainda quieto
  });
  it('chegar em cima de um portal não dispara (só ao entrar de novo)', () => {
    const w = new World(corridor()), p = w.addPlayer('a', 'Ana', 168, 24);
    expect(walk(w, 0, 5).some(e => e.t === 'portal')).toBe(false);
    walk(w, -1, 20); p.inPortal = false;
    expect(walk(w, 1, 30).some(e => e.t === 'portal')).toBe(true);
  });
  it('caído fora do mapa principal pede para voltar para casa', () => {
    const rules = { ...DEFAULT_RULES, player: { ...DEFAULT_RULES.player, respawnDelay: 0.5 } };
    const w = new World(corridor(), rules), p = w.addPlayer('a', 'Ana');
    w.home = false;
    damagePlayer(w, p, 999, p);
    const evs: GameEvent[] = [];
    for (let i = 0; i < TICK_RATE; i++) evs.push(...w.step());
    expect(evs.filter(e => e.t === 'gohome')).toEqual([{ t: 'gohome', id: 'a' }]);
    expect(p.state).toBe('dead');                 // continua caído até o servidor levar
  });
  it('ataque não dispara portal (só andar)', () => {
    const w = new World(corridor()), p = w.addPlayer('a', 'Ana', 140, 24);
    p.dir = 3; w.setInput('a', { ...emptyInput(), a: true, tap: BUTTON.a });
    expect(w.step().some(e => e.t === 'portal')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, World, emptyInput, type MapData } from '../src';

/* Margem, rio de 4 tiles, pilar do outro lado:
   TTTTTTTTTTTTTT
   T....wwww.o..T     Ana em (2,1) mirando para a direita; pilar em (10,1)
   T....wwww....T     parede em (4,3) para o teste de bater e voltar
   T...Twwww....T
   TTTTTTTTTTTTTT */
function river(): MapData {
  const tiles = ['TTTTTTTTTTTTTT', 'T....wwww.o..T', 'T....wwww....T', 'T...Twwww....T', 'TTTTTTTTTTTTTT'];
  return { name: 'rio', cols: 14, rows: 5, spawn: { x: 40, y: 24 }, regions: [{ id: 'r', name: 'Rio', x: 0, y: 0, w: 14, h: 5 }], tiles, enemies: [], signs: {} };
}
function setup(aim: number, y = 1) {
  const w = new World(river(), DEFAULT_RULES);
  const p = w.addPlayer('a', 'Ana', 2 * 16 + 8, y * 16 + 10); p.aim = aim; p.dir = 3;
  p.bag[0] = { id: 'gancho', n: 1 }; p.gear = { a: 'gancho', c: 'bow' };
  w.step();
  return { w, p };
}
function fire(w: World, steps: number, aim: number) {
  w.setInput('a', { ...emptyInput(), a: true, tap: BUTTON.a, aim }); w.step(); w.setInput('a', { ...emptyInput(), aim });
  for (let i = 0; i < steps; i++) w.step();
}

describe('gancho', () => {
  it('prende no pilar e puxa por cima do rio, até chão livre do outro lado', () => {
    const { w, p } = setup(0);
    fire(w, 120, 0);
    expect(p.state).toBe('walk');
    expect(p.hook).toBeNull();
    expect(Math.floor(p.x / 16)).toBe(9);   // logo antes do pilar
    expect(w.map.solid(Math.floor(p.x / 16), Math.floor(p.y / 16))).toBe(false);
  });
  it('bate na parede e volta; não sai do lugar', () => {
    const { w, p } = setup(Math.PI / 2, 1);
    const x = p.x;
    p.x = 4 * 16 + 8; p.y = 1 * 16 + 10;   // em cima da parede (4,3), dois tiles acima
    fire(w, 60, Math.PI / 2);
    expect(p.hook).toBeNull();
    expect(p.x).toBe(4 * 16 + 8);
    expect(x).not.toBe(p.x);
  });
  it('sem nada no caminho, vai até o alcance e volta', () => {
    const { w, p } = setup(Math.PI);   // para a esquerda: parede logo ali (bate e volta)
    fire(w, 60, Math.PI);
    expect([p.state, p.hook]).toEqual(['walk', null]);
  });
});

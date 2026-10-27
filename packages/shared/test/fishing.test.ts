import { describe, expect, it } from 'vitest';
import { BUTTON, TIERS, World, emptyInput, reelCursor, type GameEvent, type MapData, type Player } from '../src';

// Margem 10×5: a jogadora na grama olhando para a água à direita.
function shore(dark = false): MapData {
  return {
    name: 'margem', cols: 10, rows: 5, spawn: { x: 40, y: 40 }, ...(dark ? { dark: true } : {}),
    regions: [{ id: 'margem', name: 'Margem', x: 0, y: 0, w: 10, h: 5 }],
    tiles: ['TTTTTTTTTT', 'T....wwwwT', 'T....wwwwT', 'T....wwwwT', 'TTTTTTTTTT'], enemies: [], signs: {}
  };
}
function setup(dark = false) {
  const w = new World(shore(dark)), p = w.addPlayer('a', 'Ana', 4 * 16 + 4, 2 * 16 + 8); p.dir = 3;
  const evs: GameEvent[] = [];
  const step = (patch: Partial<ReturnType<typeof emptyInput>> = {}) => { w.setInput('a', { ...emptyInput(), ...patch }); evs.push(...w.step()); };
  const press = () => step({ b: true, tap: BUTTON.b });
  return { w, p, step, press, evs };
}
// Espera o "!" e fisga
function hook(s: ReturnType<typeof setup>) {
  s.press();
  for (let i = 0; i < 400 && s.p.fish?.phase !== 'bite'; i++) s.step();
  s.press();
}
// Espera o cursor entrar (ou sair) da zona
function waitCursor(s: ReturnType<typeof setup>, inside: boolean) {
  for (let i = 0; i < 300; i++) {
    const f = s.p.fish!;
    const next = { ...f, t: f.t + 1 };   // a decisão acontece no próximo passo, com t + 1
    if ((Math.abs(reelCursor(next) - f.zone) <= TIERS[f.tier].zone / 2) === inside) return;
    s.step();
  }
}

describe('pesca', () => {
  it('E de frente para a água lança a linha; o peixe morde depois de um tempo', () => {
    const s = setup();
    s.press();
    expect(s.p.state).toBe('fish');
    expect(s.p.fish!.phase).toBe('wait');
    for (let i = 0; i < 400 && s.p.fish?.phase === 'wait'; i++) s.step();
    expect(s.p.fish!.phase).toBe('bite');
    expect(s.evs.some(e => e.t === 'sfx' && e.name === 'bite')).toBe(true);
  });
  it('apertar com o cursor na zona pesca: o peixe vai para o inventário com tamanho', () => {
    const s = setup();
    hook(s);
    expect(s.p.fish!.phase).toBe('reel');
    waitCursor(s, true);
    s.press();
    expect(s.p.state).toBe('walk');
    const fish = s.evs.find(e => e.t === 'fish');
    expect(fish).toBeTruthy();
    expect(s.p.bag.some(x => x?.id === (fish as { item: string }).item)).toBe(true);
  });
  it('apertar fora da zona: escapou', () => {
    const s = setup();
    hook(s);
    waitCursor(s, false);
    s.press();
    expect(s.evs).toContainEqual({ t: 'notice', to: 'a', text: 'Escapou!' });
    expect(s.p.bag.every(x => !x)).toBe(true);
  });
  it('não fisgar a tempo: o peixe solta a isca; andar recolhe a linha', () => {
    const s = setup();
    s.press();
    for (let i = 0; i < 400 && s.p.fish?.phase !== 'bite'; i++) s.step();
    for (let i = 0; i < 50; i++) s.step();
    expect(s.evs).toContainEqual({ t: 'notice', to: 'a', text: 'O peixe soltou a isca.' });
    s.press(); s.step({ left: true });
    expect(s.p.state).toBe('walk');
  });
  it('cliente e servidor veem a mesma barra (os sorteios dependem só dos passos da jogadora)', () => {
    const a = setup(), b = setup();
    b.w.tick = 5000;                                   // relógio do mundo diferente não importa
    for (const s of [a, b]) hook(s);
    expect(a.p.fish).toEqual(b.p.fish);
  });
  it('na caverna só vem peixe da caverna (ou bota)', () => {
    const items = new Set<string>();
    for (let k = 0; k < 40; k++) {
      const s = setup(true); s.p.steps = k * 7;
      hook(s); s.p.fish!.tier = 1; waitCursor(s, true); s.press();
      const f = s.evs.find(e => e.t === 'fish') as { item: string } | undefined;
      if (f) items.add(f.item);
    }
    expect([...items]).toEqual(['blindfish']);
  });
});

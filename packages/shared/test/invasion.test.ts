import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE, World, canHarm, emptyInput, remaining, type GameEvent, type MapData, type Rules } from '../src';

// Campo 40×8: a praça (zona segura) à esquerda, colunas 1–4; o resto é campo aberto.
function field(): MapData {
  const row = 'T' + '.'.repeat(38) + 'T';
  return {
    name: 'campo', cols: 40, rows: 8, spawn: { x: 40, y: 64 },
    regions: [{ id: 'praca', name: 'Praça', x: 0, y: 0, w: 5, h: 8 }, { id: 'campo', name: 'Campo', x: 5, y: 0, w: 35, h: 8 }],
    tiles: ['T'.repeat(40), ...Array(6).fill(row), 'T'.repeat(40)], enemies: [], signs: {}
  };
}
const invasion = { every: 10, warning: 2, duration: 30, count: 4, zone: 'praca', reward: { xp: 40, gold: 20 } };
function setup(over: Partial<typeof invasion> = {}) {
  const rules: Rules = { ...DEFAULT_RULES, pvp: { ...DEFAULT_RULES.pvp, mode: 'open', safeZones: ['praca'] }, events: { invasion: { ...invasion, ...over } } };
  const w = new World(field(), rules), a = w.addPlayer('a', 'Ana', 40, 64), b = w.addPlayer('b', 'Beto', 48, 64);
  const seen: GameEvent[] = [];
  const run = (s: number) => { for (let i = 0; i < s * TICK_RATE; i++) { w.setInput('a', emptyInput()); w.setInput('b', emptyInput()); seen.push(...w.step()); } };
  const said = () => seen.filter(e => e.t === 'announce').map(e => (e as { text: string }).text);
  return { w, a, b, run, said };
}
const invaders = (w: World) => w.enemies.filter(e => e.invader);

describe('invasão de gelecas', () => {
  it('desligada (every 0) nunca acontece', () => {
    const { w, run, said } = setup({ every: 0 });
    run(15);
    expect(w.invasion).toBeNull(); expect(said()).toEqual([]);
  });
  it('não começa com o mapa vazio', () => {
    const { w, run } = setup();
    w.removePlayer('a'); w.removePlayer('b'); run(12);
    expect(w.invasion).toBeNull();
  });
  it('avisa, espera o aviso e solta a horda fora da zona', () => {
    const { w, run, said } = setup();
    run(10.1);
    expect(w.invasion?.phase).toBe('warn');
    expect(said()[0]).toMatch(/Gelecas avistadas.*Praça/);
    expect(invaders(w)).toHaveLength(0);
    run(2.5);
    expect(w.invasion?.phase).toBe('fight');
    expect(invaders(w).length).toBeGreaterThan(0);
    expect(invaders(w).every(e => e.x >= 5 * 16)).toBe(true);
    expect(remaining(w)).toBe(4);
  });
  it('na invasão a zona deixa de proteger contra monstros, mas o PvP continua proibido lá', () => {
    const { w, a, b, run } = setup();
    run(12.5);
    const e = invaders(w)[0];
    e.x = a.x; e.y = a.y; e.z = 0; e.mode = 'idle'; e.timer = 999;
    run(0.1);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(canHarm(w, b, a)).toBe(false);
  });
  it('as gelecas marcham até a zona', () => {
    const { w, a, b, run } = setup({ count: 1 });
    a.x = b.x = 24; run(12.5);   // as duas na praça, longe das gelecas
    const e = invaders(w)[0], x0 = e.x;
    run(8);
    expect(e.x).toBeLessThan(x0 - 48);
  });
  it('limpar a horda vence: recompensa para quem lutou e anúncio do melhor defensor', () => {
    const { w, a, b, run, said } = setup({ count: 3 });
    run(12.2);
    for (let k = 0; k < 3; k++) {
      while (!invaders(w).some(e => !e.dying)) run(0.1);
      for (const e of invaders(w)) if (!e.dying) { e.lastHitBy = k < 2 ? 'a' : 'b'; e.hp = 0; e.dying = true; e.hurtT = 1; break; }
      run(0.05);
    }
    run(0.1);
    expect(w.invasion).toBeNull();
    expect(said().at(-1)).toMatch(/resistiu.*Melhor defensor: Ana \(2 gelecas\)/);
    expect(a.gold).toBeGreaterThanOrEqual(20); expect(b.gold).toBeGreaterThanOrEqual(20);
    expect(w.nextInvasion).toBeGreaterThan(w.tick);
  });
  it('se o tempo acaba, as gelecas recuam e a próxima fica agendada', () => {
    const { w, a, run, said } = setup({ duration: 3 });
    run(15.5);
    expect(w.invasion).toBeNull();
    expect(invaders(w)).toHaveLength(0);
    expect(said().at(-1)).toMatch(/recuaram/);
    expect(a.gold).toBe(0);
  });
});

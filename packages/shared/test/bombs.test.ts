import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, FUSE, TICK_RATE, World, emptyInput, useItem, type MapData, type Rules } from '../src';

// Corredor com paredão rachado (X) no meio, arbusto e água; uma geleca parada do outro lado.
function corridor(): MapData {
  return {
    name: 'corredor', cols: 12, rows: 5, spawn: { x: 24, y: 40 },
    regions: [{ id: 'c', name: 'Corredor', x: 0, y: 0, w: 12, h: 5 }],
    tiles: ['TTTTTTTTTTTT', 'T.....cccccT', 'T....bX....T', 'T.....cc.wwT', 'TTTTTTTTTTTT'],
    enemies: [{ type: 'slime', x: 8, y: 2 }], signs: {}
  };
}
const rules: Rules = { ...DEFAULT_RULES, regrow: { ...DEFAULT_RULES.regrow, secret: 2 } };
const run = (w: World, ticks: number) => { for (let i = 0; i < ticks; i++) w.step(); };
function setup() {
  const w = new World(corridor(), rules), p = w.addPlayer('a', 'Ana', 5 * 16 + 4, 2 * 16 + 8);
  p.dir = 3; p.bag[0] = { id: 'bomb', n: 3 };
  const slime = w.enemies[0]; slime.mode = 'idle'; slime.timer = 1e9;
  return { w, p, slime };
}

describe('bombas', () => {
  it('usar a bomba põe uma acesa na frente e gasta uma do inventário', () => {
    const { w, p } = setup();
    expect(useItem(w, p, 0)).toEqual({ ok: true });
    expect(w.bombs).toHaveLength(1);
    expect(p.bag[0]).toEqual({ id: 'bomb', n: 2 });
  });
  it('a explosão abre o paredão rachado, destrói o arbusto e empurra quem está perto sem ferir (sem PvP)', () => {
    const { w, p } = setup();
    useItem(w, p, 0);
    run(w, FUSE + 1);
    expect(w.bombs).toHaveLength(0);
    expect(w.map.get(6, 2)).toBe('d');                 // passagem aberta
    expect(w.map.get(5, 2)).toBe('.');                 // arbusto foi
    expect(p.hp).toBe(p.maxHp);                        // você mesmo: só o empurrão
    expect(p.state).toBe('hurt');
  });
  it('a rachadura se fecha de novo com o tempo (para a próxima turma descobrir)', () => {
    const { w, p } = setup();
    useItem(w, p, 0); run(w, FUSE + 1);
    p.x = 24;   // longe da passagem
    run(w, 3 * TICK_RATE);
    expect(w.map.get(6, 2)).toBe('X');
  });
  it('fere monstros no raio', () => {
    const { w, p, slime } = setup();
    slime.x = p.x + 18; slime.y = p.y;
    useItem(w, p, 0); run(w, FUSE + 1);
    expect(slime.hp).toBeLessThanOrEqual(0);
  });
  it('dá para levantar a bomba acesa e arremessar; segurar demais explode na mão', () => {
    const { w, p } = setup();
    useItem(w, p, 0);
    const press = (b: number) => { w.setInput('a', { ...emptyInput(), b: !!(b & BUTTON.b), a: !!(b & BUTTON.a), tap: b }); w.step(); };
    press(BUTTON.b);                                    // levanta
    expect(p.carry).toBe('bomb');
    run(w, 20);
    p.dir = 0; p.x = 3 * 16 + 8;                        // olhando para baixo, longe do paredão
    press(BUTTON.a);                                    // arremessa
    expect(p.carry).toBeNull();
    run(w, 60);
    expect(w.bombs).toHaveLength(1);                    // caiu e continua queimando
    run(w, FUSE);
    expect(w.bombs).toHaveLength(0);
    // segurar até o fim
    useItem(w, p, 0); press(BUTTON.b);
    run(w, FUSE + 2);
    expect(p.carry).toBeNull();
    expect(p.state === 'hurt' || p.state === 'walk').toBe(true);
  });
  it('bomba arremessada na água apaga', () => {
    const { w, p } = setup();
    p.x = 8 * 16 + 8; p.y = 2 * 16 + 4; p.dir = 0;
    w.thrown.push({ id: 99, owner: 'a', x: p.x + 16, y: 3 * 16 + 8, z: 2, vx: 0, vy: 0.5, vz: 0, type: 'bomb', fuse: 100 });
    run(w, 30);
    expect(w.bombs).toHaveLength(0);
    expect(w.thrown).toHaveLength(0);
  });
});

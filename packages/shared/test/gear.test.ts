import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, World, emptyInput, equipGear, gearIn, packEnemy, packPlayer, unpackEnemy, unpackPlayer, type InputState, type MapData } from '../src';

// Campo aberto 20×8; Ana em (5,4) olhando para a direita, uma geleca parada em (9,4).
function field(): MapData {
  const row = 'T' + '.'.repeat(18) + 'T';
  return { name: 'campo', cols: 20, rows: 8, spawn: { x: 40, y: 40 }, regions: [{ id: 'campo', name: 'Campo', x: 0, y: 0, w: 20, h: 8 }],
    tiles: ['T'.repeat(20), ...Array(6).fill(row), 'T'.repeat(20)], enemies: [{ type: 'slime', x: 9, y: 4 }], signs: {} };
}
function setup(slime = true) {
  const w = new World(field(), { ...DEFAULT_RULES, player: { ...DEFAULT_RULES.player, hpRegen: 0, manaRegen: 0 }, enemies: { ...DEFAULT_RULES.enemies, slime: { ...DEFAULT_RULES.enemies.slime, hp: 100 } } });
  const a = w.addPlayer('a', 'Ana', 5 * 16 + 8, 4 * 16 + 8); a.dir = 3; a.aim = 0;
  const e = w.enemies[0];
  if (!slime) e.dead = true;
  else { e.x = 9 * 16 + 8; e.y = 4 * 16 + 10; e.mode = 'idle'; e.timer = 1e9; }
  const step = (inp: Partial<InputState> = {}, n = 1) => { for (let i = 0; i < n; i++) { w.setInput('a', { ...emptyInput(), ...inp }); w.step(); } };
  const press = (k: 'a' | 'c', hold = 1) => { step({ [k]: true, tap: BUTTON[k] }); step({ [k]: true }, hold - 1); };
  return { w, a, e, step, press };
}

describe('equipamento', () => {
  it('começa com espada no A e arco no C', () => {
    const { a, press } = setup();
    expect(gearIn(a, 'a')).toBe('sword'); expect(gearIn(a, 'c')).toBe('bow');
    press('a'); expect(a.state).toBe('swing');
  });
  it('só equipa o que tem; o que estava no outro botão troca de lugar; sem o item, volta para a espada', () => {
    const { a } = setup();
    expect(equipGear(a, 'firestaff', 'a').ok).toBe(false);
    a.bag[0] = { id: 'firestaff', n: 1 };
    expect(equipGear(a, 'firestaff', 'a').ok).toBe(true);
    expect(equipGear(a, 'sword', 'c').ok).toBe(true);
    expect([gearIn(a, 'a'), gearIn(a, 'c')]).toEqual(['firestaff', 'sword']);
    expect(equipGear(a, 'firestaff', 'c').ok).toBe(true);   // troca
    expect([gearIn(a, 'a'), gearIn(a, 'c')]).toEqual(['sword', 'firestaff']);
    a.bag[0] = null;                                         // vendeu o cajado
    expect([gearIn(a, 'a'), gearIn(a, 'c')]).toEqual(['sword', 'bow']);
  });
});

describe('magias', () => {
  it('Cajado de Fogo: bola de fogo gasta mana e acerta a geleca', () => {
    const { w, a, e, step, press } = setup();
    a.bag[0] = { id: 'firestaff', n: 1 }; equipGear(a, 'firestaff', 'a');
    press('a'); step({}, 8);
    expect(a.mp).toBe(a.maxMp - w.rules.magic.fire.mana);
    step({}, 30);
    expect(e.hp).toBe(100 - w.rules.magic.fire.damage);
  });
  it('sem mana o cajado vira bastão (golpe de perto)', () => {
    const { a, press } = setup();
    a.bag[0] = { id: 'firestaff', n: 1 }; equipGear(a, 'firestaff', 'c'); a.mp = 2;
    press('c');
    expect(a.state).toBe('swing'); expect(a.using).toBe('firestaff');
  });
  it('segurar e soltar solta a explosão (mais mana, mais dano)', () => {
    const { w, a, e, step, press } = setup();
    a.bag[0] = { id: 'firestaff', n: 1 }; equipGear(a, 'firestaff', 'a'); a.mp = a.maxMp = 100;
    e.hp = 999;
    press('a', 60);                           // magia rápida, depois carrega
    expect(a.state).toBe('charge'); expect(a.charged).toBe(true);
    const mp = a.mp;
    step({}, 10);                             // solta: magia forte
    expect(a.mp).toBe(mp - w.rules.magic.blast.mana);
    step({}, 40);
    expect(e.hp).toBeLessThanOrEqual(999 - w.rules.magic.fire.damage - w.rules.magic.blast.damage);
  });
  it('Cajado de Luz cura você e quem está perto, mas não quem está longe', () => {
    const { w, a, step, press } = setup(false);
    const b = w.addPlayer('b', 'Beto', a.x + 20, a.y), c = w.addPlayer('c', 'Caio', a.x + 120, a.y);
    for (const p of [a, b, c]) p.hp = 50;
    a.bag[0] = { id: 'lightstaff', n: 1 }; equipGear(a, 'lightstaff', 'c');
    press('c'); step({}, 8);
    const h = w.rules.magic.heal.amount;
    expect([a.hp, b.hp, c.hp]).toEqual([50 + h, 50 + h, 50]);
  });
  it('Grimório Sombrio deixa a geleca lenta e rouba vida', () => {
    const { w, a, e, step, press } = setup();
    a.hp = 50;
    a.bag[0] = { id: 'darktome', n: 1 }; equipGear(a, 'darktome', 'a');
    press('a'); step({}, 40);
    expect(e.hp).toBe(100 - w.rules.magic.shadow.damage);
    expect(e.slowUntil! > w.tick).toBe(true);
    expect(a.hp).toBe(50 + w.rules.magic.shadow.drain);
  });
  it('magia não fere jogador sem PvP', () => {
    const { w, a, step, press } = setup(false);
    const b = w.addPlayer('b', 'Beto', a.x + 40, a.y);
    a.bag[0] = { id: 'firestaff', n: 1 }; equipGear(a, 'firestaff', 'a');
    press('a'); step({}, 30);
    expect(b.hp).toBe(b.maxHp);
  });
  it('a arma em uso e a lentidão viajam pela rede', () => {
    const { w, a, e, step, press } = setup();
    a.bag[0] = { id: 'darktome', n: 1 }; equipGear(a, 'darktome', 'a');
    press('a');
    expect(unpackPlayer(packPlayer(a)).using).toBe('darktome');
    step({}, 40);
    expect(unpackEnemy(packEnemy(e)).slowed).toBe(true);
  });
});

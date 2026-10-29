import { describe, expect, it } from 'vitest';
import { BUTTON, DEFAULT_RULES, TICK_RATE, World, emptyInput, pvpLock, setPvp, type GameEvent, type MapData, type Player, type PvpMode, type Rules } from '../src';
import vale from './fixtures';

const map = (enemies = false): MapData => ({ ...(vale as MapData), enemies: enemies ? (vale as MapData).enemies : [] });
const rules = (mode: PvpMode, safeZones: string[] = []): Rules => ({ ...DEFAULT_RULES, pvp: { ...DEFAULT_RULES.pvp, mode, safeZones, toggleCooldown: 2, combatLock: 1 } });
// Ana e Beto lado a lado na Margem do Rio (fora da Clareira), Ana olhando para Beto
function duel(mode: PvpMode, safeZones: string[] = []) {
  const w = new World(map(), rules(mode, safeZones));
  const a = w.addPlayer('a', 'Ana', 20 * 16, 7 * 16), b = w.addPlayer('b', 'Beto', 20 * 16 + 14, 7 * 16);
  a.dir = 3;
  return { w, a, b };
}
function swing(w: World, p: Player) {
  w.setInput(p.id, { ...emptyInput(), a: true, tap: BUTTON.a }); const ev = w.step();
  for (let i = 0; i < 20; i++) { w.setInput(p.id, emptyInput()); ev.push(...w.step()); }
  return ev;
}

describe('modos de PvP', () => {
  it('off: ninguém fere ninguém', () => {
    const { w, a, b } = duel('off'); a.pvp = b.pvp = true;
    swing(w, a);
    expect(b.hp).toBe(100);
  });
  it('optional: só fere se os dois ligaram o PvP', () => {
    const { w, a, b } = duel('optional');
    expect(setPvp(w, a, true)).toEqual({ ok: true });
    swing(w, a);
    expect(b.hp).toBe(100);                      // Beto não ligou
    setPvp(w, b, true); w.step();
    swing(w, a);
    expect(b.hp).toBe(100 - DEFAULT_RULES.pvp.damage.sword);
  });
  it('open: todo mundo fere todo mundo, sem precisar ligar', () => {
    const { w, a, b } = duel('open');
    w.step(); swing(w, a);
    expect(b.hp).toBe(100 - DEFAULT_RULES.pvp.damage.sword);
    expect(setPvp(w, a, false)).toEqual({ ok: false, reason: 'mode' });
  });
});

describe('zona segura', () => {
  it('ninguém se fere dentro dela, mesmo no modo open', () => {
    const { w, a, b } = duel('open', ['margem-do-rio']);
    w.step(); swing(w, a);
    expect(b.hp).toBe(100);
    expect(b.safe).toBe(true);
  });
  it('avisa quando entra e quando sai', () => {
    const w = new World(map(), rules('optional', ['clareira'])), p = w.addPlayer('a', 'Ana');
    expect(w.step()).toContainEqual({ t: 'zone', to: 'a', safe: true });
    p.x = 20 * 16;
    expect(w.step()).toContainEqual({ t: 'zone', to: 'a', safe: false });
  });
  it('não tem monstros: os de lá não nascem e os de fora não entram', () => {
    const w = new World(map(true), rules('optional', ['clareira']));
    const inClareira = () => w.enemies.filter(e => w.map.regionAt(e.x, e.y)?.id === 'clareira').length;
    expect(inClareira()).toBe(0);
    const s = w.enemies.find(e => e.type === 'slime' && w.map.regionAt(e.x, e.y)?.id === 'margem-do-rio')!;
    s.x = 16 * 16 + 8; s.y = 7 * 16 + 8;        // geleca na boca da trilha, rumo à Clareira
    for (let i = 0; i < 20; i++) { s.mode = 'hop'; s.vx = -1.05; s.vy = 0; s.timer = 26; for (let k = 0; k < 26; k++) w.step(); }
    expect(inClareira()).toBe(0);
  });
});

describe('ligar e desligar', () => {
  it('depois de ligar, só desliga após o cooldown; depois de brigar, espera o combat lock', () => {
    const { w, a, b } = duel('optional');
    setPvp(w, a, true); setPvp(w, b, true);
    expect(setPvp(w, a, false)).toMatchObject({ ok: false, reason: 'locked' });
    for (let i = 0; i < 2.1 * TICK_RATE; i++) w.step();
    expect(pvpLock(w, a)).toBe(0);
    swing(w, a);                                 // briga renova a trava
    expect(pvpLock(w, a)).toBeGreaterThan(0);
    for (let i = 0; i < 1.1 * TICK_RATE; i++) w.step();
    expect(setPvp(w, a, false)).toEqual({ ok: true });
    expect(a.pvp).toBe(false);
  });
});

describe('quem derrubou quem', () => {
  it('registra o autor e avisa', () => {
    const { w, a, b } = duel('open');
    b.hp = 5; w.step();
    const ev: GameEvent[] = swing(w, a);
    expect(b.state).toBe('dead');
    expect(b.killer).toBe('Ana');
    expect(ev).toContainEqual({ t: 'kill', by: 'a', victim: 'b' });
  });
  it('flecha acerta quem está no PvP e atravessa quem não está', () => {
    const { w, a, b } = duel('optional');
    b.x += 40; setPvp(w, a, true); w.step();
    const shoot = () => { w.setInput('a', { ...emptyInput(), c: true, tap: BUTTON.c, aim: 0 }); w.step(); for (let i = 0; i < 40; i++) { w.setInput('a', emptyInput()); w.step(); } };
    shoot();
    expect(b.hp).toBe(100);
    setPvp(w, b, true); w.step(); shoot();
    expect(b.hp).toBe(100 - DEFAULT_RULES.pvp.damage.arrow);
  });
});

describe('atributos no PvP (pvp.factor)', () => {
  // espada: +20 de ataque; cajado de fogo: +100 de defesa (só Beto tem); fator 0,5
  function armed(defended: boolean) {
    const { w, a, b } = duel('open');
    w.rules = { ...w.rules, gear: { sword: { attack: 20 }, firestaff: { defense: 100 } } };
    if (defended) { b.bag[0] = { id: 'firestaff', n: 1 }; b.gear = { a: 'sword', c: 'firestaff' }; }
    w.step();
    return { w, a, b };
  }
  it('ataque vale metade entre jogadores: 15 da espada + 20 × 0,5', () => {
    const { w, a, b } = armed(false);
    swing(w, a);
    expect(b.hp).toBe(75);
  });
  it('defesa também vale metade: 100 de defesa conta como 50', () => {
    const { w, a, b } = armed(true);
    swing(w, a);
    expect(b.hp).toBeCloseTo(100 - 25 * 100 / 150, 5);
  });
  it('fator 0: no PvP os atributos não contam', () => {
    const { w, a, b } = armed(true);
    w.rules = { ...w.rules, pvp: { ...w.rules.pvp, factor: 0 } };
    swing(w, a);
    expect(b.hp).toBe(85);
  });
});

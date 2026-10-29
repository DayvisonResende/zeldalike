import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, balance, type CalcRules } from '../src';

const r: CalcRules = { weapons: DEFAULT_RULES.weapons, magic: DEFAULT_RULES.magic, gear: {}, enemies: DEFAULT_RULES.enemies, pvp: DEFAULT_RULES.pvp, player: DEFAULT_RULES.player };
const sword = (gear: object) => balance(r, { name: 'X', desc: '', gear: { like: 'sword', ...gear } });

describe('calculadora de equilíbrio', () => {
  it('espada igual à inicial: os números de hoje, sem avisos', () => {
    const b = sword({});
    expect(b.lines[0]).toBe('Golpes para derrubar: Geleca 2 · Besouro 3 · Morcego 1 · Rei Geleca 40');
    expect(b.lines[2]).toBe('Dano por segundo: 46,2 (igual à espada inicial)');
    expect(b.lines[3]).toBe('PvP: derruba quem começa (100 de vida) em 7 golpes (a inicial: 7)');
    expect(b.warnings).toEqual([]);
  });
  it('espada de dano 15: mais forte, na conta certa', () => {
    const b = sword({ damage: 15 });
    expect(b.lines[0]).toBe('Golpes para derrubar: Geleca 2 · Besouro 2 · Morcego 1 · Rei Geleca 27');
    expect(b.lines[1]).toBe('Giro carregado: 30 · dash: 30');
    expect(b.lines[2]).toMatch(/\+50% que a espada inicial/);
    expect(b.warnings).toEqual([]);
  });
  it('avisa o que sai muito do padrão', () => {
    const b = sword({ damage: 50, stats: { attackSpeed: 50, defense: 120, hp: 100 } });
    expect(b.warnings.join(' | ')).toMatch(/dano por segundo da espada inicial/);
    expect(b.warnings.join(' | ')).toMatch(/Rei Geleca em 8 golpes/);
    expect(b.warnings.join(' | ')).toMatch(/2 golpes ou menos/);
    expect(b.warnings.join(' | ')).toMatch(/Defesa 100 ou mais/);
    expect(b.warnings.join(' | ')).toMatch(/perto do teto/);
    expect(b.warnings.join(' | ')).toMatch(/dobra a vida/);
  });
  it('cajados, arco e consumíveis', () => {
    expect(balance(r, { name: 'X', desc: '', gear: { like: 'firestaff', stats: { magic: 5 } } }).lines[0]).toBe('Bolas de fogo para derrubar: Geleca 1 · Besouro 2 · Morcego 1 · Rei Geleca 16');
    expect(balance(r, { name: 'X', desc: '', gear: { like: 'bow', damage: 20 } }).lines[0]).toBe('Flechas para derrubar: Geleca 1 · Besouro 2 · Morcego 1 · Rei Geleca 20');
    expect(balance(r, { name: 'X', desc: '', gear: { like: 'lightstaff' } }).lines[0]).toMatch(/^Cura 15 em você/);
    const potion = balance(r, { name: 'X', desc: '', heal: 100 });
    expect(potion.lines[0]).toMatch(/^Cura 100: 4 corações/);
    expect(potion.warnings[0]).toMatch(/Enche a vida inteira/);
  });
});

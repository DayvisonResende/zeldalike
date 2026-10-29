import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MapData } from '@vale/shared';
import { parseConfig } from '../src/config/load';
import { applyUses, checkUses, usesOf } from '../src/oficina/uses';
import vale from '../../shared/test/fixtures';

const text = fs.readFileSync(new URL('../config.yaml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const map = vale as MapData;
const cfg = parseConfig(text, map);
const none = { shops: {}, drops: {} };

describe('Oficina: onde o item aparece', () => {
  it('lê lojas, drops e baús', () => {
    const u = usesOf(cfg, { vale: map }, 'heart');
    expect(u.shops.find(s => s.id === 'clareira')).toMatchObject({ buy: 15 });
    expect(u.drops.find(d => d.enemy === 'slime')).toMatchObject({ name: 'Geleca', chance: 0.2, min: 1, max: 1 });
    expect(u.drops.find(d => d.enemy === 'king')).toMatchObject({ chance: 1, min: 2, max: 2 });
  });
  it('grava no config.yaml sem perder os comentários, e só mexe nas linhas do item', () => {
    const out = applyUses(text, 'shell', { shops: { clareira: { buy: 40, sell: null } }, drops: { bat: { chance: 0.05, min: 1, max: 1 }, king: { chance: 0.5, min: 1, max: 3 }, beetle: null } });
    expect(out).toContain('# o que a loja vende');
    expect(out).toContain('# hp: vida (a espada tira 10');
    const c = parseConfig(out, map);
    expect(c.shops.clareira.buy.shell).toBe(40);
    expect(c.shops.clareira.sell.shell).toBeUndefined();
    expect(c.enemies.bat.drops.shell).toBe(0.05);
    expect(c.enemies.king.drops.shell).toEqual({ chance: 0.5, min: 1, max: 3 });
    expect(c.enemies.beetle.drops.shell).toBeUndefined();
    expect(out).toMatch(/shell: \{ chance: 0\.5, min: 1, max: 3 \}/);
    const changed = out.split('\n').filter(l => !text.split('\n').includes(l));
    expect(changed.length).toBeLessThanOrEqual(3);   // as linhas novas do item; o resto do arquivo igual
  });
  it('monstro sem drops: cria a seção; tirar o último deixa {}; pôr de novo funciona', () => {
    const add = applyUses(text, 'boot', { shops: {}, drops: { chicken: { chance: 0.1, min: 1, max: 1 } } });
    expect(parseConfig(add, map).enemies.chicken.drops.boot).toBe(0.1);
    expect(add).toMatch(/  chicken:.*\n(    .*\n)*    drops:\n      boot: 0\.1\n/);
    const off = applyUses(add, 'boot', { shops: {}, drops: { chicken: null } });
    expect(parseConfig(off, map).enemies.chicken.drops).toEqual({});
    const again = applyUses(off, 'boot', { shops: {}, drops: { chicken: { chance: 0.2, min: 2, max: 4 } } });
    expect(parseConfig(again, map).enemies.chicken.drops.boot).toEqual({ chance: 0.2, min: 2, max: 4 });
  });
  it('trocar só o valor mantém o comentário da linha', () => {
    const out = applyUses(text, 'lightstaff', { shops: { clareira: { buy: 99, sell: null } }, drops: {} });
    expect(out).toContain('lightstaff: 99       # cajados e grimório: um de cada por pessoa');
  });
  it('nada a mudar: o arquivo sai igual', () => {
    expect(applyUses(text, 'heart', none)).toBe(text);
  });
  it('recusa números fora do lugar, em português', () => {
    expect(checkUses(cfg, { shops: { clareira: { buy: 0, sell: null } }, drops: {} })).toEqual(['clareira: preço de venda de 1 a 99999 de ouro']);
    expect(checkUses(cfg, { shops: {}, drops: { slime: { chance: 2, min: 1, max: 1 } } })).toEqual(['Geleca: chance de 1% a 100%']);
    expect(checkUses(cfg, { shops: {}, drops: { slime: { chance: 0.5, min: 3, max: 1 } } })).toEqual(['Geleca: quantidade de 1 a 99, com o mínimo até o máximo']);
    expect(checkUses(cfg, { shops: { padaria: { buy: 5, sell: null } }, drops: {} })).toEqual(['loja "padaria" não existe no config.yaml']);
  });
});

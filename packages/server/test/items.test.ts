import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REQUIRED_ITEMS, type MapData } from '@vale/shared';
import { ITEMS_DIR, loadItems, saveItem } from '../src/content/items';
import { parseConfig } from '../src/config/load';
import vale from '../../shared/test/fixtures';

// Pasta de itens de mentira: os obrigatórios copiados da de verdade, mais o que cada teste puser.
let dir = '';
function scratch(extra: Record<string, string | Buffer> = {}, skip: string[] = []) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'itens-'));
  for (const id of REQUIRED_ITEMS) if (!skip.includes(id)) for (const ext of ['.json', '.png']) fs.copyFileSync(path.join(ITEMS_DIR, id + ext), path.join(dir, id + ext));
  for (const [f, v] of Object.entries(extra)) fs.writeFileSync(path.join(dir, f), v);
  return dir;
}
afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); dir = ''; });
const icon = fs.readFileSync(path.join(ITEMS_DIR, 'heart.png'));
const big = Buffer.from(icon); big.writeUInt32BE(32, 16); big.writeUInt32BE(32, 20);   // cabeçalho de 32×32

describe('itens em content/items/', () => {
  it('a pasta do repositório é válida e traz cada ícone', () => {
    const c = loadItems();
    expect(c.heart).toMatchObject({ name: 'Coração', heal: 25 });
    expect(c.firestaff.gear).toEqual({ like: 'firestaff' });
    expect(c.heart.icon).toMatch(/^data:image\/png;base64,/);
  });
  it('item novo entra com o id do nome do arquivo', () => {
    const c = loadItems(scratch({ 'espada-de-ferro.json': '{ "name": "Espada de Ferro", "desc": "Pesada." }', 'espada-de-ferro.png': icon }));
    expect(c['espada-de-ferro'].name).toBe('Espada de Ferro');
  });
  it('erros em português, com o arquivo e o campo', () => {
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", "heal": "muito" }', 'x.png': icon }))).toThrow(/x\.json: heal/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", "cura": 5 }', 'x.png': icon }))).toThrow(/x\.json/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", ' }))).toThrow(/x\.json: JSON inválido/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X" }' }))).toThrow(/falta o ícone x\.png/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X" }', 'x.png': big }))).toThrow(/16×16 \(tem 32×32\)/);
    expect(() => loadItems(scratch({ 'Espada.json': '{ "name": "X" }' }))).toThrow(/Espada\.json: o nome do arquivo/);
    expect(() => loadItems(scratch({}, ['bomb']))).toThrow(/faltam itens que o jogo usa: bomb/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", "gear": { "like": "firestaff", "damage": 30 } }', 'x.png': icon }))).toThrow(/gear\.damage: dano próprio só vale para espada e arco/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", "gear": { "like": "machado" } }', 'x.png': icon }))).toThrow(/x\.json: gear\.like/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", "gear": { "like": "sword", "color": "azul" } }', 'x.png': icon }))).toThrow(/cor como #a1b2c3/);
    // raridade: sorteio só até raro; efeito só em épico e lendário, e o efeito precisa combinar com a arma
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", "rarity": "epic", "gear": { "like": "sword", "rolls": { "attack": [1, 3] } } }', 'x.png': icon }))).toThrow(/sorteio só em comum, incomum e raro/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", "rarity": "rare", "gear": { "like": "sword", "effect": { "kind": "poison", "value": 3 } } }', 'x.png': icon }))).toThrow(/efeito só em épico e lendário/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", "rarity": "epic", "gear": { "like": "sword", "effect": { "kind": "pierce", "value": 2 } } }', 'x.png': icon }))).toThrow(/só vale para arco/);
    expect(() => loadItems(scratch({ 'x.json': '{ "name": "X", "rarity": "rare", "gear": { "like": "sword", "rolls": { "attack": [5, 2] } } }', 'x.png': icon }))).toThrow(/mínimo não pode passar do máximo/);
    expect(loadItems(scratch({ 'x.json': '{ "name": "X", "rarity": "legendary", "gear": { "like": "bow", "effect": { "kind": "pierce", "value": 3 } } }', 'x.png': icon })).x.rarity).toBe('legendary');
  });
  it('o config só aceita itens que existem', () => {
    const text = fs.readFileSync(new URL('../config.yaml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(() => parseConfig(text.replace('      heart: 15', '      espada-de-gelo: 15'), vale as MapData)).toThrow(/espada-de-gelo.*não existe/);
  });
  it('Oficina grava: cria, não sobrescreve sem querer, confere o ícone, muda sem trocar o ícone', () => {
    const d = scratch();
    expect(saveItem(d, 'pedra', { name: 'Pedra', desc: 'Dura.' }, icon, true)).toEqual([]);
    expect(loadItems(d).pedra.name).toBe('Pedra');
    expect(saveItem(d, 'pedra', { name: 'Outra' }, icon, true)).toEqual(['já existe um item com o id "pedra"']);
    expect(saveItem(d, 'nova', { name: 'Nova' }, null, true)).toEqual(['ícone: escolha um PNG 16×16']);
    expect(saveItem(d, 'nova', { name: 'Nova' }, big, true)).toEqual(['ícone: precisa ter 16×16 (tem 32×32)']);
    expect(saveItem(d, 'Nova!', { name: 'Nova' }, icon, true)[0]).toMatch(/^id:/);
    expect(saveItem(d, 'pedra', { name: 'Pedra polida', heal: 3 }, null, false)).toEqual([]);
    expect(loadItems(d).pedra).toMatchObject({ name: 'Pedra polida', heal: 3 });
  });
});

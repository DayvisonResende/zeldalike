import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromTiled } from '../src';

const read = (f: string) => JSON.parse(fs.readFileSync(new URL('./maps/' + f, import.meta.url), 'utf8'));   // cópia fixa, não o mapa em edição
const tsj = read('vale.tsj');
// cópia do mapa do Vale para estragar em cada teste
const vale = () => structuredClone(read('vale.tmj'));
const layer = (m: { layers: { name: string }[] }, n: string) => m.layers.find(l => l.name === n) as any;

describe('mapa do Tiled', () => {
  it('o Vale carrega sem avisos', () => {
    const { map, warnings } = fromTiled(vale(), tsj, 'vale.tmj');
    expect([map.cols, map.rows, map.regions.length, map.enemies.length]).toEqual([48, 28, 6, 24]);   // 14 + 4 morcegos de noite + 6 galinhas
    expect(map.signs['9,3'][0]).toMatch(/Boas-vindas/);
    expect(warnings).toEqual([]);
  });
  it('mudança pintada no Tiled aparece no jogo', () => {
    const m = vale(); layer(m, 'terreno').data[2 * 48 + 2] = 11;   // tile 11 do tileset = água
    expect(fromTiled(m, tsj).map.tiles[2][2]).toBe('w');
  });
  it('explica o que está errado, em português', () => {
    const m = vale();
    layer(m, 'pontos').objects = [];
    layer(m, 'placas').objects[0].properties = [];
    layer(m, 'monstros').objects[0].type = 'dragao';
    let msg = '';
    try { fromTiled(m, tsj); } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/falta o ponto "partida"/);
    expect(msg).toMatch(/placa em x=9, y=3 sem a propriedade "texto"/);
    expect(msg).toMatch(/classe "dragao"/);
  });
  it('objeto na camada errada: diz qual é a certa e como mover', () => {
    const m = vale();
    layer(m, 'regioes').objects.push({ id: 99, name: '', type: 'beetle', point: true, x: 202, y: 339, width: 0, height: 0 });
    expect(() => fromTiled(m, tsj)).toThrow(/"beetle" em x=12, y=21 está na camada "regioes", mas é da camada "monstros"/);
  });
  it('avisa o que tutoriais ensinam e o jogo ignora', () => {
    const m = vale();
    m.layers.push({ type: 'tilelayer', name: 'decoracao', data: [] }, { type: 'objectgroup', name: 'colisao', objects: [] }, { type: 'imagelayer', name: 'fundo' });
    layer(m, 'terreno').data[5] += 0x80000000;   // espelhado na horizontal (o Tiled grava sem sinal)
    const { warnings } = fromTiled(m, tsj);
    expect(warnings.join('\n')).toMatch(/"decoracao" é ignorada[\s\S]*"colisao" é ignorada[\s\S]*"fundo" é ignorada[\s\S]*1 tile\(s\) espelhado/);
  });
  it('mapa infinito e camada comprimida têm instrução de como resolver no Tiled', () => {
    expect(() => fromTiled({ ...vale(), infinite: true }, tsj)).toThrow(/desmarque "Infinito"/);
    const m = vale(); layer(m, 'terreno').data = 'eJzt...'; layer(m, 'terreno').encoding = 'base64';
    expect(() => fromTiled(m, tsj)).toThrow(/CSV/);
  });
  it('tile apagado vira grama com aviso, e região pode vir sem id (usa o nome)', () => {
    const m = vale(); layer(m, 'terreno').data[0] = 0;
    layer(m, 'regioes').objects[0].properties = [];
    const { map, warnings } = fromTiled(m, tsj);
    expect(map.tiles[0][0]).toBe('.');
    expect(warnings[0]).toMatch(/1 tile\(s\) vazio/);
    expect(map.regions[0].id).toBe('clareira');
  });
});

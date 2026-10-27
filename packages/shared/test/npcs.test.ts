import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUTTON, World, blockedAt, emptyInput, fromTiled } from '../src';

const read = (f: string) => JSON.parse(fs.readFileSync(new URL('./maps/' + f, import.meta.url), 'utf8'));
const tsj = read('vale.tsj');
const npcLayer = (m: { layers: { name: string; objects?: any[] }[] }) => m.layers.find(l => l.name === 'npcs')!;

describe('NPCs', () => {
  it('vêm do Tiled com nome, falas, cores pelo nome e direção', () => {
    const { map } = fromTiled(read('vale.tmj'), tsj);
    const tome = map.npcs!.find(n => n.name === 'Velho Tomé')!;
    expect(tome).toMatchObject({ x: 12, y: 3, look: { cloak: 6, hair: 5 }, dir: 2 });
    expect(tome.pages[0]).toMatch(/bem-vindo ao Vale/);
    expect(tome.pages.length).toBe(5);
  });
  it('explica o que falta', () => {
    const m = read('vale.tmj');
    const o = npcLayer(m).objects![0];
    o.properties = o.properties.filter((p: { name: string }) => p.name !== 'texto');
    npcLayer(m).objects![1].properties.find((p: { name: string }) => p.name === 'capa').value = 'Arco-íris';
    let msg = ''; try { fromTiled(m, tsj); } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/"Velho Tomé"\) sem a propriedade "texto"/);
    expect(msg).toMatch(/cor desconhecida/);
  });
  it('conversa com o E: o diálogo leva o nome de quem fala; e ninguém atravessa o NPC', () => {
    const { map } = fromTiled(read('vale.tmj'), tsj);
    const w = new World({ ...map, enemies: [] });
    const p = w.addPlayer('a', 'Ana', 12 * 16 - 5, 3 * 16 + 8); p.dir = 3;   // encostada à esquerda do Velho Tomé
    expect(blockedAt(w.map, 12 * 16 + 8, 3 * 16 + 8, 5, 4)).toBe(true);
    w.setInput('a', { ...emptyInput(), b: true, tap: BUTTON.b });
    const ev = w.step().find(e => e.t === 'dialog');
    expect(ev).toMatchObject({ t: 'dialog', to: 'a', title: 'Velho Tomé', npc: '12,3' });
  });
});

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MapData } from '@vale/shared';
import { parseConfig, toRules } from '../src/config/load';
import vale from '../../shared/test/fixtures';

const text = fs.readFileSync(new URL('../config.yaml', import.meta.url), 'utf8');
const map = vale as MapData;

describe('config.yaml', () => {
  it('o arquivo do repositório é válido', () => {
    const cfg = parseConfig(text, map);
    expect(cfg.server.maxPlayers).toBe(100);
    expect(cfg.pvp.mode).toBe('optional');
  });
  it('converte tempos para segundos', () => {
    const r = toRules(parseConfig(text, map));
    expect(r.regrow.bush).toBe(180);
    expect(r.enemies.beetle.respawn).toBe(240);
    expect(parseConfig(text.replace('combatLock: 30s', 'combatLock: 1500ms'), map).pvp.combatLock).toBe(1.5);
  });
  it('aponta o campo e a linha do erro', () => {
    expect(() => parseConfig(text.replace('bush: 3m', 'bush: tres'), map)).toThrow(/regrow\.bush \(linha \d+\)/);
  });
  it('recusa chave digitada errado', () => {
    expect(() => parseConfig(text.replace('tallGrass:', 'tallgras:'), map)).toThrow(/regrow/);
  });
  it('recusa região que não existe no mapa', () => {
    expect(() => parseConfig(text.replace('respawnPoint: clareira', 'respawnPoint: atlantida'), map)).toThrow(/atlantida/);
  });
  it('recusa zona de invasão que não existe no mapa principal', () => {
    expect(() => parseConfig(text.replace('zone: clareira', 'zone: atlantida'), map)).toThrow(/events.invasion.zone "atlantida"/);
    expect(parseConfig(text.replace('every: 40m', 'every: 0').replace('zone: clareira', 'zone: atlantida'), map).events.invasion.every).toBe(0);
  });
  it('recusa modo de PvP desconhecido', () => {
    expect(() => parseConfig(text.replace('mode: optional', 'mode: livre'), map)).toThrow(/pvp\.mode/);
  });
});

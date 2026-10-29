import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import type { LootId, MapData, Rules } from '@vale/shared';
import { configSchema, type Config } from './schema';

z.config(z.locales.ptBR());   // mensagens de validação em português

export class ConfigError extends Error { }

// Lê e valida. Erros saem em português com o caminho do campo e a linha no arquivo.
// `map`: o mapa principal (onde fica o respawnPoint); `others`: os demais (zonas seguras podem estar em qualquer um).
export function parseConfig(text: string, map?: MapData, others: MapData[] = []): Config {
  const doc = parseDocument(text, { prettyErrors: true });
  if (doc.errors.length) throw new ConfigError(doc.errors.map(e => e.message).join('\n'));
  const res = configSchema.safeParse(doc.toJS());
  if (!res.success) {
    const lines = res.error.issues.map(i => {
      const node = doc.getIn(i.path as (string | number)[], true) as { range?: [number] } | undefined;
      const line = node?.range ? ' (linha ' + (text.slice(0, node.range[0]).split('\n').length) + ')' : '';
      return `  ${i.path.join('.') || '(raiz)'}${line}: ${i.message}`;
    });
    throw new ConfigError('config.yaml inválido:\n' + lines.join('\n'));
  }
  const cfg = res.data;
  if (map) {
    const main = new Set(map.regions.map(r => r.id)), all = new Set([...main, ...others.flatMap(m => m.regions.map(r => r.id))]);
    if (!main.has(cfg.player.respawnPoint)) throw new ConfigError(`config.yaml: player.respawnPoint "${cfg.player.respawnPoint}" não é uma região do mapa principal. Regiões dele: ${[...main].join(', ')}`);
    if (cfg.events.invasion.every > 0 && !main.has(cfg.events.invasion.zone)) throw new ConfigError(`config.yaml: events.invasion.zone "${cfg.events.invasion.zone}" não é uma região do mapa principal. Regiões dele: ${[...main].join(', ')}`);
    const lost = [map, ...others].flatMap(m => (m.npcs ?? []).filter(n => n.shop && !(n.shop in cfg.shops)).map(n => `${n.name} ("${n.shop}")`));
    if (lost.length) throw new ConfigError(`config.yaml: loja que não está em shops: ${lost.join(', ')}. Lojas do config: ${Object.keys(cfg.shops).join(', ') || 'nenhuma'}`);
    const bad = cfg.pvp.safeZones.filter(id => !all.has(id));
    if (bad.length) throw new ConfigError(`config.yaml: zona segura desconhecida ${bad.map(b => `"${b}"`).join(', ')}. Regiões dos mapas: ${[...all].join(', ')}`);
  }
  return cfg;
}
export function loadConfig(file: string, map?: MapData, others: MapData[] = []) { return parseConfig(fs.readFileSync(file, 'utf8'), map, others); }

export function toRules(cfg: Config): Rules {
  const { mode, safeZones, toggleCooldown, combatLock, damage, factor } = cfg.pvp;
  const enemy = (e: Config['enemies']['slime']) => ({
    ...e, drops: Object.entries(e.drops).map(([item, d]) => typeof d === 'number' ? { item: item as LootId, chance: d, min: 1, max: 1 } : { item: item as LootId, ...d })
  });
  return {
    regrow: cfg.regrow, enemies: { slime: enemy(cfg.enemies.slime), beetle: enemy(cfg.enemies.beetle), bat: enemy(cfg.enemies.bat), chicken: enemy(cfg.enemies.chicken), king: enemy(cfg.enemies.king) }, player: cfg.player,
    daynight: { cycle: cfg.daynight.cycle, start: cfg.daynight.start / 24 }, fun: cfg.fun, events: cfg.events, shops: cfg.shops, magic: cfg.magic,
    pvp: { mode, safeZones, toggleCooldown, combatLock, damage, factor }, rates: cfg.rates, leveling: cfg.leveling, inventory: cfg.inventory, loot: cfg.loot, party: cfg.party, weapons: cfg.weapons, gear: cfg.gear
  };
}

// Recarrega quando o arquivo é salvo. Vigia a pasta porque muitos editores salvam trocando o arquivo.
export function watchConfig(file: string, map: MapData, others: MapData[], onChange: (cfg: Config) => void, onError: (e: Error) => void) {
  let timer: NodeJS.Timeout | undefined;
  return fs.watch(path.dirname(file), (_, name) => {
    if (name !== path.basename(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { onChange(loadConfig(file, map, others)); } catch (e) { onError(e instanceof z.ZodError ? new ConfigError(e.message) : e as Error); }
    }, 150);
  });
}

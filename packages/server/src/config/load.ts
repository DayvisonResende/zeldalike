import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import type { LootId, MapData, Rules } from '@vale/shared';
import { configSchema, type Config } from './schema';

z.config(z.locales.ptBR());   // mensagens de validação em português

export class ConfigError extends Error { }

// Lê e valida. Erros saem em português com o caminho do campo e a linha no arquivo.
export function parseConfig(text: string, map?: MapData): Config {
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
    const ids = new Set(map.regions.map(r => r.id)), bad = [cfg.player.respawnPoint, ...cfg.pvp.safeZones].filter(id => !ids.has(id));
    if (bad.length) throw new ConfigError(`config.yaml: região desconhecida ${bad.map(b => `"${b}"`).join(', ')}. Regiões do mapa: ${[...ids].join(', ')}`);
  }
  return cfg;
}
export function loadConfig(file: string, map?: MapData) { return parseConfig(fs.readFileSync(file, 'utf8'), map); }

export function toRules(cfg: Config): Rules {
  const { mode, safeZones, toggleCooldown, combatLock, damage } = cfg.pvp;
  const enemy = (e: Config['enemies']['slime']) => ({
    ...e, drops: Object.entries(e.drops).map(([item, d]) => typeof d === 'number' ? { item: item as LootId, chance: d, min: 1, max: 1 } : { item: item as LootId, ...d })
  });
  return {
    regrow: cfg.regrow, enemies: { slime: enemy(cfg.enemies.slime), beetle: enemy(cfg.enemies.beetle) }, player: cfg.player,
    pvp: { mode, safeZones, toggleCooldown, combatLock, damage }, rates: cfg.rates, leveling: cfg.leveling, inventory: cfg.inventory, loot: cfg.loot
  };
}

// Recarrega quando o arquivo é salvo. Vigia a pasta porque muitos editores salvam trocando o arquivo.
export function watchConfig(file: string, map: MapData, onChange: (cfg: Config) => void, onError: (e: Error) => void) {
  let timer: NodeJS.Timeout | undefined;
  return fs.watch(path.dirname(file), (_, name) => {
    if (name !== path.basename(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { onChange(loadConfig(file, map)); } catch (e) { onError(e instanceof z.ZodError ? new ConfigError(e.message) : e as Error); }
    }, 150);
  });
}

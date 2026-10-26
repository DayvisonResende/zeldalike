import { z } from 'zod';

const UNIT = { ms: 0.001, s: 1, m: 60, h: 3600 } as const;
// "5m" → 300. Números puros são segundos.
export const duration = z.union([
  z.number().nonnegative(),
  z.string().regex(/^\d+(\.\d+)?(ms|s|m|h)$/, 'use um tempo como 500ms, 30s, 5m ou 1h')
]).transform(v => {
  if (typeof v === 'number') return v;
  const [, n, u] = v.match(/^([\d.]+)(ms|s|m|h)$/)!;
  return Number(n) * UNIT[u as keyof typeof UNIT];
});
const enemy = z.strictObject({ hp: z.number().int().positive(), respawn: duration, damage: z.number().nonnegative() });
const rate = z.number().nonnegative();

// strictObject recusa chaves desconhecidas: um "tallgras" digitado errado vira erro, não silêncio.
export const configSchema = z.strictObject({
  server: z.strictObject({
    port: z.number().int().min(1).max(65535),
    maxPlayers: z.number().int().positive(),
    motd: z.string().default('')
  }),
  network: z.strictObject({ sendRate: z.number().int().min(1).max(60) }),
  chat: z.strictObject({
    maxLength: z.number().int().min(1).max(500),
    localRange: z.number().int().positive(),
    burst: z.number().int().positive(),
    per: duration,
    announceJoins: z.boolean()
  }),
  regrow: z.strictObject({ bush: duration, tallGrass: duration, rock: duration }),
  enemies: z.strictObject({ slime: enemy, beetle: enemy }),
  player: z.strictObject({
    maxHp: z.number().int().positive(),
    maxMana: z.number().int().nonnegative(),
    hpRegen: rate,
    manaRegen: rate,
    regenDelay: duration,
    respawnPoint: z.string(),
    respawnDelay: duration,
    invulnerableAfterRespawn: duration
  }),
  rates: z.strictObject({ xp: rate, drop: rate, gold: rate }),
  pvp: z.strictObject({
    mode: z.enum(['off', 'optional', 'open']),
    toggleCooldown: duration,
    combatLock: duration,
    safeZones: z.array(z.string()),
    damage: z.strictObject({ sword: rate, spin: rate, dash: rate, arrow: rate, thrown: rate }),
    announceKills: z.boolean()
  })
});
export type Config = z.output<typeof configSchema>;

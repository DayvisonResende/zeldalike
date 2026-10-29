import { ITEM_IDS, LOOT_IDS, type ItemId, type LootId } from '@vale/shared';
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
const chance = z.number().min(0).max(1);
// Drop: "heart: 0.2" (chance, 1 unidade) ou "gold: { chance: 0.8, min: 1, max: 3 }".
const dropEntry = z.union([chance, z.strictObject({ chance, min: z.number().int().positive(), max: z.number().int().positive() })])
  .refine(d => typeof d === 'number' || d.min <= d.max, 'min não pode ser maior que max');
const enemy = z.strictObject({
  hp: z.number().int().positive(), respawn: duration, damage: z.number().nonnegative(), xp: z.number().int().nonnegative(),
  drops: z.partialRecord(z.enum(LOOT_IDS as [LootId, ...LootId[]]), dropEntry).default({})
});
const rate = z.number().nonnegative();
// Loja: "heart: 15" = preço em ouro. buy: o que ela vende; sell: o que ela compra de você.
const prices = z.partialRecord(z.enum(ITEM_IDS as [ItemId, ...ItemId[]]), z.number().int().positive()).default({});
const shop = z.strictObject({ buy: prices, sell: prices });

// strictObject recusa chaves desconhecidas: um "tallgras" digitado errado vira erro, não silêncio.
export const configSchema = z.strictObject({
  world: z.strictObject({
    maps: z.record(z.string().regex(/^[a-z0-9-]+$/, 'id de mapa: só letras minúsculas sem acento, números e hífen'), z.string().min(1)),
    start: z.string()
  }).refine(w => w.start in w.maps, { message: 'world.start precisa ser um dos mapas de world.maps', path: ['start'] }),
  server: z.strictObject({
    port: z.number().int().min(1).max(65535),
    maxPlayers: z.number().int().positive(),
    motd: z.string().default('')
  }),
  network: z.strictObject({ sendRate: z.number().int().min(1).max(60) }),
  database: z.strictObject({
    file: z.string().min(1),
    // cópias automáticas do banco, feitas com o servidor rodando; every 0 = desligado
    backup: z.strictObject({ every: duration, keep: z.number().int().min(1).max(1000), dir: z.string().min(1) }).default({ every: 21600, keep: 28, dir: 'data/backups' })
  }),
  admins: z.array(z.string()).default([]),   // usuários (o login da conta) com comandos de administrador no chat
  accounts: z.strictObject({
    maxCharacters: z.number().int().min(1).max(20),
    sessionDays: z.number().positive(),
    saveEvery: duration,
    registerPerHour: z.number().int().positive(),
    loginPer5Min: z.number().int().positive()
  }),
  chat: z.strictObject({
    maxLength: z.number().int().min(1).max(500),
    localRange: z.number().int().positive(),
    burst: z.number().int().positive(),
    per: duration,
    announceJoins: z.boolean(),
    filter: z.boolean().default(true),                 // troca palavrões por ***
    blockedWords: z.array(z.string()).default([])      // palavras a mais para esconder
  }),
  regrow: z.strictObject({ bush: duration, tallGrass: duration, rock: duration, secret: duration, torch: duration.default(90), block: duration.default(120) }),
  enemies: z.strictObject({ slime: enemy, beetle: enemy, bat: enemy, chicken: enemy, king: enemy }),
  daynight: z.strictObject({ cycle: duration, start: z.number().min(0).max(24) }),
  fun: z.strictObject({
    liftPlayers: z.boolean(), struggle: z.number().int().min(1).max(100),
    chickenAnger: z.number().int().min(1), swarmSize: z.number().int().min(0).max(40), swarmTime: duration, swarmDamage: z.number().nonnegative()
  }),
  magic: z.strictObject({
    fire: z.strictObject({ mana: rate, damage: z.number().int().nonnegative(), pvp: rate }),
    blast: z.strictObject({ mana: rate, damage: z.number().int().nonnegative(), pvp: rate, radius: z.number().positive() }),
    heal: z.strictObject({ mana: rate, amount: rate, radius: z.number().positive() }),
    bigHeal: z.strictObject({ mana: rate, amount: rate, radius: z.number().positive() }),
    shadow: z.strictObject({ mana: rate, damage: z.number().int().nonnegative(), pvp: rate, drain: rate, slow: duration }),
    curse: z.strictObject({ mana: rate, damage: z.number().int().nonnegative(), pvp: rate, drain: rate, slow: duration })
  }),
  shops: z.record(z.string().regex(/^[a-z0-9-]+$/, 'id de loja: só letras minúsculas sem acento, números e hífen'), shop).default({}),
  events: z.strictObject({
    invasion: z.strictObject({
      every: duration, warning: duration, duration: duration.refine(d => d > 0, 'a invasão precisa durar mais que 0'),
      count: z.number().int().min(1).max(200), zone: z.string(),
      reward: z.strictObject({ xp: z.number().int().nonnegative(), gold: z.number().int().nonnegative() })
    })
  }),
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
  leveling: z.strictObject({
    maxLevel: z.number().int().min(1).max(999), base: z.number().positive(), exponent: z.number().min(1).max(3),
    hpPerLevel: z.number().nonnegative(), manaPerLevel: z.number().nonnegative()
  }),
  inventory: z.strictObject({ slots: z.number().int().min(1).max(60), stack: z.number().int().min(1).max(9999) }),
  loot: z.strictObject({ ownerTime: duration, lifetime: duration }),
  pvp: z.strictObject({
    mode: z.enum(['off', 'optional', 'open']),
    toggleCooldown: duration,
    combatLock: duration,
    safeZones: z.array(z.string()),
    damage: z.strictObject({ sword: rate, spin: rate, dash: rate, arrow: rate, thrown: rate, bomb: rate }),
    announceKills: z.boolean()
  })
});
export type Config = z.output<typeof configSchema>;

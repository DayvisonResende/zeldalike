import type { PvpAttack, PvpMode } from './systems/pvp';
import type { LootId } from './items';

export type EnemyType = 'slime' | 'beetle';

// Números de balanceamento que o servidor lê do config.yaml. Tempos em segundos.
export interface Rules {
  regrow: { bush: number; tallGrass: number; rock: number };
  enemies: Record<EnemyType, { hp: number; respawn: number; damage: number; xp: number; drops: DropRule[] }>;
  rates: { xp: number; drop: number; gold: number };
  leveling: { maxLevel: number; base: number; exponent: number; hpPerLevel: number; manaPerLevel: number };
  inventory: { slots: number; stack: number };
  loot: { ownerTime: number; lifetime: number };
  player: {
    maxHp: number; maxMana: number;
    hpRegen: number; manaRegen: number;   // por segundo
    regenDelay: number;                   // a vida só volta depois desse tempo sem levar dano
    respawnPoint: string;                 // id da região; vazio = ponto de partida do mapa
    respawnDelay: number; invulnerableAfterRespawn: number;
  };
  pvp: {
    mode: PvpMode;
    safeZones: string[];                  // ids de região onde nunca há PvP nem monstros
    toggleCooldown: number;               // depois de ligar, só desliga após esse tempo
    combatLock: number;                   // depois de uma briga, não desliga por esse tempo
    damage: Record<PvpAttack, number>;
  };
}
// Um item da tabela de drop: chance de 0 a 1 e quantidade sorteada entre min e max.
export interface DropRule { item: LootId; chance: number; min: number; max: number }

export const DEFAULT_RULES: Rules = {
  regrow: { bush: 180, tallGrass: 60, rock: 300 },
  enemies: {
    slime: { hp: 2, respawn: 120, damage: 10, xp: 5, drops: [{ item: 'gold', chance: 0.8, min: 1, max: 3 }, { item: 'jelly', chance: 0.5, min: 1, max: 1 }, { item: 'heart', chance: 0.2, min: 1, max: 1 }, { item: 'mana', chance: 0.1, min: 1, max: 1 }] },
    beetle: { hp: 3, respawn: 240, damage: 20, xp: 12, drops: [{ item: 'gold', chance: 0.9, min: 2, max: 6 }, { item: 'shell', chance: 0.4, min: 1, max: 1 }, { item: 'heart', chance: 0.25, min: 1, max: 1 }, { item: 'mana', chance: 0.15, min: 1, max: 1 }] }
  },
  rates: { xp: 1, drop: 1, gold: 1 },
  leveling: { maxLevel: 50, base: 50, exponent: 1.5, hpPerLevel: 10, manaPerLevel: 5 },
  inventory: { slots: 20, stack: 99 },
  loot: { ownerTime: 10, lifetime: 60 },
  player: { maxHp: 100, maxMana: 50, hpRegen: 2, manaRegen: 3, regenDelay: 5, respawnPoint: '', respawnDelay: 5, invulnerableAfterRespawn: 3 },
  pvp: { mode: 'optional', safeZones: [], toggleCooldown: 300, combatLock: 30, damage: { sword: 15, spin: 25, dash: 20, arrow: 10, thrown: 20 } }
};

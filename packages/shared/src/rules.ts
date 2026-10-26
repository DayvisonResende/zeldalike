import type { PvpAttack, PvpMode } from './systems/pvp';

export type EnemyType = 'slime' | 'beetle';

// Números de balanceamento que o servidor lê do config.yaml. Tempos em segundos.
export interface Rules {
  regrow: { bush: number; tallGrass: number; rock: number };
  enemies: Record<EnemyType, { hp: number; respawn: number; damage: number }>;
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
export const DEFAULT_RULES: Rules = {
  regrow: { bush: 180, tallGrass: 60, rock: 300 },
  enemies: { slime: { hp: 2, respawn: 120, damage: 10 }, beetle: { hp: 3, respawn: 240, damage: 20 } },
  player: { maxHp: 100, maxMana: 50, hpRegen: 2, manaRegen: 3, regenDelay: 5, respawnPoint: '', respawnDelay: 5, invulnerableAfterRespawn: 3 },
  pvp: { mode: 'optional', safeZones: [], toggleCooldown: 300, combatLock: 30, damage: { sword: 15, spin: 25, dash: 20, arrow: 10, thrown: 20 } }
};

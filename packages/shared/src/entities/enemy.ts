import type { Dir } from '../constants';
import type { EnemyType } from '../rules';
import type { Body } from '../world/collision';
import type { DistMap } from '../world/pathfinding';

export interface Enemy extends Body {
  id: number; type: EnemyType; spawn: number;   // índice do ponto de spawn no mapa
  hp: number; hurtT: number; kx: number; ky: number; z: number;
  anim: number; mode: 'idle' | 'hop' | 'patrol' | 'chase' | 'search'; timer: number; dir: Dir; vx: number; vy: number;
  dying: boolean; dead: boolean;
  lastHitBy: string | null;   // jogador que deu o último golpe
  anger: number; angerBy: string | null; angerAt: number;   // galinha: golpes seguidos de quem, e quando foi o último
  maxHp: number;
  slowUntil?: number; slowed?: boolean;                     // lento (sombra) até este passo; slowed: calculado a cada passo
  poison?: { dps: number; until: number; next: number; by: string };   // envenenado (efeito de épico/lendário)
  mini?: boolean;                                           // minichefe de masmorra: mais vida, mais dano, maior
  minion?: boolean;                                         // geleca chamada pelo Rei (não volta quando morre)
  enraged?: boolean; lands?: number;                        // Rei Geleca: furioso (metade da vida) e pulos dados
  hitters?: Record<string, number>;                         // Rei Geleca: dano de cada jogador (todos ganham XP e loot)
  invader?: boolean;                                        // geleca da invasão (não volta quando morre)
  swarm: { target: string; until: number } | null;          // galinha do bando de vingança: persegue só `target`
  next: { x: number; y: number } | null;
  alert: number; lost: number; lastSeen: [number, number] | null; searchMap: DistMap | null; search: number;
}

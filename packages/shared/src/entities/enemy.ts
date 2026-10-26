import type { Dir } from '../constants';
import type { EnemyType } from '../rules';
import type { Body } from '../world/collision';
import type { DistMap } from '../world/pathfinding';

export interface Enemy extends Body {
  id: number; type: EnemyType; spawn: number;   // índice do ponto de spawn no mapa
  hp: number; hurtT: number; kx: number; ky: number; z: number;
  anim: number; mode: 'idle' | 'hop' | 'patrol' | 'chase' | 'search'; timer: number; dir: Dir; vx: number; vy: number;
  dying: boolean; dead: boolean;
  next: { x: number; y: number } | null;
  alert: number; lost: number; lastSeen: [number, number] | null; searchMap: DistMap | null; search: number;
}

import { FACE, type Dir } from '../constants';
import { emptyInput, type InputState } from '../input';
import { DEFAULT_LOOK, type Look } from '../looks';
import type { Body } from '../world/collision';

export type Carryable = 'b' | 'r';
export type PlayerState = 'walk' | 'hurt' | 'lift' | 'carry' | 'throw' | 'swing' | 'spin' | 'charge' | 'dashprep' | 'dash' | 'bonk' | 'hop' | 'bow' | 'dead';

export interface Player extends Body {
  id: string; name: string; look: Look;
  z: number; push: number; dvx: number; dvy: number;
  hop: { y0: number; y1: number; t: number; dur: number; h: number } | null;
  dir: Dir; aim: number; state: PlayerState; t: number; step: number; walkT: number;
  inv: number; kx: number; ky: number;
  carry: Carryable | null; liftFrom: { x: number; y: number } | null;
  charge: number; charged: boolean;
  hit: Set<number | string>; // inimigos e jogadores já atingidos neste golpe
  hp: number; maxHp: number; mp: number; maxMp: number;
  hurtAt: number;            // passo do último dano (a regeneração espera)
  killer: string | null;     // nome de quem derrubou (enquanto caído)
  pvp: boolean; pvpOnAt: number; combatAt: number;   // PvP ligado, quando ligou, última briga com jogador
  pvpActive: boolean; safe: boolean;                  // calculados a cada passo
  input: InputState;
  region: string | null;
}

export function createPlayer(id: string, name: string, x: number, y: number, look: Look = DEFAULT_LOOK, maxHp = 100, maxMp = 50): Player {
  return { id, name, look: { ...look }, x, y, hw: 5, hh: 4, z: 0, push: 0, dvx: 0, dvy: 0, hop: null, dir: 1, aim: FACE[1], state: 'walk', t: 0, step: 0, walkT: 0,
    inv: 0, kx: 0, ky: 0, carry: null, liftFrom: null, charge: 0, charged: false, hit: new Set(),
    hp: maxHp, maxHp, mp: maxMp, maxMp, hurtAt: -Infinity, killer: null, pvp: false, pvpOnAt: -Infinity, combatAt: -Infinity, pvpActive: false, safe: false,
    input: emptyInput(), region: null };
}

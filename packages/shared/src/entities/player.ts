import { FACE, type Dir } from '../constants';
import { emptyInput, type InputState } from '../input';
import { DEFAULT_LOOK, type Look } from '../looks';
import { emptyInventory, type Slot } from '../items';
import type { Fishing } from '../systems/fishing';
import type { Body } from '../world/collision';
import { DEFAULT_GEAR, type GearId, type GearSlot } from '../gear';

export type Carryable = 'b' | 'r' | 'bomb' | 'player';
export type PlayerState = 'walk' | 'hurt' | 'lift' | 'carry' | 'throw' | 'swing' | 'spin' | 'charge' | 'dashprep' | 'dash' | 'bonk' | 'hop' | 'bow' | 'dead' | 'fish' | 'held' | 'flying' | 'cast';

export interface Player extends Body {
  id: string; name: string; look: Look;
  z: number; push: number; dvx: number; dvy: number;
  hop: { y0: number; y1: number; t: number; dur: number; h: number } | null;
  dir: Dir; aim: number; state: PlayerState; t: number; step: number; walkT: number;
  inv: number; kx: number; ky: number;
  carry: Carryable | null; liftFrom: { x: number; y: number } | null;
  carryFuse: number;                                  // pavio da bomba no colo (passos)
  holding: string | null; heldBy: string | null;      // carregando alguém / no colo de alguém
  struggle: number; prevDirs: number;                 // tentativas de se soltar; setas do passo anterior
  vz: number; throwBy: string | null; flyFrom: { x: number; y: number } | null;   // voo depois de arremessado
  charge: number; charged: boolean;
  gear: Record<GearSlot, GearId>;                     // o que está nos botões A e C
  using: GearId | null; useBtn: GearSlot; big: boolean;   // arma da ação em curso, botão que a começou, magia carregada
  slowUntil: number;                                  // lento (maldição) até este passo
  shove: number;                                      // passos empurrando um bloco
  hit: Set<number | string>; // inimigos e jogadores já atingidos neste golpe
  hp: number; maxHp: number; mp: number; maxMp: number;
  hurtAt: number;            // passo do último dano (a regeneração espera)
  killer: string | null;     // nome de quem derrubou (enquanto caído)
  pvp: boolean; pvpOnAt: number; combatAt: number;   // PvP ligado, quando ligou, última briga com jogador
  pvpActive: boolean; safe: boolean;                  // calculados a cada passo
  level: number; xp: number; gold: number;
  bag: Slot[]; bagVersion: number;                    // inventário; a versão muda a cada alteração (o servidor só reenvia quando muda)
  useAt: number;                                      // passo do último item usado
  inPortal: boolean;                                  // está dentro da área de um portal (só dispara ao entrar)
  portalWait: number;                                 // passos até os portais voltarem a funcionar depois de uma chegada
  chests: Record<string, number>; chestsVersion: number;
  steps: number;                                      // passos dados (semente da pesca: cliente e servidor sorteiam igual)
  fish: Fishing | null;   // baús que abriu ("mapa:x,y" → quando, em ms)
  input: InputState;
  region: string | null;
}

export function createPlayer(id: string, name: string, x: number, y: number, look: Look = DEFAULT_LOOK, maxHp = 100, maxMp = 50): Player {
  return { id, name, look: { ...look }, x, y, hw: 5, hh: 4, z: 0, push: 0, dvx: 0, dvy: 0, hop: null, dir: 1, aim: FACE[1], state: 'walk', t: 0, step: 0, walkT: 0,
    inv: 0, kx: 0, ky: 0, carry: null, liftFrom: null, carryFuse: 0, holding: null, heldBy: null, struggle: 0, prevDirs: 0, vz: 0, throwBy: null, flyFrom: null, charge: 0, charged: false, gear: { ...DEFAULT_GEAR }, using: null, useBtn: 'a', big: false, slowUntil: 0, shove: 0, hit: new Set(),
    hp: maxHp, maxHp, mp: maxMp, maxMp, hurtAt: -Infinity, killer: null, pvp: false, pvpOnAt: -Infinity, combatAt: -Infinity, pvpActive: false, safe: false,
    level: 1, xp: 0, gold: 0, bag: emptyInventory(20), bagVersion: 0, useAt: -Infinity, inPortal: true, portalWait: 0, chests: {}, chestsVersion: 0, steps: 0, fish: null,
    input: emptyInput(), region: null };
}

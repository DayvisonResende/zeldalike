import { TS } from '../constants';
import type { DropRule, EnemyType } from '../rules';
import type { Look } from '../looks';
import type { Dir } from '../constants';
import { SOLID } from './tiles';

export interface Region { id: string; name: string; x: number; y: number; w: number; h: number }   // em tiles
// Área que leva a outro lugar: `to` = id do mapa de destino (null = este mesmo mapa), `arrive` = ponto de chegada lá.
export interface Portal { x: number; y: number; w: number; h: number; to: string | null; arrive: string }   // em pixels
// Baú: posição em tiles, o que tem dentro e em quantos segundos enche de novo para quem abriu.
export interface Chest { x: number; y: number; loot: DropRule[]; respawn: number }
// NPC: personagem parado que conversa. Posição em tiles; `dir`: para onde olha (0 baixo, 1 cima, 2 esquerda, 3 direita).
export interface Npc { x: number; y: number; name: string; pages: string[]; look: Look; dir: Dir }
export interface MapData {
  name: string; cols: number; rows: number;
  spawn: { x: number; y: number };                       // em pixels (o ponto "partida")
  points?: Record<string, { x: number; y: number }>;     // pontos com nome da camada "pontos" (chegadas de portais)
  portals?: Portal[];
  chests?: Chest[];
  npcs?: Npc[];
  regions: Region[];
  tiles: string[];
  enemies: { type: EnemyType; x: number; y: number; when?: 'day' | 'night' }[];   // em tiles; when: só de dia / só de noite
  dark?: boolean;                                         // sempre escuro (caverna): ignora a hora do dia
  signs: Record<string, string[]>;                        // "x,y" → páginas
}

export class WorldMap {
  readonly cols: number; readonly rows: number;
  readonly tiles: string[][];
  readonly data: MapData;
  version = 0;   // muda a cada tile alterado; o pathfinding usa para saber quando recalcular
  private chestAt = new Map<string, Chest>();   // baús e NPCs ocupam o tile: ninguém atravessa
  private npcAt = new Map<string, Npc>();

  constructor(data: MapData) {
    if (data.tiles.length !== data.rows || data.tiles.some(r => r.length !== data.cols)) throw new Error(`mapa "${data.name}": tamanho não bate com ${data.cols}x${data.rows}`);
    this.data = data; this.cols = data.cols; this.rows = data.rows;
    this.tiles = data.tiles.map(r => r.split(''));
    for (const c of data.chests ?? []) this.chestAt.set(c.x + ',' + c.y, c);
    for (const n of data.npcs ?? []) this.npcAt.set(n.x + ',' + n.y, n);
  }
  get width() { return this.cols * TS; }
  get height() { return this.rows * TS; }
  inBounds(tx: number, ty: number) { return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows; }
  get(tx: number, ty: number) { return this.inBounds(tx, ty) ? this.tiles[ty][tx] : 'T'; }
  set(tx: number, ty: number, c: string) { if (this.tiles[ty][tx] !== c) { this.tiles[ty][tx] = c; this.version++; } }
  solid(tx: number, ty: number) { return !this.inBounds(tx, ty) || SOLID.has(this.tiles[ty][tx]) || this.chestAt.has(tx + ',' + ty) || this.npcAt.has(tx + ',' + ty); }
  npc(tx: number, ty: number) { return this.npcAt.get(tx + ',' + ty); }
  chest(tx: number, ty: number) { return this.chestAt.get(tx + ',' + ty); }
  sign(tx: number, ty: number) { return this.data.signs[tx + ',' + ty]; }
  regionAt(x: number, y: number) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    return this.data.regions.find(r => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) ?? null;
  }
}

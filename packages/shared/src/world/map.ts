import { TS } from '../constants';
import type { EnemyType } from '../rules';
import { SOLID } from './tiles';

export interface Region { id: string; name: string; x: number; y: number; w: number; h: number }   // em tiles
export interface MapData {
  name: string; cols: number; rows: number;
  spawn: { x: number; y: number };                       // em pixels
  regions: Region[];
  tiles: string[];
  enemies: { type: EnemyType; x: number; y: number }[];   // em tiles
  signs: Record<string, string[]>;                        // "x,y" → páginas
}

export class WorldMap {
  readonly cols: number; readonly rows: number;
  readonly tiles: string[][];
  readonly data: MapData;
  version = 0;   // muda a cada tile alterado; o pathfinding usa para saber quando recalcular

  constructor(data: MapData) {
    if (data.tiles.length !== data.rows || data.tiles.some(r => r.length !== data.cols)) throw new Error(`mapa "${data.name}": tamanho não bate com ${data.cols}x${data.rows}`);
    this.data = data; this.cols = data.cols; this.rows = data.rows;
    this.tiles = data.tiles.map(r => r.split(''));
  }
  get width() { return this.cols * TS; }
  get height() { return this.rows * TS; }
  inBounds(tx: number, ty: number) { return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows; }
  get(tx: number, ty: number) { return this.inBounds(tx, ty) ? this.tiles[ty][tx] : 'T'; }
  set(tx: number, ty: number, c: string) { if (this.tiles[ty][tx] !== c) { this.tiles[ty][tx] = c; this.version++; } }
  solid(tx: number, ty: number) { return !this.inBounds(tx, ty) || SOLID.has(this.tiles[ty][tx]); }
  sign(tx: number, ty: number) { return this.data.signs[tx + ',' + ty]; }
  regionAt(x: number, y: number) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    return this.data.regions.find(r => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) ?? null;
  }
}

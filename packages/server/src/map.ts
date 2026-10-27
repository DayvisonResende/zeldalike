import fs from 'node:fs';
import path from 'node:path';
import { MapError, fromTiled, type MapData } from '@vale/shared';

export const DEFAULT_MAP = path.resolve(import.meta.dirname, '../../../content/maps/vale.tmj');

// Lê um mapa do Tiled (.tmj) e o tileset que ele usa (.tsj, ao lado). Avisos vão para o terminal; erros impedem a partida.
export function loadMap(file: string, log = true): MapData {
  const read = (f: string, what: string) => {
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { throw new MapError(`não consegui ler ${what} (${f}): ${(e as Error).message}`); }
  };
  const tmj = read(file, 'o mapa'), src = tmj?.tilesets?.[0]?.source;
  const tsj = src ? read(path.resolve(path.dirname(file), src), 'o tileset') : null;
  const { map, warnings } = fromTiled(tmj, tsj, path.basename(file));
  if (log) for (const w of warnings) console.warn(`[mapa] ${path.basename(file)}: aviso: ${w}`);
  return map;
}

// Portais que apontam para outro mapa: o mapa precisa existir e ter o ponto de chegada.
export function checkPortals(maps: Record<string, MapData>) {
  const errors: string[] = [];
  for (const [id, m] of Object.entries(maps)) for (const p of m.portals ?? []) {
    if (!p.to) continue;
    const dest = maps[p.to], at = `portal em x=${Math.floor(p.x / 16)}, y=${Math.floor(p.y / 16)} do mapa "${id}"`;
    if (!dest) errors.push(`${at} leva ao mapa "${p.to}", que não está em world.maps no config.yaml (mapas: ${Object.keys(maps).join(', ')})`);
    else if (!dest.points?.[p.arrive]) errors.push(`${at} leva ao ponto "${p.arrive}" do mapa "${p.to}", que não existe lá (pontos: ${Object.keys(dest.points ?? {}).join(', ')})`);
  }
  if (errors.length) throw new MapError('portais com problema:\n' + errors.map(e => '  • ' + e).join('\n'));
}

/* Mapas do servidor: cada um vira um mundo separado. O "start" é o principal (onde se nasce e renasce). */
let maps: Record<string, MapData> = {};
let start = '';
export function setMaps(all: Record<string, MapData>, startId: string) { maps = all; start = startId; }
export function setMap(m: MapData) { setMaps({ vale: m }, 'vale'); }   // um mapa só (testes)
export const getMaps = () => maps;
export const startMap = () => start;
export function getMap() { const m = maps[start]; if (!m) throw new Error('mapa ainda não carregado'); return m; }

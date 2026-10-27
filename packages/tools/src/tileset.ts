// Gera content/maps/tileset.png e vale.tsj (o tileset do Tiled) com a mesma arte que o jogo desenha.
// Rode de novo (npm run map:tileset) sempre que mudar a arte dos tiles ou criar um tipo novo em TILE_KINDS.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FakeCanvas } from './fake-canvas';
import { encodePng } from './png';

(globalThis as unknown as { document: unknown }).document = { createElement: () => new FakeCanvas() };
const { TILE_KINDS, TS, WorldMap } = await import('@vale/shared');
const { tileFor } = await import('../../client/src/render/tiles');

const OUT = fileURLToPath(new URL('../../../content/maps/', import.meta.url));
const COLS = 5, rows = Math.ceil(TILE_KINDS.length / COLS);
const sheet = new FakeCanvas(COLS * TS, rows * TS), ctx = sheet.getContext();
TILE_KINDS.forEach((k, i) => {
  // um mapa de 1×1: os vizinhos fora do mapa contam como iguais, então sai o tile "puro", sem bordas
  const one = new WorldMap({ name: k.name, cols: 1, rows: 1, spawn: { x: 8, y: 8 }, regions: [], tiles: [k.code], enemies: [], signs: {} });
  ctx.drawImage(tileFor(one, 0, 0, 0) as unknown as FakeCanvas, (i % COLS) * TS, Math.floor(i / COLS) * TS);
});
fs.writeFileSync(OUT + 'tileset.png', encodePng(sheet.width, sheet.height, sheet.data));
const tsj = {
  type: 'tileset', version: '1.10', tiledversion: '1.11.0', name: 'vale', tilewidth: TS, tileheight: TS, spacing: 0, margin: 0,
  columns: COLS, tilecount: TILE_KINDS.length, image: 'tileset.png', imagewidth: sheet.width, imageheight: sheet.height,
  tiles: TILE_KINDS.map((k, id) => ({ id, properties: [{ name: 'codigo', type: 'string', value: k.code }, { name: 'nome', type: 'string', value: k.name }] }))
};
fs.writeFileSync(OUT + 'vale.tsj', JSON.stringify(tsj, null, 2) + '\n');
console.log(`tileset: ${TILE_KINDS.length} tiles → content/maps/tileset.png e vale.tsj`);

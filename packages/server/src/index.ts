import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig, watchConfig } from './config/load';
import { configPath, getConfig, setConfig, setConfigFile } from './config/store';
import { startServer } from './app';
import { openDatabase, setDb } from './persistence/db';
import { purgeSessions } from './persistence/accounts';
import { scheduleBackups } from './persistence/backup';
import { loadDay, setBootDay } from './persistence/state';
import { MapError, type MapData } from '@vale/shared';
import { checkPortals, loadMap, setMaps } from './map';
import { ITEMS_DIR, ItemsError, getCatalog, loadItems, setCatalog, watchItems } from './content/items';
import { oficinaEnabled } from './oficina/routes';
import { preciseTimers } from './timer';
import { clockText } from './chat/commands';

// CONFIG=arquivo.yaml troca a configuração (por exemplo, uma de produção ou de teste).
const CONFIG_FILE = process.env.CONFIG ? path.resolve(process.env.CONFIG) : fileURLToPath(new URL('../config.yaml', import.meta.url));
setConfigFile(CONFIG_FILE);

// Itens primeiro (o config e os mapas citam itens), depois o config (diz quais são os mapas), depois os mapas e os portais
// entre eles, depois o config de novo, agora conferindo as regiões.
let WORLD_MAP!: MapData, OTHERS: MapData[] = [], MAP_FILES: string[] = [];
try {
  setCatalog(loadItems());
  console.log(`[itens] ${Object.keys(getCatalog()).length} em ${ITEMS_DIR}`);
  const world = loadConfig(CONFIG_FILE).world, maps: Record<string, MapData> = {};
  for (const [id, file] of Object.entries(world.maps)) {
    const full = path.resolve(path.dirname(CONFIG_FILE), file);
    maps[id] = loadMap(full); MAP_FILES.push(full);
    console.log(`[mapa] ${id}: ${full}`);
  }
  checkPortals(maps);
  setMaps(maps, world.start);
  WORLD_MAP = maps[world.start]; OTHERS = Object.entries(maps).filter(([id]) => id !== world.start).map(([, m]) => m);
  setConfig(loadConfig(CONFIG_FILE, WORLD_MAP, OTHERS));
} catch (e) { console.error(e instanceof ConfigError || e instanceof MapError || e instanceof ItemsError ? e.message : e); process.exit(1); }

// Itens mudaram (Oficina ou à mão): só valem se o config e os mapas continuarem certos com eles (um item usado numa
// loja, num drop ou num baú não pode sumir). Senão, fica o catálogo anterior.
watchItems(ITEMS_DIR, c => {
  const old = getCatalog();
  setCatalog(c);
  try { for (const f of MAP_FILES) loadMap(f, false); loadConfig(CONFIG_FILE, WORLD_MAP, OTHERS); console.log(`[itens] recarregados: ${Object.keys(c).length}`); }
  catch (e) { setCatalog(old); console.error('[itens] mudança ignorada, mantendo os anteriores: algo ainda usa um item que sumiu.\n' + (e as Error).message); }
}, e => console.error('[itens] mudança ignorada, mantendo os anteriores.\n' + e.message));

watchConfig(CONFIG_FILE, WORLD_MAP, OTHERS,
  c => { setConfig(c); console.log('[config] recarregada'); },
  e => console.error('[config] mudança ignorada, mantendo a anterior.\n' + e.message));

// Banco: caminho relativo ao arquivo de config.
const dbFile = path.resolve(path.dirname(CONFIG_FILE), getConfig().database.file);
const db = await openDatabase(dbFile);
setDb(db);
console.log(`[banco] ${dbFile}`);
const day = await loadDay(db);   // o relógio do mundo continua de onde parou
setBootDay(day);
if (day !== null) console.log(`[relógio] mundo continua às ${clockText(day * 24)}`);
setInterval(() => { purgeSessions(db).catch(e => console.error('[banco]', e)); }, 3_600_000).unref();
// Backups automáticos (pasta relativa ao arquivo de config, como o banco).
scheduleBackups(db, () => ({ ...getConfig().database.backup, dir: configPath(getConfig().database.backup.dir) }));

// PORT no ambiente vence o config: é como as hospedagens (Fly, Railway, Render) dizem a porta.
const port = Number(process.env.PORT) || getConfig().server.port;
const clock = await preciseTimers();   // Windows: relógio de 1 ms antes de o laço do jogo começar
if (clock) console.log(`[relógio] ${clock}`);
const { roomId, hasClient } = await startServer(port);
console.log(`[vale] mundo "${WORLD_MAP.name}" no ar: ${WORLD_MAP.cols}x${WORLD_MAP.rows} tiles, ${WORLD_MAP.regions.length} regiões, sala ${roomId}, porta ${port}`);
console.log(hasClient
  ? `[vale] jogo em http://localhost:${port} (versão compilada; para editar com recarga automática use npm run dev → http://localhost:5173)`
  : `[vale] a página do jogo ainda não foi compilada: rode "npm start" (compila e sobe tudo) ou "npm run dev" (http://localhost:5173)`);
if (oficinaEnabled()) console.log(`[oficina] ligada (grava em content/): http://localhost:5173/oficina.html no npm run dev${hasClient ? `, ou http://localhost:${port}/oficina` : ''}`);

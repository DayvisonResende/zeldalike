import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig, watchConfig } from './config/load';
import { configPath, getConfig, setConfig, setConfigDir } from './config/store';
import { startServer } from './app';
import { openDatabase, setDb } from './persistence/db';
import { purgeSessions } from './persistence/accounts';
import { scheduleBackups } from './persistence/backup';
import { MapError, type MapData } from '@vale/shared';
import { checkPortals, loadMap, setMaps } from './map';

// CONFIG=arquivo.yaml troca a configuração (por exemplo, uma de produção ou de teste).
const CONFIG_FILE = process.env.CONFIG ? path.resolve(process.env.CONFIG) : fileURLToPath(new URL('../config.yaml', import.meta.url));
setConfigDir(path.dirname(CONFIG_FILE));

// Config primeiro (diz quais são os mapas), depois os mapas e os portais entre eles, depois a config de novo, agora conferindo as regiões.
let WORLD_MAP!: MapData, OTHERS: MapData[] = [];
try {
  const world = loadConfig(CONFIG_FILE).world, maps: Record<string, MapData> = {};
  for (const [id, file] of Object.entries(world.maps)) {
    const full = path.resolve(path.dirname(CONFIG_FILE), file);
    maps[id] = loadMap(full);
    console.log(`[mapa] ${id}: ${full}`);
  }
  checkPortals(maps);
  setMaps(maps, world.start);
  WORLD_MAP = maps[world.start]; OTHERS = Object.entries(maps).filter(([id]) => id !== world.start).map(([, m]) => m);
  setConfig(loadConfig(CONFIG_FILE, WORLD_MAP, OTHERS));
} catch (e) { console.error(e instanceof ConfigError || e instanceof MapError ? e.message : e); process.exit(1); }

watchConfig(CONFIG_FILE, WORLD_MAP, OTHERS,
  c => { setConfig(c); console.log('[config] recarregada'); },
  e => console.error('[config] mudança ignorada, mantendo a anterior.\n' + e.message));

// Banco: caminho relativo ao arquivo de config.
const dbFile = path.resolve(path.dirname(CONFIG_FILE), getConfig().database.file);
const db = await openDatabase(dbFile);
setDb(db);
console.log(`[banco] ${dbFile}`);
setInterval(() => { purgeSessions(db).catch(e => console.error('[banco]', e)); }, 3_600_000).unref();
// Backups automáticos (pasta relativa ao arquivo de config, como o banco).
scheduleBackups(db, () => ({ ...getConfig().database.backup, dir: configPath(getConfig().database.backup.dir) }));

// PORT no ambiente vence o config: é como as hospedagens (Fly, Railway, Render) dizem a porta.
const port = Number(process.env.PORT) || getConfig().server.port;
const { roomId, hasClient } = await startServer(port);
console.log(`[vale] mundo "${WORLD_MAP.name}" no ar: ${WORLD_MAP.cols}x${WORLD_MAP.rows} tiles, ${WORLD_MAP.regions.length} regiões, sala ${roomId}, porta ${port}`);
console.log(hasClient
  ? `[vale] jogo em http://localhost:${port} (versão compilada; para editar com recarga automática use npm run dev → http://localhost:5173)`
  : `[vale] a página do jogo ainda não foi compilada: rode "npm start" (compila e sobe tudo) ou "npm run dev" (http://localhost:5173)`);

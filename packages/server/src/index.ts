import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig, watchConfig } from './config/load';
import { getConfig, setConfig } from './config/store';
import { startServer } from './app';
import { WORLD_MAP } from './map';

// CONFIG=arquivo.yaml troca a configuração (por exemplo, uma de produção ou de teste).
const CONFIG_FILE = process.env.CONFIG ? path.resolve(process.env.CONFIG) : fileURLToPath(new URL('../config.yaml', import.meta.url));

try { setConfig(loadConfig(CONFIG_FILE, WORLD_MAP)); }
catch (e) { console.error(e instanceof ConfigError ? e.message : e); process.exit(1); }

watchConfig(CONFIG_FILE, WORLD_MAP,
  c => { setConfig(c); console.log('[config] recarregada'); },
  e => console.error('[config] mudança ignorada, mantendo a anterior.\n' + e.message));

// PORT no ambiente vence o config: é como as hospedagens (Fly, Railway, Render) dizem a porta.
const port = Number(process.env.PORT) || getConfig().server.port;
const { roomId, hasClient } = await startServer(port);
console.log(`[vale] mundo "${WORLD_MAP.name}" no ar: ${WORLD_MAP.cols}x${WORLD_MAP.rows} tiles, ${WORLD_MAP.regions.length} regiões, sala ${roomId}, porta ${port}`);
console.log(hasClient
  ? `[vale] jogo em http://localhost:${port} (versão compilada; para editar com recarga automática use npm run dev → http://localhost:5173)`
  : `[vale] a página do jogo ainda não foi compilada: rode "npm start" (compila e sobe tudo) ou "npm run dev" (http://localhost:5173)`);

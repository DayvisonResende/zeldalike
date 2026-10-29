// Confere os mapas sem subir o servidor: npm run map:check [arquivo.tmj]
// Sem argumento, confere todos os mapas de world.maps no config.yaml, os portais entre eles e as regiões que o config cita.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MapError, type MapData } from '@vale/shared';
import { ConfigError, parseConfig } from '../../server/src/config/load';
import { checkPortals, loadMap } from '../../server/src/map';
import { ItemsError, loadItems, setCatalog } from '../../server/src/content/items';

const CONFIG = fileURLToPath(new URL('../../server/config.yaml', import.meta.url));
function summary(id: string, file: string, map: MapData) {
  const count = (c: string) => map.tiles.join('').split(c).length - 1;
  console.log(`✔ ${id} (${path.basename(file)}): ${map.cols}×${map.rows} tiles`);
  console.log(`  regiões: ${map.regions.map(r => `${r.name} (${r.id})`).join(', ')}`);
  const bats = map.enemies.filter(e => e.type === "bat");
  console.log(`  monstros: ${map.enemies.filter(e => e.type === "slime").length} gelecas, ${map.enemies.filter(e => e.type === "beetle").length} besouros, ${bats.length} morcegos, ${map.enemies.filter(e => e.type === "chicken").length} galinhas${map.enemies.some(e => e.type === "king") ? " · chefão: Rei Geleca" : ""}${bats.some(b => b.when === "night") ? " (alguns só de noite)" : ""}${map.dark ? " · mapa escuro" : ""} · placas: ${Object.keys(map.signs).length} · baús: ${map.chests?.length ?? 0} · NPCs: ${map.npcs?.map(n => n.name).join(", ") || "nenhum"}`);
  const portals = map.portals ?? [];
  if (portals.length) console.log(`  portais: ${portals.map(p => `${p.to ?? 'este mapa'} → ${p.arrive}`).join(', ')}`);
  console.log(`  pontos: ${Object.keys(map.points ?? {}).join(', ')} · árvores: ${count('T')} · arbustos: ${count('b')} · pedras: ${count('r')}`);
  if (map.rooms || map.keys || map.fragments) console.log(`  masmorra: ${map.rooms?.length ?? 0} salas que trancam, ${map.keys?.length ?? 0} chaves no chão, ${count('L')} portas trancadas, ${map.fragments?.length ?? 0} fragmentos de vida, ${map.enemies.filter(e => e.mini).length} minichefes`);
}
try {
  setCatalog(loadItems());   // os mapas (baús) e o config (lojas, drops) citam itens de content/items/
  const text = fs.readFileSync(CONFIG, 'utf8');
  if (process.argv[2]) {
    const file = path.resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2]);
    summary(path.basename(file, '.tmj'), file, loadMap(file));
  } else {
    const world = parseConfig(text).world, maps: Record<string, MapData> = {};
    for (const [id, f] of Object.entries(world.maps)) { const file = path.resolve(path.dirname(CONFIG), f); maps[id] = loadMap(file); summary(id, file, maps[id]); }
    checkPortals(maps);
    console.log('✔ portais: todos levam a mapas e pontos que existem');
    parseConfig(text, maps[world.start], Object.entries(maps).filter(([id]) => id !== world.start).map(([, m]) => m));
    console.log('✔ config.yaml: ponto de renascimento e zonas seguras existem nos mapas');
  }
} catch (e) {
  console.error(e instanceof MapError || e instanceof ConfigError || e instanceof ItemsError ? '✘ ' + e.message : e);
  process.exit(1);
}

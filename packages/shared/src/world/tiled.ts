import { TS } from '../constants';
import { LOOT_IDS, type LootId } from '../items';
import type { DropRule, EnemyType } from '../rules';
import type { MapData, Region } from './map';
import { SOLID, TILE_KINDS } from './tiles';
import { CLOAKS, HAIRS } from '../looks';
import type { Dir } from '../constants';

/* Lê um mapa do Tiled (.tmj, JSON) e o tileset dele (.tsj) e devolve o MapData do jogo.
   Camadas esperadas (nomes em minúsculas, sem acento):
     terreno   camada de tiles com o chão, as árvores, a água…
     regioes   retângulos; o nome do retângulo é o nome da região (propriedade "id" opcional)
     monstros  pontos com a classe "slime" ou "beetle"
     placas    pontos em cima de um tile de placa, com a propriedade "texto" (linha em branco = nova página)
     pontos    um ponto chamado "partida": onde os jogadores nascem
   Problemas viram erros (o mapa não carrega) ou avisos (carrega, mas é bom corrigir), sempre em português. */
export interface TiledResult { map: MapData; warnings: string[] }
export class MapError extends Error { }

interface TProp { name: string; value: unknown }
interface TObject { id: number; name?: string; type?: string; class?: string; x: number; y: number; width?: number; height?: number; point?: boolean; properties?: TProp[] }
interface TLayer { type: string; name: string; layers?: TLayer[]; width?: number; height?: number; data?: number[] | string; encoding?: string; compression?: string; objects?: TObject[] }
interface TMap { width: number; height: number; tilewidth: number; tileheight: number; infinite?: boolean; tilesets: { firstgid: number; source?: string }[]; layers: TLayer[]; properties?: TProp[] }
interface TTileset { tiles?: { id: number; properties?: TProp[]; objectgroup?: unknown; animation?: unknown }[] }

const FLIP_BITS = 0x1fffffff;   // o Tiled usa os bits altos para espelhar/girar: aqui não importam
// Camadas que o jogo entende. O resto (comum em tutoriais) é ignorado, com aviso.
export const KNOWN_LAYERS = ['terreno', 'regioes', 'monstros', 'placas', 'pontos', 'portais', 'baus', 'npcs'];
const prop = (o: { properties?: TProp[] }, name: string) => o.properties?.find(p => p.name === name)?.value;
const slug = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s: string) => slug(s).replace(/-/g, '');

export function fromTiled(raw: unknown, rawTileset: unknown, name = 'mapa'): TiledResult {
  const m = raw as TMap, ts = rawTileset as TTileset, errors: string[] = [], warnings: string[] = [];
  if (!m || typeof m !== 'object' || !Array.isArray(m.layers)) throw new MapError(`${name}: não parece um mapa do Tiled salvo em JSON (.tmj).`);
  if (m.infinite) throw new MapError(`${name}: o mapa está como "infinito". No Tiled: Mapa → Propriedades do mapa → desmarque "Infinito".`);
  if (m.tilewidth !== TS || m.tileheight !== TS) throw new MapError(`${name}: os tiles precisam ser de ${TS}×${TS} pixels (o mapa usa ${m.tilewidth}×${m.tileheight}).`);
  const layer = (n: string) => m.layers.find(l => norm(l.name) === n);
  ignored(m, ts, warnings);

  // tile do Tiled → código do jogo, pelo "codigo" de cada tile do tileset (ou pela ordem, se faltar)
  const firstgid = m.tilesets?.[0]?.firstgid ?? 1;
  const codeOf = new Map<number, string>();
  TILE_KINDS.forEach((k, i) => codeOf.set(i, k.code));
  for (const t of ts?.tiles ?? []) { const c = prop(t, 'codigo'); if (typeof c === 'string') codeOf.set(t.id, c); }

  /* ---------- terreno ---------- */
  const ground = layer('terreno');
  if (!ground || ground.type !== 'tilelayer') throw new MapError(`${name}: falta a camada de tiles "terreno".`);
  if (!Array.isArray(ground.data)) throw new MapError(`${name}: a camada "terreno" está comprimida. No Tiled: Mapa → Propriedades do mapa → "Formato da camada de tiles" = CSV.`);
  const W = m.width, H = m.height, rows: string[][] = Array.from({ length: H }, () => Array(W).fill('.'));
  let blanks = 0;
  ground.data.forEach((gid, i) => {
    const x = i % W, y = (i / W) | 0, id = (gid & FLIP_BITS) - firstgid;
    if (gid === 0) { blanks++; return; }
    const c = codeOf.get(id);
    if (!c) errors.push(`tile desconhecido (número ${id}) em x=${x}, y=${y}`);
    else rows[y][x] = c;
  });
  if (blanks) warnings.push(`${blanks} tile(s) vazio(s) na camada "terreno" viraram grama.`);
  const tileAt = (px: number, py: number) => rows[Math.floor(py / TS)]?.[Math.floor(px / TS)];

  /* ---------- regiões ---------- */
  const regions: Region[] = [];
  // objeto colocado na camada errada (acontece quando a camada selecionada no painel era outra)
  const misplaced = (o: TObject, here: string) => {
    const cls = (o.type || o.class || '').toLowerCase(), at = `x=${Math.floor(o.x / TS)}, y=${Math.floor(o.y / TS)}`;
    const home = cls === 'slime' || cls === 'beetle' || cls === 'bat' || cls === 'chicken' || cls === 'king' ? 'monstros' : cls === 'placa' ? 'placas' : cls === 'regiao' ? 'regioes' : cls === 'portal' ? 'portais' : cls === 'bau' ? 'baus' : cls === 'npc' ? 'npcs' : norm(o.name ?? '') === 'partida' ? 'pontos' : null;
    if (!home || home === here) return false;
    errors.push(`"${o.name || cls}" em ${at} está na camada "${here}", mas é da camada "${home}". No Tiled: botão direito no objeto → Mover para a camada → ${home}`);
    return true;
  };
  for (const o of layer('regioes')?.objects ?? []) {
    if (misplaced(o, 'regioes')) continue;
    if (!o.name) { errors.push(`região sem nome (objeto ${o.id}, em x=${Math.floor(o.x / TS)}, y=${Math.floor(o.y / TS)}): dê um nome ao retângulo`); continue; }
    if (!o.width || !o.height) { errors.push(`região "${o.name}" precisa ser um retângulo`); continue; }
    const id = typeof prop(o, 'id') === 'string' ? String(prop(o, 'id')) : slug(o.name);
    if (regions.some(r => r.id === id)) { errors.push(`duas regiões com o id "${id}"`); continue; }
    regions.push({ id, name: o.name, x: Math.round(o.x / TS), y: Math.round(o.y / TS), w: Math.max(1, Math.round(o.width / TS)), h: Math.max(1, Math.round(o.height / TS)) });
  }
  if (!regions.length) errors.push('nenhuma região: desenhe pelo menos um retângulo na camada "regioes"');

  /* ---------- monstros ---------- */
  const enemies: MapData['enemies'] = [];
  for (const o of layer('monstros')?.objects ?? []) {
    if (misplaced(o, 'monstros')) continue;
    const type = (o.type || o.class || o.name || '').toLowerCase();
    const where = `x=${Math.floor(o.x / TS)}, y=${Math.floor(o.y / TS)}`;
    if (type !== 'slime' && type !== 'beetle' && type !== 'bat' && type !== 'chicken' && type !== 'king') { errors.push(`monstro de classe "${type || '(vazia)'}" em ${where}: use "slime", "beetle", "bat", "chicken" ou "king"`); continue; }
    const tx = Math.floor(o.x / TS), ty = Math.floor(o.y / TS);
    if (type !== 'bat' && SOLID.has(tileAt(o.x, o.y) ?? 'T')) warnings.push(`${type} em ${where} está em cima de algo sólido: talvez não consiga andar`);
    const quando = slug(String(prop(o, 'quando') ?? ''));
    if (quando && quando !== 'dia' && quando !== 'noite') { errors.push(`${type} em ${where}: "quando" precisa ser "dia" ou "noite" (ou ficar vazio para sempre)`); continue; }
    enemies.push(quando ? { type: type as EnemyType, x: tx, y: ty, when: quando === 'dia' ? 'day' : 'night' } : { type: type as EnemyType, x: tx, y: ty });
  }

  /* ---------- placas ---------- */
  const signs: Record<string, string[]> = {};
  for (const o of layer('placas')?.objects ?? []) {
    if (misplaced(o, 'placas')) continue;
    const tx = Math.floor(o.x / TS), ty = Math.floor(o.y / TS), text = prop(o, 'texto');
    if (rows[ty]?.[tx] !== 's') { errors.push(`placa em x=${tx}, y=${ty} não está em cima de um tile de placa`); continue; }
    if (typeof text !== 'string' || !text.trim()) { errors.push(`placa em x=${tx}, y=${ty} sem a propriedade "texto"`); continue; }
    signs[tx + ',' + ty] = pagesOf(text);
  }
  rows.forEach((r, y) => r.forEach((c, x) => { if (c === 's' && !signs[x + ',' + y]) warnings.push(`tile de placa em x=${x}, y=${y} sem texto (ninguém vai conseguir ler)`); }));

  /* ---------- pontos com nome (chegadas) ---------- */
  const points: Record<string, { x: number; y: number }> = {};
  for (const o of layer('pontos')?.objects ?? []) {
    if (misplaced(o, 'pontos')) continue;
    const key = slug(o.name ?? '');
    if (!key) { errors.push(`ponto sem nome em x=${Math.floor(o.x / TS)}, y=${Math.floor(o.y / TS)}: dê um nome (ele é usado como chegada de portais)`); continue; }
    if (points[key]) { errors.push(`dois pontos chamados "${o.name}"`); continue; }
    if (SOLID.has(tileAt(o.x, o.y) ?? 'T')) errors.push(`o ponto "${o.name}" está em cima de algo sólido (x=${Math.floor(o.x / TS)}, y=${Math.floor(o.y / TS)})`);
    points[key] = { x: Math.round(o.x), y: Math.round(o.y) };
  }

  /* ---------- portais ---------- */
  const portals: NonNullable<MapData['portals']> = [];
  for (const o of layer('portais')?.objects ?? []) {
    if (misplaced(o, 'portais')) continue;
    const where = `x=${Math.floor(o.x / TS)}, y=${Math.floor(o.y / TS)}`;
    if (!o.width || !o.height) { errors.push(`portal em ${where} precisa ser um retângulo (a área que leva a outro lugar)`); continue; }
    const to = String(prop(o, 'destino') ?? '').trim(), arrive = slug(String(prop(o, 'chegada') ?? ''));
    if (!arrive) { errors.push(`portal em ${where} sem a propriedade "chegada" (nome de um ponto no mapa de destino)`); continue; }
    if (!to && !points[arrive]) { errors.push(`portal em ${where} leva ao ponto "${arrive}", que não existe neste mapa`); continue; }
    portals.push({ x: o.x, y: o.y, w: o.width, h: o.height, to: to || null, arrive });
  }

  /* ---------- baús ---------- */
  const chests: NonNullable<MapData['chests']> = [];
  for (const o of layer('baus')?.objects ?? []) {
    if (misplaced(o, 'baus')) continue;
    const tx = Math.floor(o.x / TS), ty = Math.floor(o.y / TS), where = `baú em x=${tx}, y=${ty}`;
    if (SOLID.has(rows[ty]?.[tx] ?? 'T')) { errors.push(`${where} está em cima de algo sólido: ponha em chão livre`); continue; }
    const loot = parseLoot(prop(o, 'conteudo'));
    if (typeof loot === 'string') { errors.push(`${where}: ${loot}`); continue; }
    const respawn = parseDuration(prop(o, 'renasce') ?? '10m');
    if (respawn === null) { errors.push(`${where}: "renasce" precisa ser um tempo como 30s, 10m ou 2h`); continue; }
    chests.push({ x: tx, y: ty, loot, respawn });
  }

  /* ---------- NPCs ---------- */
  const npcs: NonNullable<MapData['npcs']> = [];
  for (const o of layer('npcs')?.objects ?? []) {
    if (misplaced(o, 'npcs')) continue;
    const tx = Math.floor(o.x / TS), ty = Math.floor(o.y / TS), where = `NPC em x=${tx}, y=${ty}`;
    if (!o.name?.trim()) { errors.push(`${where} sem nome: o nome do objeto é o que aparece sobre a cabeça`); continue; }
    if (SOLID.has(rows[ty]?.[tx] ?? 'T')) { errors.push(`${where} ("${o.name}") está em cima de algo sólido`); continue; }
    const text = prop(o, 'texto');
    if (typeof text !== 'string' || !text.trim()) { errors.push(`${where} ("${o.name}") sem a propriedade "texto" (o que ele fala)`); continue; }
    const cloak = pickIndex(prop(o, 'capa'), CLOAKS.map(c => c.name)), hair = pickIndex(prop(o, 'cabelo'), HAIRS.map(h => h.name));
    if (cloak === null || hair === null) { errors.push(`${where} ("${o.name}"): cor desconhecida. Capas: ${CLOAKS.map(c => c.name).join(', ')}. Cabelos: ${HAIRS.map(h => h.name).join(', ')} (ou o número, a partir de 0)`); continue; }
    const dir = ({ baixo: 0, cima: 1, esquerda: 2, direita: 3 } as Record<string, Dir>)[slug(String(prop(o, 'olha') ?? 'baixo'))];
    if (dir === undefined) { errors.push(`${where} ("${o.name}"): "olha" precisa ser baixo, cima, esquerda ou direita`); continue; }
    const shop = prop(o, 'loja');
    if (shop !== undefined && (typeof shop !== 'string' || !/^[a-z0-9-]+$/.test(shop.trim()))) { errors.push(`${where} ("${o.name}"): "loja" precisa ser o id de uma loja do config (letras minúsculas sem acento, números e hífen)`); continue; }
    npcs.push({ x: tx, y: ty, name: o.name.trim(), pages: pagesOf(text), look: { cloak, hair }, dir, ...(typeof shop === 'string' && shop.trim() ? { shop: shop.trim() } : {}) });
  }

  /* ---------- ponto de partida ---------- */
  const start = (layer('pontos')?.objects ?? []).find(o => norm(o.name ?? '') === 'partida');
  if (!start) errors.push('falta o ponto "partida" na camada "pontos" (onde os jogadores nascem)');
  else if (SOLID.has(tileAt(start.x, start.y) ?? 'T')) errors.push(`o ponto "partida" está em cima de algo sólido (x=${Math.floor(start.x / TS)}, y=${Math.floor(start.y / TS)})`);

  if (errors.length) throw new MapError(`${name}: o mapa tem problemas:\n` + errors.map(e => '  • ' + e).join('\n'));
  const title = prop(m, 'nome'), dark = prop(m, 'escuro') === true || prop(m, 'escuro') === 'true';
  return {
    map: { name: typeof title === 'string' ? title : name, cols: W, rows: H, spawn: { x: Math.round(start!.x), y: Math.round(start!.y) }, ...(dark ? { dark: true } : {}), points, portals, chests, npcs, regions, tiles: rows.map(r => r.join('')), enemies, signs },
    warnings
  };
}

// Recursos do Tiled que tutoriais ensinam mas o jogo não usa: avisa, para ninguém estranhar que "não apareceu no jogo".
function ignored(m: TMap, ts: TTileset | null, warnings: string[]) {
  const visit = (layers: TLayer[], prefix = '') => {
    for (const l of layers) {
      const n = norm(l.name);
      if (l.type === 'group') { warnings.push(`grupo de camadas "${l.name}": o jogo lê as camadas pelo nome, fora de grupos. Tire as camadas de dentro dele.`); continue; }
      if (l.type === 'imagelayer') { warnings.push(`camada de imagem "${prefix}${l.name}" é ignorada pelo jogo.`); continue; }
      if (l.type === 'tilelayer' && n !== 'terreno') warnings.push(`camada de tiles "${prefix}${l.name}" é ignorada: o jogo só lê a camada "terreno" (um tile por quadrado).`);
      if (l.type === 'objectgroup' && !KNOWN_LAYERS.includes(n)) warnings.push(`camada de objetos "${prefix}${l.name}" é ignorada (colisão desenhada também: no jogo, o que é sólido depende do tile). Camadas que o jogo lê: ${KNOWN_LAYERS.join(', ')}.`);
    }
  };
  visit(m.layers);
  if (m.tilesets.length > 1) warnings.push(`o mapa usa ${m.tilesets.length} tilesets; o jogo só conhece o "vale.tsj". Tiles de outros tilesets não vão funcionar.`);
  const ground = m.layers.find(l => norm(l.name) === 'terreno');
  const flipped = Array.isArray(ground?.data) ? ground.data.filter(g => g > FLIP_BITS).length : 0;
  if (flipped) warnings.push(`${flipped} tile(s) espelhado(s) ou girado(s): no jogo eles aparecem na posição normal.`);
  if (ts?.tiles?.some(t => t.objectgroup)) warnings.push('o tileset tem colisão desenhada em algum tile: o jogo ignora (o que é sólido depende do tipo do tile).');
  if (ts?.tiles?.some(t => t.animation)) warnings.push('o tileset tem tiles animados: o jogo ignora (a água já é animada pelo próprio jogo).');
}

// "gold:10-20, heart:2, shell:1@50%" → lista de drops. Devolve a mensagem de erro (string) se algo não fizer sentido.
const LOOT_NAMES: Record<string, LootId> = { ouro: 'gold', coracao: 'heart', pocao: 'mana', geleia: 'jelly', carapaca: 'shell' };
export function parseLoot(raw: unknown): DropRule[] | string {
  if (typeof raw !== 'string' || !raw.trim()) return 'falta a propriedade "conteudo" (ex.: gold:10-20, heart:2, mana:1@50%)';
  const out: DropRule[] = [];
  for (const part of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    const m = part.match(/^([a-zçã]+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*%)?$/i);
    if (!m) return `não entendi "${part}" no conteúdo (formato: item:quantidade, item:mín-máx ou item:quantidade@chance%)`;
    const key = slug(m[1]).replace(/-/g, ''), item = (LOOT_IDS as string[]).includes(key) ? key as LootId : LOOT_NAMES[key];
    if (!item) return `item "${m[1]}" não existe (itens: ${LOOT_IDS.join(', ')})`;
    const min = Number(m[2]), max = m[3] ? Number(m[3]) : min, chance = m[4] ? Number(m[4].replace(',', '.')) / 100 : 1;
    if (min < 1 || max < min) return `quantidade de "${part}" precisa ser 1 ou mais (e o mínimo antes do máximo)`;
    if (chance <= 0 || chance > 1) return `chance de "${part}" precisa ficar entre 0% e 100%`;
    out.push({ item, min, max, chance });
  }
  return out;
}
export function parseDuration(raw: unknown): number | null {
  if (typeof raw === 'number') return raw;
  const m = typeof raw === 'string' ? raw.trim().match(/^(\d+(?:\.\d+)?)\s*(s|m|h)$/) : null;
  return m ? Number(m[1]) * { s: 1, m: 60, h: 3600 }[m[2] as 's' | 'm' | 'h'] : null;
}

// Texto de placa ou NPC: linha em branco começa outra página.
const pagesOf = (text: string) => text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
// Cor por número (0, 1…) ou pelo nome ("Carmim", "ruivo"); vazio = a primeira. null = não existe.
function pickIndex(raw: unknown, names: readonly string[]): number | null {
  if (raw === undefined || raw === '') return 0;
  const n = Number(raw);
  if (Number.isInteger(n)) return n >= 0 && n < names.length ? n : null;
  const i = names.findIndex(x => slug(x) === slug(String(raw)));
  return i >= 0 ? i : null;
}

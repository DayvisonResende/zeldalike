import { isMap, isScalar, parseDocument, type Pair, type YAMLMap } from 'yaml';
import type { MapData } from '@vale/shared';
import type { Config } from '../config/schema';

/* Onde um item aparece: lojas e drops de monstros (no config.yaml, que a Oficina edita) e baús (nos mapas, só leitura). */
export const ENEMY_NAME: Record<string, string> = { slime: 'Geleca', beetle: 'Besouro', bat: 'Morcego', chicken: 'Galinha', king: 'Rei Geleca' };
export interface ShopUse { id: string; npc: string | null; buy?: number; sell?: number }   // buy: a loja vende por; sell: a loja paga
export interface DropUse { enemy: string; name: string; chance?: number; min?: number; max?: number }
export interface ChestUse { map: string; x: number; y: number; chance: number; min: number; max: number }
export interface ItemUses { shops: ShopUse[]; drops: DropUse[]; chests: ChestUse[] }
// O que a Oficina manda gravar: por loja, os preços (null = tira da loja); por monstro, o drop (null = não cai).
export interface UsesRequest {
  shops: Record<string, { buy: number | null; sell: number | null }>;
  drops: Record<string, { chance: number; min: number; max: number } | null>;
}

export function usesOf(cfg: Config, maps: Record<string, MapData>, id: string): ItemUses {
  const npcOf = (shop: string) => Object.values(maps).flatMap(m => m.npcs ?? []).find(n => n.shop === shop)?.name ?? null;
  const shops = Object.entries(cfg.shops).map(([s, r]) => ({ id: s, npc: npcOf(s), buy: r.buy[id], sell: r.sell[id] }));
  const drops = Object.entries(cfg.enemies).map(([e, r]) => {
    const d = r.drops[id];
    return { enemy: e, name: ENEMY_NAME[e] ?? e, ...(d === undefined ? {} : typeof d === 'number' ? { chance: d, min: 1, max: 1 } : d) };
  });
  const chests = Object.entries(maps).flatMap(([m, data]) => (data.chests ?? []).flatMap(c => c.loot.filter(l => l.item === id).map(l => ({ map: m, x: c.x, y: c.y, chance: l.chance, min: l.min, max: l.max }))));
  return { shops, drops, chests };
}

// Confere o pedido. Devolve os erros em português (vazio = pode gravar).
export function checkUses(cfg: Config, req: UsesRequest): string[] {
  const errors: string[] = [], int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  for (const [s, p] of Object.entries(req.shops ?? {})) {
    if (!cfg.shops[s]) { errors.push(`loja "${s}" não existe no config.yaml`); continue; }
    if (p.buy !== null && !int(p.buy, 1, 99999)) errors.push(`${s}: preço de venda de 1 a 99999 de ouro`);
    if (p.sell !== null && !int(p.sell, 1, 99999)) errors.push(`${s}: o quanto a loja paga, de 1 a 99999 de ouro`);
  }
  for (const [e, d] of Object.entries(req.drops ?? {})) {
    const who = ENEMY_NAME[e] ?? e;
    if (!cfg.enemies[e as keyof Config['enemies']]) { errors.push(`monstro "${e}" não existe`); continue; }
    if (d === null) continue;
    if (!(typeof d.chance === 'number' && d.chance > 0 && d.chance <= 1)) errors.push(`${who}: chance de 1% a 100%`);
    if (!int(d.min, 1, 99) || !int(d.max, 1, 99) || d.min > d.max) errors.push(`${who}: quantidade de 1 a 99, com o mínimo até o máximo`);
  }
  return errors;
}

// Aplica no texto do config.yaml mexendo só nas linhas do item: o resto do arquivo (comentários, alinhamento, formatação)
// fica exatamente como estava.
export function applyUses(text: string, id: string, req: UsesRequest): string {
  for (const [s, p] of Object.entries(req.shops ?? {})) {
    text = setYaml(text, ['shops', s, 'buy', id], p.buy === null ? null : String(p.buy));
    text = setYaml(text, ['shops', s, 'sell', id], p.sell === null ? null : String(p.sell));
  }
  // 1 unidade: só a chance ("heart: 0.2"), como o resto do arquivo; senão { chance, min, max } numa linha
  for (const [e, d] of Object.entries(req.drops ?? {}))
    text = setYaml(text, ['enemies', e, 'drops', id], d === null ? null : d.min === 1 && d.max === 1 ? String(d.chance) : `{ chance: ${d.chance}, min: ${d.min}, max: ${d.max} }`);
  return text;
}

/* ---------- Edição cirúrgica de YAML ---------- */
type Range = [number, number, number];
const lineStart = (t: string, pos: number) => t.lastIndexOf('\n', pos - 1) + 1;
const lineEnd = (t: string, pos: number) => { const i = t.indexOf('\n', pos); return i < 0 ? t.length : i + 1; };
const indentAt = (t: string, pos: number) => pos - lineStart(t, pos);
const keyOf = (p: Pair) => String(isScalar(p.key) ? p.key.value : p.key);

// Põe `value` (texto YAML de uma linha) no caminho, ou tira a chave (null). Cria os mapas que faltarem no caminho.
export function setYaml(text: string, path: string[], value: string | null): string {
  const doc = parseDocument(text);
  const mapAt = (p: string[]) => { const n = p.length ? doc.getIn(p, true) : doc.contents; return isMap(n) ? n as YAMLMap : null; };
  const parent = mapAt(path.slice(0, -1)), last = path[path.length - 1];
  const pair = parent?.items.find(i => keyOf(i as Pair) === last) as Pair | undefined;
  if (pair) {
    const kr = (pair.key as { range: Range }).range, vr = (pair.value as { range?: Range } | null)?.range;
    if (value !== null) return vr ? text.slice(0, vr[0]) + value + text.slice(vr[1]) : text.slice(0, kr[1] + 1) + ' ' + value + text.slice(kr[1] + 1);
    // tirar: a linha (ou as linhas) da chave some; se o mapa ficar vazio, ele vira {}
    const from = lineStart(text, kr[0]), to = lineEnd(text, Math.max(kr[0], (vr ? vr[1] : kr[1]) - 1));
    let out = text.slice(0, from) + text.slice(to);
    if (parent!.items.length === 1 && path.length > 1) {
      const owner = mapAt(path.slice(0, -2))!.items.find(i => keyOf(i as Pair) === path[path.length - 2]) as Pair;
      const ok = (owner.key as { range: Range }).range[1];
      out = out.slice(0, ok) + ': {}' + out.slice(ok + 1);
    }
    return out;
  }
  if (value === null) return text;   // não estava lá
  // a chave não existe: acha o mapa mais fundo que existe no caminho e escreve o que falta embaixo dele
  let k = path.length - 1;
  while (k > 0 && !mapAt(path.slice(0, k))) k--;
  const host = mapAt(path.slice(0, k))!, rest = path.slice(k);
  const lines = (indent: number) => rest.map((key, j) => ' '.repeat(indent + 2 * j) + key + ':' + (j === rest.length - 1 ? ' ' + value : '') + '\n').join('');
  const hr = (host as unknown as { range: Range }).range;
  if (host.flow) {
    if (host.items.length) throw new Error(`não sei escrever dentro de ${path.slice(0, k).join('.')} (mapa numa linha só); edite o config.yaml à mão`);
    const indent = indentAt(text, lineStart(text, hr[0]) + (text.slice(lineStart(text, hr[0])).match(/^ */)![0].length)) + 2;
    const end = lineEnd(text, hr[0]);
    return text.slice(0, hr[0]).replace(/[ \t]+$/, '') + text.slice(hr[1], end).replace(/\n$/, '') + '\n' + lines(indent) + text.slice(end);
  }
  const items = host.items as Pair[], lastItem = items[items.length - 1];
  const indent = indentAt(text, (items[0].key as { range: Range }).range[0]);
  const lastEnd = (lastItem.value as { range?: Range } | null)?.range?.[1] ?? (lastItem.key as { range: Range }).range[1];
  const at = lineEnd(text, lastEnd - 1);
  return text.slice(0, at) + (at === text.length && !text.endsWith('\n') ? '\n' : '') + lines(indent) + text.slice(at);
}

import fs from 'node:fs';
import path from 'node:path';
import { GEAR, REQUIRED_ITEMS, setItems, type ItemCatalogMsg, type ItemDef } from '@vale/shared';
import { z } from 'zod';
import { statBonus } from '../config/schema';

export const ITEMS_DIR = path.resolve(import.meta.dirname, '../../../../content/items');
export class ItemsError extends Error { }

// Um item: <id>.json com os dados e <id>.png (16×16) com o ícone. O id é o nome do arquivo e nunca muda
// (inventários e o banco guardam o id); o nome pode mudar à vontade.
export const itemSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
  desc: z.string().max(300).default(''),
  heal: z.number().int().min(1).max(1000).optional(),   // comer/usar recupera vida
  mana: z.number().int().min(1).max(1000).optional(),   // ...ou mana
  gear: z.strictObject({                                // equipa no botão A ou C
    like: z.enum(GEAR),                                 // comporta-se como: sword, bow, firestaff, lightstaff ou darktome
    damage: z.number().int().min(1).max(999).optional(),   // dano próprio (só espada e arco); sem ele, o da arma de base
    stats: statBonus.optional(),                        // atributos que dá enquanto estiver no A ou no C
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'cor como #a1b2c3').optional()   // lâmina, pedra do cajado ou madeira do arco
  }).refine(g => !g.damage || g.like === 'sword' || g.like === 'bow', { message: 'dano próprio só vale para espada e arco (cajados usam os números de magic)', path: ['damage'] }).optional()
});
export const ID = /^[a-z0-9-]+$/;
// Catálogo que vai para o cliente: os dados e o ícone (PNG em data URL, ~200 bytes cada).
export type ItemCatalog = ItemCatalogMsg;

// Tamanho de um PNG pelo cabeçalho (sem abrir a imagem).
export function pngSize(buf: Buffer) {
  const sig = buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && buf.subarray(12, 16).toString() === 'IHDR';
  return sig ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : null;
}

// Lê e valida a pasta inteira. Qualquer erro impede tudo (melhor do que meio catálogo), com a lista do que corrigir.
export function loadItems(dir = ITEMS_DIR): ItemCatalog {
  let files: string[];
  try { files = fs.readdirSync(dir); }
  catch (e) { throw new ItemsError(`não consegui ler a pasta de itens (${dir}): ${(e as Error).message}`); }
  const errors: string[] = [], out: ItemCatalog = {};
  for (const f of files.filter(f => f.endsWith('.json')).sort()) {
    const id = f.slice(0, -5);
    if (!ID.test(id)) { errors.push(`${f}: o nome do arquivo é o id do item: só letras minúsculas sem acento, números e hífen`); continue; }
    let raw: unknown;
    try { raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
    catch (e) { errors.push(`${f}: JSON inválido: ${(e as Error).message}`); continue; }
    const r = itemSchema.safeParse(raw);
    if (!r.success) { for (const i of r.error.issues) errors.push(`${f}: ${i.path.join('.') || '(item)'}: ${i.message}`); continue; }
    let png: Buffer;
    try { png = fs.readFileSync(path.join(dir, id + '.png')); }
    catch { errors.push(`${f}: falta o ícone ${id}.png (16×16) ao lado`); continue; }
    const size = pngSize(png);
    if (!size) { errors.push(`${id}.png: não é um PNG`); continue; }
    if (size.w !== 16 || size.h !== 16) { errors.push(`${id}.png: o ícone precisa ter 16×16 (tem ${size.w}×${size.h})`); continue; }
    out[id] = { ...r.data, icon: 'data:image/png;base64,' + png.toString('base64') };
  }
  const missing = REQUIRED_ITEMS.filter(id => !out[id] && !errors.some(e => e.startsWith(id + '.')));
  if (missing.length) errors.push(`faltam itens que o jogo usa: ${missing.join(', ')}`);
  if (errors.length) throw new ItemsError('itens com problema (content/items/):\n' + errors.map(e => '  • ' + e).join('\n'));
  return out;
}
// Só os dados (sem o ícone), para o registro do jogo.
export const itemDefs = (c: ItemCatalog): Record<string, ItemDef> => Object.fromEntries(Object.entries(c).map(([id, { icon: _, ...d }]) => [id, d]));

// Recarrega quando algo na pasta muda (salvar um .json, trocar um .png). Espera a pasta parar de mudar.
export function watchItems(dir: string, onChange: (c: ItemCatalog) => void, onError: (e: Error) => void) {
  let timer: NodeJS.Timeout | undefined;
  return fs.watch(dir, () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { onChange(loadItems(dir)); } catch (e) { onError(e as Error); } }, 200);
  });
}

// O catálogo em uso. Trocar o catálogo troca o registro do jogo e avisa quem estiver ouvindo (a sala manda aos clientes).
let catalog: ItemCatalog = {};
const subs = new Set<() => void>();
export function setCatalog(c: ItemCatalog) { catalog = c; setItems(itemDefs(c)); for (const f of subs) f(); }
export const getCatalog = () => catalog;
export function onCatalog(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }

/* ---------- Gravar (Oficina) ---------- */
// Grava um item: confere os dados e o ícone antes de tocar nos arquivos. O watcher recarrega a pasta em seguida.
// `icon`: o PNG novo (obrigatório num item novo; sem ele, fica o que já existe). Devolve a lista de erros (vazia = gravou).
export function saveItem(dir: string, id: string, data: unknown, icon: Buffer | null, create: boolean): string[] {
  if (!ID.test(id) || id.length > 40) return ['id: só letras minúsculas sem acento, números e hífen (até 40)'];
  const exists = fs.existsSync(path.join(dir, id + '.json'));
  if (create && exists) return [`já existe um item com o id "${id}"`];
  if (!create && !exists) return [`o item "${id}" não existe`];
  const r = itemSchema.safeParse(data);
  const errors = r.success ? [] : r.error.issues.map(i => `${i.path.join('.') || 'item'}: ${i.message}`);
  if (icon) { const s = pngSize(icon); if (!s) errors.push('ícone: não é um PNG'); else if (s.w !== 16 || s.h !== 16) errors.push(`ícone: precisa ter 16×16 (tem ${s.w}×${s.h})`); }
  else if (create) errors.push('ícone: escolha um PNG 16×16');
  if (errors.length || !r.success) return errors;
  if (icon) fs.writeFileSync(path.join(dir, id + '.png'), icon);
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(r.data, null, 2) + '\n');
  return [];
}

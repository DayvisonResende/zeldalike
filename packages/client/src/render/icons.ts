import { setItems, type ItemCatalogMsg, type ItemDef } from '@vale/shared';
import { GOLD_ICON, KEY_ICON, mk } from './sprites';

/* Ícones dos itens: PNGs 16×16 de content/items/. Online vêm do servidor (com os itens novos da Oficina);
   offline e até a lista chegar, valem os que vieram embutidos no jogo. A borda transparente é cortada:
   cada ícone fica do tamanho do desenho (os de hoje, 10×9). */
const icons = new Map<string, HTMLCanvasElement>();
const EMPTY = mk(1, 1);
let version = 0, applied = '';

function trimmed(img: HTMLImageElement) {
  const c = mk(img.width, img.height), x = c.getContext('2d')!;
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (d[(j * c.width + i) * 4 + 3]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  if (x1 < 0) return EMPTY;
  const out = mk(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d')!.drawImage(c, -x0, -y0);
  return out;
}
// Troca o catálogo: o registro de itens do jogo e os ícones (cada um aparece assim que a imagem carrega).
export function setCatalog(c: ItemCatalogMsg) {
  const key = JSON.stringify(c); if (key === applied) return;
  applied = key;
  setItems(Object.fromEntries(Object.entries(c).map(([id, { icon: _, ...d }]) => [id, d as ItemDef])));
  for (const id of [...icons.keys()]) if (!c[id]) icons.delete(id);
  for (const [id, { icon }] of Object.entries(c)) {
    const img = new Image();
    img.onload = () => { icons.set(id, trimmed(img)); version++; };
    img.src = icon;
  }
  version++;
}
export const itemIcon = (id: string) => id === 'gold' ? GOLD_ICON : id === 'key' ? KEY_ICON : icons.get(id) ?? EMPTY;
export const iconsVersion = () => version;   // muda quando um ícone carrega (para redesenhar painéis)

// Os itens que vieram no pacote do jogo.
const jsons = import.meta.glob<ItemDef>('../../../../content/items/*.json', { eager: true, import: 'default' });
const pngs = import.meta.glob<string>('../../../../content/items/*.png', { eager: true, query: '?inline', import: 'default' });
const idOf = (f: string) => f.slice(f.lastIndexOf('/') + 1, f.lastIndexOf('.'));
setCatalog(Object.fromEntries(Object.entries(jsons).map(([f, d]) => [idOf(f), { ...d, icon: pngs[f.replace(/\.json$/, '.png')] ?? '' }])));

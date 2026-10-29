import type { PlayerView, Profile, WorldMap } from '@vale/shared';
import { PX, dot, label, mapImage, meArrow, pin, seenAt } from '../render/mapimage';
import type { MapState } from '../session/types';

export interface WorldMapHooks {
  view(): { map: WorldMap; me: PlayerView | undefined; state: MapState; profiles: ReadonlyMap<string, Profile>; meId: string; party: ReadonlySet<string> } | null;
  mark(x: number, y: number): void; clearMark(): void; closed(): void;
}
type Ctx = CanvasRenderingContext2D;

// Desenha o mapa (já com a névoa) e o que importa por cima, em pixels do mapa (1 tile = PX).
function drawOverlay(x: Ctx, v: NonNullable<ReturnType<WorldMapHooks['view']>>, tick: number) {
  const { map, me, state, profiles, meId, party } = v, s = PX / 16;   // de pixels do mundo para pixels do mapa
  for (const r of map.data.regions) {
    const cx = (r.x + r.w / 2) * PX, cy = (r.y + r.h / 2) * PX, seen = seenAt(map, state, (r.x + r.w / 2) * 16, (r.y + r.h / 2) * 16);
    if (state.safe.includes(r.id) && seen) {
      x.strokeStyle = 'rgba(120,230,140,.9)'; x.lineWidth = 2; x.setLineDash([4, 3]); x.strokeRect(r.x * PX + 1, r.y * PX + 1, r.w * PX - 2, r.h * PX - 2); x.setLineDash([]);
    }
    if (seen && map.data.regions.length > 1) label(x, r.name, cx, cy, 11, state.safe.includes(r.id) ? '#bff5c8' : '#f6f2fc');
  }
  for (const p of map.data.portals ?? []) if (seenAt(map, state, p.x + p.w / 2, p.y + p.h / 2)) {
    const cx = (p.x + p.w / 2) * s, cy = (p.y + p.h / 2) * s;
    x.strokeStyle = '#1b1226'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, 4, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = '#c79bf0'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 4, 0, Math.PI * 2); x.stroke();
  }
  for (const c of map.data.chests ?? []) if (seenAt(map, state, c.x * 16 + 8, c.y * 16 + 8)) {
    x.fillStyle = '#1b1226'; x.fillRect(c.x * PX + 1, c.y * PX + 2, PX - 2, PX - 3); x.fillStyle = '#e9b44c'; x.fillRect(c.x * PX + 2, c.y * PX + 3, PX - 4, PX - 5);
  }
  for (const n of map.data.npcs ?? []) if (seenAt(map, state, n.x * 16 + 8, n.y * 16 + 8)) {
    if (n.shop) { dot(x, n.x * PX + PX / 2, n.y * PX + PX / 2, 3, '#ffd94f'); label(x, '$', n.x * PX + PX / 2, n.y * PX + PX / 2 + 0.5, 8, '#1b1226'); }
    else dot(x, n.x * PX + PX / 2, n.y * PX + PX / 2, 2, '#f6f2fc');
  }
  for (const o of state.roster) {   // do seu grupo: em verde
    const mine = party.has(o.id);
    dot(x, o.x * PX + PX / 2, o.y * PX + PX / 2, mine ? 3 : 2.5, mine ? '#7be08a' : '#7ac8ff');
    const name = profiles.get(o.id)?.name; if (name) label(x, name, o.x * PX + PX / 2, o.y * PX - 4, 8, mine ? '#c8f5b8' : '#cfe8ff');
  }
  for (const k of state.marks) { pin(x, k.x * s, k.y * s, 1.1); label(x, k.id === meId ? 'Você marcou' : k.name, k.x * s, k.y * s - 16, 8, '#ffd1cc'); }
  if (me) meArrow(x, me.x * s, me.y * s, me.dir, (tick >> 4) & 1 ? 1.2 : 1);   // pulsa para achar você rápido
}

/* Mapa do mundo em tela cheia (M): o que você já explorou, regiões, lojas, portais, baús, zonas seguras,
   quem está no mapa e os marcadores. Tocar ou clicar põe o seu marcador "venham aqui!". */
export class WorldMapPanel {
  private el = document.getElementById('worldmap')!;
  private cv = document.getElementById('mapCanvas') as HTMLCanvasElement;
  private ctx = this.cv.getContext('2d')!;
  constructor(private hooks: WorldMapHooks) {
    document.getElementById('mapClose')!.addEventListener('click', () => this.close());
    document.getElementById('markHere')!.addEventListener('click', () => { const v = hooks.view(); if (v?.me) hooks.mark(v.me.x, v.me.y); });
    document.getElementById('markClear')!.addEventListener('click', () => hooks.clearMark());
    this.el.addEventListener('pointerdown', e => { if (e.target === this.el) this.close(); });
    this.cv.addEventListener('pointerdown', e => {
      const v = hooks.view(); if (!v) return;
      const b = this.cv.getBoundingClientRect();
      hooks.mark((e.clientX - b.left) / b.width * v.map.width, (e.clientY - b.top) / b.height * v.map.height);
    });
  }
  get open() { return !this.el.hidden; }
  toggle() { if (this.open) this.close(); else { this.el.hidden = false; (document.getElementById('markHere') as HTMLButtonElement).focus(); } }
  close() { if (!this.open) return; this.el.hidden = true; this.hooks.closed(); }
  render(tick: number) {
    if (!this.open) return;
    const v = this.hooks.view(); if (!v) return;
    const img = mapImage(v.map, v.state);
    if (this.cv.width !== img.width || this.cv.height !== img.height) { this.cv.width = img.width; this.cv.height = img.height; }
    document.getElementById('mapTitle')!.textContent = v.map.data.name;
    this.ctx.drawImage(img, 0, 0);
    drawOverlay(this.ctx, v, tick);
    (document.getElementById('markClear') as HTMLButtonElement).disabled = !v.state.marks.some(k => k.id === v.meId);
  }
}

/* Minimapa no canto: um pedaço do mapa em volta de você, com quem está perto e os marcadores. Tocar abre o mapa. */
const VIEW_W = 24, VIEW_H = 18;   // tiles
export class Minimap {
  private cv = document.getElementById('minimap') as HTMLCanvasElement;
  private ctx = this.cv.getContext('2d')!;
  constructor(onOpen: () => void) {
    this.cv.width = VIEW_W * 4; this.cv.height = VIEW_H * 4;
    this.cv.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); onOpen(); });
  }
  render(v: ReturnType<WorldMapHooks['view']>, show: boolean, tick: number) {
    this.cv.hidden = !show || !v?.me;
    if (this.cv.hidden || !v?.me) return;
    const { map, me, state } = v, x = this.ctx, k = 4 / PX;   // 4 px por tile
    const img = mapImage(map, state);
    const sx = me.x / 16 * PX - VIEW_W * PX / 2, sy = me.y / 16 * PX - VIEW_H * PX / 2;
    x.fillStyle = '#0e0c22'; x.fillRect(0, 0, this.cv.width, this.cv.height);
    x.drawImage(img, sx, sy, VIEW_W * PX, VIEW_H * PX, 0, 0, this.cv.width, this.cv.height);
    const at = (px: number, py: number): [number, number] => [(px / 16 * PX - sx) * k, (py / 16 * PX - sy) * k];
    for (const o of state.roster) { const [ox, oy] = at(o.x * 16 + 8, o.y * 16 + 8); if (ox >= 0 && oy >= 0 && ox < this.cv.width && oy < this.cv.height) dot(x, ox, oy, 1.5, v.party.has(o.id) ? '#7be08a' : '#7ac8ff'); }
    for (const m of state.marks) {
      const [mx, my] = at(m.x, m.y);
      pin(x, Math.max(4, Math.min(this.cv.width - 4, mx)), Math.max(9, Math.min(this.cv.height - 1, my)), 0.6);
    }
    meArrow(x, this.cv.width / 2, this.cv.height / 2, me.dir, (tick >> 4) & 1 ? 0.7 : 0.6);
  }
}

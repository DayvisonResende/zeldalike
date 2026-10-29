import { TS, VIEW_H, VIEW_W } from '@vale/shared';
import type { Camera } from '../camera';
import type { Scene } from '../session/types';
import type { NameMode } from './settings';

// Nomes e balões de fala sobre a cabeça, em HTML por cima do canvas: nítidos em qualquer tamanho de tela.
export class NameTags {
  private tags = new Map<string, HTMLElement>();
  private bubbles = new Map<string, { el: HTMLElement; until: number }>();
  constructor(private layer: HTMLElement) { }

  // Fala de alguém: fica um tempo proporcional ao tamanho do texto.
  say(id: string, text: string) {
    let b = this.bubbles.get(id);
    if (!b) { b = { el: document.createElement('span'), until: 0 }; b.el.className = 'bubble'; this.layer.append(b.el); this.bubbles.set(id, b); }
    b.el.textContent = text;
    b.until = performance.now() + Math.min(10000, 4000 + text.length * 60);
  }

  update(scene: Scene, cam: Camera, mode: NameMode, showBubbles: boolean, party: ReadonlySet<string> = new Set()) {
    const seen = new Set<string>(), now = performance.now();
    for (const [id, b] of this.bubbles) if (now > b.until || !showBubbles) { b.el.remove(); this.bubbles.delete(id); }
    for (const p of scene.players) {
      const x = p.x - cam.x, y = p.y - p.z - (p.carry ? 31 : p.state === 'dead' ? 12 : 19) - cam.y;
      const b = this.bubbles.get(p.id), visible = x >= -40 && x <= VIEW_W + 40 && y >= -10 && y <= VIEW_H + 10;
      if (b) { b.el.hidden = !visible; b.el.style.left = (x / VIEW_W * 100) + '%'; b.el.style.top = (y / VIEW_H * 100) + '%'; b.el.classList.toggle('noname', mode === 'none' || (mode === 'others' && p.id === scene.meId)); }
      const mine = p.id === scene.meId;
      if (mode === 'none' || (mode === 'others' && mine) || !visible) continue;
      const base = scene.profiles.get(p.id)?.name; if (!base) continue;
      const name = `${base} · Nv ${p.level}`;
      let el = this.tags.get(p.id);
      if (!el) { el = document.createElement('span'); el.className = 'nametag'; this.layer.append(el); this.tags.set(p.id, el); }
      if (el.textContent !== name) el.textContent = name;
      el.classList.toggle('me', mine);
      el.classList.toggle('pvp', p.pvpActive);
      el.classList.toggle('party', !mine && party.has(p.id));
      el.style.left = (x / VIEW_W * 100) + '%'; el.style.top = (y / VIEW_H * 100) + '%';
      seen.add(p.id);
    }
    // NPCs: nome em outra cor, sem nível
    if (mode !== 'none') for (const n of scene.npcs) {
      const x = n.x * TS + 8 - cam.x, y = n.y * TS + 12 - 19 - cam.y, key = `npc:${n.x},${n.y}`;
      if (x < -40 || x > VIEW_W + 40 || y < -10 || y > VIEW_H + 10) continue;
      let el = this.tags.get(key);
      if (!el) { el = document.createElement('span'); el.className = 'nametag npc'; el.textContent = n.name; this.layer.append(el); this.tags.set(key, el); }
      el.style.left = (x / VIEW_W * 100) + '%'; el.style.top = (y / VIEW_H * 100) + '%';
      seen.add(key);
    }
    for (const [id, el] of this.tags) if (!seen.has(id)) { el.remove(); this.tags.delete(id); }
  }
}

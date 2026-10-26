import { VIEW_H, VIEW_W } from '@vale/shared';
import type { Camera } from '../camera';

// Textos que sobem de um ponto do mundo e somem (+5 XP, +1 Coração, Nível 3!). Seguem a câmera enquanto vivem.
export class Floaters {
  private list: { el: HTMLElement; x: number; y: number; until: number }[] = [];
  constructor(private layer: HTMLElement) { }
  add(x: number, y: number, text: string, kind: 'xp' | 'item' | 'level' | 'notice') {
    const el = document.createElement('span');
    el.className = 'floater ' + kind; el.textContent = text;
    // vários ao mesmo tempo no mesmo lugar: empilha para não sobrepor
    const stacked = this.list.filter(f => Math.abs(f.x - x) < 12 && Math.abs(f.y - y) < 12).length;
    this.layer.append(el);
    this.list.push({ el, x, y: y - stacked * 7, until: performance.now() + (kind === 'level' ? 2400 : 1400) });
  }
  update(cam: Camera) {
    const now = performance.now();
    this.list = this.list.filter(f => {
      if (now > f.until) { f.el.remove(); return false; }
      f.el.style.left = ((f.x - cam.x) / VIEW_W * 100) + '%';
      f.el.style.top = ((f.y - 22 - cam.y) / VIEW_H * 100) + '%';
      return true;
    });
  }
}

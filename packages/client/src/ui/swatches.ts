import { CLOAKS, HAIRS, type Look } from '@vale/shared';
import { heroSprite } from '../render/sprites';

// Amostras de cor de capa e cabelo (radio), usadas no menu e na criação de personagem.
export function buildSwatches(box: HTMLElement, key: keyof Look, onPick: (i: number) => void) {
  const list = key === 'cloak' ? CLOAKS : HAIRS;
  list.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.style.setProperty('--c', c.base); b.title = c.name;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-label', c.name); b.dataset.key = key; b.dataset.i = String(i);
    b.addEventListener('click', () => onPick(i));
    box.append(b);
  });
}
export function markSwatches(root: HTMLElement, look: Look) {
  root.querySelectorAll<HTMLButtonElement>('.swatch').forEach(b => b.setAttribute('aria-checked', String(look[b.dataset.key as keyof Look] === Number(b.dataset.i))));
}
// Desenha o personagem num canvas pequeno (prévia).
export function drawPreview(cv: HTMLCanvasElement, look: Look, dir: 0 | 1 | 2 | 3 = 0, step = 0) {
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(heroSprite(dir, step, 'n', look.cloak, look.hair), 0, 0);
}

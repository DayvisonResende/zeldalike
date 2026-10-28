/* Cena de título atrás das telas de conta: o mundo do jogo só aparece quando o personagem entra.
   Pixel art desenhado aqui mesmo: céu estrelado, lua, montanhas, a mata em camadas andando devagar, névoa e vagalumes. */
const W = 320, H = 180;
const el = document.getElementById('titlebg')!;
const cv = el.querySelector('canvas')!;
const ctx = cv.getContext('2d')!;
cv.width = W; cv.height = H;

// pseudo-aleatório com semente: a cena é sempre a mesma
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const r = rng(7);
const stars = Array.from({ length: 70 }, () => ({ x: (r() * W) | 0, y: (r() * 96) | 0, p: r() * 6.28, big: r() < 0.15 }));
const flies = Array.from({ length: 12 }, () => ({ x: r() * W, y: 120 + r() * 50, p: r() * 6.28, s: 0.4 + r() * 0.6 }));
// silhuetas: altura de cada coluna, repetidas lado a lado para poderem andar sem emenda
function ridge(seed: number, base: number, amp: number, rough: number) {
  const g = rng(seed), out: number[] = [];
  let h = base;
  for (let x = 0; x < W; x++) { h += (g() - 0.5) * rough; h += (base - h) * 0.04; out.push(Math.round(Math.max(base - amp, Math.min(base + amp, h)))); }
  return out;
}
function pines(seed: number, base: number, size: number, gap: number) {
  const g = rng(seed), out = new Array<number>(W).fill(H);
  for (let x = 0; x < W; x += gap + ((g() * gap) | 0)) {
    const s = Math.round(size * (0.7 + g() * 0.6));   // inteiro: a coluna do pinheiro precisa ser um índice de verdade
    for (let i = -s; i <= s; i++) { const cx = (x + i + W) % W, top = base - Math.round((s - Math.abs(i)) * 2.1); out[cx] = Math.min(out[cx], top); }
  }
  return out.map(v => Math.min(v, base + 2));
}
const far = ridge(3, 100, 18, 3), hills = ridge(11, 124, 8, 2), backTrees = pines(21, 140, 9, 6), frontTrees = pines(37, 168, 13, 9);

function sky() {
  const bands = ['#0b0a1c', '#0e0c22', '#13102c', '#181437', '#1e1942', '#251f4d', '#2c2557'];
  bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, (i * 110 / bands.length) | 0, W, Math.ceil(110 / bands.length) + 1); });
}
function moon() {
  const mx = 256, my = 34, mr = 13;
  ctx.fillStyle = 'rgba(244,239,214,0.08)'; ctx.beginPath(); ctx.arc(mx, my, mr + 9, 0, 6.29); ctx.fill();
  for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) if (x * x + y * y <= mr * mr) {
    ctx.fillStyle = (x - 4) * (x - 4) + (y + 3) * (y + 3) < 10 || (x + 5) * (x + 5) + (y - 5) * (y - 5) < 6 ? '#d9d2b4' : '#f4efd6';
    ctx.fillRect(mx + x, my + y, 1, 1);
  }
}
function layer(cols: number[], shift: number, color: string, rim?: string) {
  const s = Math.floor(shift) % W;
  for (let x = 0; x < W; x++) {
    const top = cols[(x + s) % W];
    ctx.fillStyle = color; ctx.fillRect(x, top, 1, H - top);
    if (rim) { ctx.fillStyle = rim; ctx.fillRect(x, top, 1, 1); }
  }
}
function draw(t: number) {
  sky();
  for (const s of stars) {
    const on = Math.sin(t / 700 + s.p * 3) > -0.6;
    if (!on) continue;
    ctx.fillStyle = Math.sin(t / 500 + s.p) > 0.7 ? '#ffffff' : '#a9a3d6';
    ctx.fillRect(s.x, s.y, 1, 1);
    if (s.big) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(s.x - 1, s.y, 3, 1); ctx.fillRect(s.x, s.y - 1, 1, 3); }
  }
  moon();
  layer(far, t / 900, '#231d47', '#2f2860');
  layer(hills, t / 420, '#1a2e42', '#263f57');
  layer(backTrees, t / 260, '#14382a', '#2a6343');
  // névoa entre as camadas
  for (let i = 0; i < 3; i++) {
    const y = 128 + i * 9, x = ((t / (60 + i * 25)) % (W + 120)) - 120;
    ctx.fillStyle = 'rgba(160,170,210,0.07)'; ctx.fillRect(Math.round(x), y, 120, 3); ctx.fillRect(Math.round(x) + 30, y + 2, 80, 2);
  }
  layer(frontTrees, t / 140, '#0a1d15', '#1f5232');
  ctx.fillStyle = '#060d0a'; ctx.fillRect(0, H - 8, W, 8);
  for (const f of flies) {
    if (Math.sin(t / 380 + f.p * 4) < -0.2) continue;
    const x = Math.round((f.x + Math.sin(t / 1400 * f.s + f.p) * 10 + W) % W), y = Math.round(f.y + Math.cos(t / 1700 + f.p) * 5);
    ctx.fillStyle = 'rgba(246,255,138,0.3)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    ctx.fillStyle = '#f6ff8a'; ctx.fillRect(x, y, 1, 1);
  }
}

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
let raf = 0, last = 0;
function loop(t: number) {
  if (el.hidden) { raf = 0; return; }
  if (t - last > 33) { draw(t); last = t; }   // ~30 quadros por segundo bastam
  raf = requestAnimationFrame(loop);
}
export function showTitle() {
  el.hidden = false; el.classList.remove('out');
  if (still) draw(0); else if (!raf) raf = requestAnimationFrame(loop);
}
// Sai com um fade curto quando o mundo está pronto.
export function hideTitle() {
  if (el.hidden || el.classList.contains('out')) return;
  el.classList.add('out');
  setTimeout(() => { el.hidden = true; }, 450);
}
export const titleShown = () => !el.hidden && !el.classList.contains('out');

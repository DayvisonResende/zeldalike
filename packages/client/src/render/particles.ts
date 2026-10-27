import type { BurstOpts, Palette } from '@vale/shared';

// Partículas são só visuais: vivem no cliente e nunca passam pela rede.
const PAL: Record<Palette, string[]> = {
  leaf: ['#4e9e3c', '#86cc5e', '#2f6e2a'], grass: ['#5d9f3e', '#93d464', '#3f7d2d'], rock: ['#8f929b', '#c6c9d2', '#5e6069'],
  water: ['#d8ecff', '#9fcaf5', '#5b97dd'], dust: ['#efe6d2', '#d9c9a8', '#ffffff'], spark: ['#fff7d6', '#e8e0d0'], splinter: ['#d6e0ef', '#8a5a33'],
  fire: ['#ffd35a', '#f2862e', '#e0452b'], heal: ['#fffbe6', '#b8f5a0', '#9fe7ff'], shadow: ['#c79bf0', '#7f4aa8', '#2d1a44']
};
const POOF = ['#f4f0fb', '#cfc6e0', '#ffffff'];
interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number; life: number; c: string; sz: number; fade?: boolean }
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Particles {
  private parts: Part[] = [];
  burst(x: number, y: number, palette: Palette, n: number, o: BurstOpts) {
    const s = o.s || 1, cols = PAL[palette];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(0.3, 1) * s;
      this.parts.push({ x, y, z: o.z || 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, vz: rnd(0.6, o.up || 1.8), g: 0.12, life: rnd(18, 34) | 0, c: cols[i % cols.length], sz: i % 3 === 0 ? 2 : 1 });
    }
  }
  poof(x: number, y: number) {
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; this.parts.push({ x, y, z: 4, vx: Math.cos(a) * 1.1, vy: Math.sin(a) * 0.8, vz: 0.15, g: 0, life: 22, c: POOF[i % 3], sz: 3, fade: true }); }
  }
  update() {
    for (const q of this.parts) {
      q.x += q.vx; q.y += q.vy;
      if (q.g) { q.vz -= q.g; q.z += q.vz; if (q.z < 0) { q.z = 0; q.vz = -q.vz * 0.3; q.vx *= 0.5; q.vy *= 0.5; } }
      else { q.z += q.vz; q.vx *= 0.9; q.vy *= 0.9; }
      q.life--;
    }
    this.parts = this.parts.filter(q => q.life > 0);
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const q of this.parts) {
      ctx.fillStyle = q.c;
      const sz = q.fade ? (q.life > 14 ? 3 : q.life > 7 ? 2 : 1) : q.sz;
      ctx.fillRect(Math.round(q.x), Math.round(q.y - q.z), sz, sz);
    }
  }
}

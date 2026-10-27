// Canvas mínimo em memória, só com o que a arte do jogo usa (fillRect, drawImage, clearRect, cores sólidas e rgba).
// Permite gerar o tileset no Node com os mesmos desenhos do navegador.
function parseColor(c: string): [number, number, number, number] {
  if (c.startsWith('#')) {
    const h = c.length === 4 ? [...c.slice(1)].map(x => x + x).join('') : c.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error('cor não suportada: ' + c);
  const [r, g, b, a = '1'] = m[1].split(',').map(s => s.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
}
export class FakeCanvas {
  data: Uint8ClampedArray;
  private ctx: FakeCtx;
  constructor(public width = 300, public height = 150) { this.data = new Uint8ClampedArray(width * height * 4); this.ctx = new FakeCtx(this); }
  getContext() { return this.ctx; }
}
class FakeCtx {
  fillStyle = '#000'; globalAlpha = 1; imageSmoothingEnabled = false;
  constructor(private cv: FakeCanvas) { }
  private blend(x: number, y: number, r: number, g: number, b: number, a: number) {
    if (x < 0 || y < 0 || x >= this.cv.width || y >= this.cv.height || a <= 0) return;
    const i = (y * this.cv.width + x) * 4, d = this.cv.data, da = d[i + 3] / 255, oa = a + da * (1 - a);
    d[i] = (r * a + d[i] * da * (1 - a)) / oa; d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa; d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa; d[i + 3] = oa * 255;
  }
  fillRect(x: number, y: number, w: number, h: number) {
    const [r, g, b, a] = parseColor(this.fillStyle);
    for (let j = Math.round(y); j < Math.round(y + h); j++) for (let i = Math.round(x); i < Math.round(x + w); i++) this.blend(i, j, r, g, b, a * this.globalAlpha);
  }
  clearRect(x: number, y: number, w: number, h: number) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < this.cv.width && j < this.cv.height) this.cv.data.fill(0, (j * this.cv.width + i) * 4, (j * this.cv.width + i) * 4 + 4);
  }
  drawImage(src: FakeCanvas, dx: number, dy: number) {
    for (let j = 0; j < src.height; j++) for (let i = 0; i < src.width; i++) {
      const k = (j * src.width + i) * 4, s = src.data;
      this.blend(dx + i, dy + j, s[k], s[k + 1], s[k + 2], s[k + 3] / 255 * this.globalAlpha);
    }
  }
}

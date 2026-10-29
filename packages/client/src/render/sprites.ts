import { CLOAKS, HAIRS, hash, type Dir } from '@vale/shared';

/* ---------- Sprites: grade de pixels → contorno → canvas ---------- */
export type Grid = (string | 0)[][];
export function mk(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function G(w: number, h: number): Grid { return Array.from({ length: h }, () => Array(w).fill(0)); }
function R(g: Grid, x: number, y: number, w: number, h: number, c: string) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[0].length) g[j][i] = c; }
function P(g: Grid, x: number, y: number, c: string) { if (g[y] && x >= 0 && x < g[0].length) g[y][x] = c; }
function mirror(g: Grid) { return g.map(r => r.slice().reverse()); }
function rot90(g: Grid) { const h = g.length, w = g[0].length, o = G(h, w); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[x][h - 1 - y] = g[y][x]; return o; }
function rotN(g: Grid, n: number) { for (let i = 0; i < n; i++) g = rot90(g); return g; }
export function bake(g: Grid, flash = false) {
  const h = g.length, w = g[0].length, c = mk(w + 2, h + 2), x = c.getContext('2d')!;
  const on = (i: number, j: number) => j >= 0 && j < h && i >= 0 && i < w && g[j][i];
  x.fillStyle = '#1b1226';
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
    if (on(i, j)) continue;
    if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) x.fillRect(i + 1, j + 1, 1, 1);
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = g[j][i]; if (v) { x.fillStyle = flash ? '#fff4ee' : v; x.fillRect(i + 1, j + 1, 1, 1); } }
  return c;
}
function cached<A extends unknown[]>(make: (...a: A) => HTMLCanvasElement) {
  const m = new Map<string, HTMLCanvasElement>();
  return (...a: A) => { const k = a.join('_'); let c = m.get(k); if (!c) m.set(k, c = make(...a)); return c; };
}

// Heroína: cachecol laranja; capa e cabelo vêm da aparência escolhida pelo jogador
type Pose = 'n' | 'atk' | 'lift';
const HC = { hair: '#3d2552', hairL: '#6a4386', skin: '#f4c9a3', skinD: '#dc9f7c', eye: '#1f142b', scarf: '#ee8b3d', scarfD: '#b95f26', cloak: '#2f8f9b', cloakD: '#1d5d69', cloakL: '#5cbcc3', boot: '#5b3622' };
type HeroColors = typeof HC;
function colors(cloak: number, hair: number): HeroColors {
  const c = CLOAKS[cloak] ?? CLOAKS[0], h = HAIRS[hair] ?? HAIRS[0];
  return { ...HC, cloak: c.base, cloakD: c.dark, cloakL: c.light, hair: h.base, hairL: h.light };
}
function legs(g: Grid, step: number, side = false) {
  const b = HC.boot;
  if (side) {
    if (step === 0) R(g, 6, 13, 4, 3, b);
    else if (step === 1) { R(g, 5, 13, 2, 3, b); R(g, 9, 13, 2, 2, b); }
    else { R(g, 6, 13, 2, 2, b); R(g, 9, 13, 2, 3, b); }
    return;
  }
  if (step === 0) { R(g, 5, 13, 2, 3, b); R(g, 9, 13, 2, 3, b); }
  else if (step === 1) { R(g, 5, 13, 2, 3, b); R(g, 9, 13, 2, 2, b); }
  else { R(g, 5, 13, 2, 2, b); R(g, 9, 13, 2, 3, b); }
}
function arms(g: Grid, step: number, pose: Pose, c: HeroColors) {
  if (pose === 'lift') { R(g, 2, 2, 2, 4, c.skin); R(g, 12, 2, 2, 4, c.skin); R(g, 2, 6, 2, 3, c.cloakD); R(g, 12, 6, 2, 3, c.cloakD); }
  else if (pose !== 'atk') { R(g, 2, step === 2 ? 12 : 11, 1, 2, c.skin); R(g, 13, step === 1 ? 12 : 11, 1, 2, c.skin); }
}
function heroGrid(dir: Dir, step: number, pose: Pose, c: HeroColors) {
  const g = G(16, 16);
  if (dir === 1) {
    legs(g, step);
    R(g, 4, 9, 8, 5, c.cloak); R(g, 3, 10, 10, 3, c.cloak); R(g, 4, 13, 8, 1, c.cloakD); R(g, 7, 11, 2, 2, c.cloakD); P(g, 3, 12, c.cloakD); P(g, 12, 12, c.cloakD);
    arms(g, step, pose, c);
    R(g, 4, 8, 8, 2, c.scarf); R(g, 4, 9, 8, 1, c.scarfD); R(g, 7, 10, 2, 1, c.scarf);
    R(g, 4, 0, 8, 8, c.hair); R(g, 3, 1, 1, 6, c.hair); R(g, 12, 1, 1, 6, c.hair); R(g, 5, 1, 4, 1, c.hairL); R(g, 4, 2, 1, 2, c.hairL);
    R(g, 7, 6, 2, 1, c.scarf);
    if (pose === 'lift') { R(g, 2, 2, 2, 4, c.skin); R(g, 12, 2, 2, 4, c.skin); }
    return g;
  }
  if (dir === 0) {
    legs(g, step);
    R(g, 4, 9, 8, 5, c.cloak); R(g, 3, 10, 10, 3, c.cloak); R(g, 4, 13, 8, 1, c.cloakD); P(g, 3, 12, c.cloakD); P(g, 12, 12, c.cloakD); R(g, 5, 10, 1, 3, c.cloakL);
    arms(g, step, pose, c);
    R(g, 4, 8, 8, 2, c.scarf); R(g, 4, 9, 8, 1, c.scarfD);
    R(g, 4, 1, 8, 7, c.skin); R(g, 4, 0, 8, 3, c.hair); R(g, 3, 1, 1, 6, c.hair); R(g, 12, 1, 1, 6, c.hair); R(g, 4, 3, 1, 2, c.hair); R(g, 11, 3, 1, 2, c.hair);
    R(g, 6, 0, 3, 1, c.hairL); R(g, 5, 1, 2, 1, c.hairL);
    R(g, 6, 4, 1, 2, c.eye); R(g, 9, 4, 1, 2, c.eye); P(g, 5, 6, c.skinD); P(g, 10, 6, c.skinD);
    if (pose === 'lift') { R(g, 2, 2, 2, 4, c.skin); R(g, 12, 2, 2, 4, c.skin); }
    return g;
  }
  legs(g, step, true);
  R(g, 4, 9, 8, 5, c.cloak); R(g, 4, 13, 8, 1, c.cloakD); R(g, 4, 10, 2, 3, c.cloakD); R(g, 10, 10, 1, 3, c.cloakL);
  const fl = step === 1 ? 1 : 0;
  R(g, 1, 8 + fl, 4, 2, c.scarf); R(g, 1, 9 + fl, 3, 1, c.scarfD);
  R(g, 5, 8, 7, 2, c.scarf); R(g, 5, 9, 7, 1, c.scarfD);
  if (pose !== 'atk' && pose !== 'lift') R(g, 8 + (step === 1 ? 1 : step === 2 ? -1 : 0), 11, 2, 2, c.skin);
  R(g, 5, 1, 7, 7, c.skin); R(g, 4, 0, 7, 3, c.hair); R(g, 4, 1, 3, 7, c.hair); P(g, 7, 3, c.hair); R(g, 6, 0, 3, 1, c.hairL);
  R(g, 10, 4, 1, 2, c.eye); P(g, 12, 5, c.skin); P(g, 9, 6, c.skinD);
  if (pose === 'lift') { R(g, 9, 0, 2, 2, c.skin); R(g, 11, 1, 2, 3, c.skin); }
  return dir === 2 ? mirror(g) : g;
}
export const heroSprite = cached((dir: Dir, step: number, pose: Pose, cloak: number, hair: number) => bake(heroGrid(dir, step, pose, colors(cloak, hair))));

// Geleca (pula na sua direção)
function slimeGrid(sq: number) {
  const g = G(14, 12), hgt = sq === 1 ? 7 : sq === 2 ? 11 : 9, rx = sq === 1 ? 6.6 : sq === 2 ? 5 : 6;
  const B = '#b65cd8', L = '#e4a6f3', Dk = '#7a3496';
  for (let j = 0; j < 12; j++) {
    const yy = 11 - j; if (yy >= hgt) continue;
    const base = hgt * 0.35;
    const hw = yy > base ? rx * Math.sqrt(Math.max(0, 1 - Math.pow((yy - base) / (hgt - base), 2))) : rx * (0.86 + 0.14 * yy / base);
    for (let i = 0; i < 14; i++) {
      const dx = i + 0.5 - 7; if (Math.abs(dx) > hw) continue;
      let c = B;
      if (dx < -hw * 0.25 && yy > hgt * 0.55) c = L;
      if (yy < 1.5 || dx > hw * 0.62) c = Dk;
      g[j][i] = c;
    }
  }
  const ey = 11 - Math.round(hgt * 0.55);
  [4, 8].forEach(ex => { R(g, ex, ey - 1, 2, 2, '#ffffff'); P(g, ex + 1, ey, '#20142c'); });
  return g;
}
export const slimeSprite = cached((sq: number, fl: boolean) => bake(slimeGrid(sq), fl));

// Rei Geleca: uma geleca enorme de coroa. sq como a geleca (0 normal, 1 achatado, 2 esticado no pulo); furioso fica vermelho.
function kingGrid(sq: number, angry: boolean) {
  const W = 28, H = 26, g = G(W, H), hgt = sq === 1 ? 15 : sq === 2 ? 22 : 19, rx = sq === 1 ? 13.5 : sq === 2 ? 10.5 : 12.5;
  const [B, L, Dk] = angry ? ['#d9534f', '#f5a39a', '#8f2630'] : ['#9a4fc4', '#d99af0', '#5f2a84'];
  for (let j = 0; j < H; j++) {
    const yy = H - 1 - j; if (yy >= hgt) continue;
    const base = hgt * 0.35;
    const hw = yy > base ? rx * Math.sqrt(Math.max(0, 1 - Math.pow((yy - base) / (hgt - base), 2))) : rx * (0.86 + 0.14 * yy / base);
    for (let i = 0; i < W; i++) {
      const dx = i + 0.5 - W / 2; if (Math.abs(dx) > hw) continue;
      let c = B;
      if (dx < -hw * 0.3 && yy > hgt * 0.55) c = L;
      if (yy < 2 || dx > hw * 0.66) c = Dk;
      g[j][i] = c;
    }
  }
  const top = H - hgt, ey = H - 1 - Math.round(hgt * 0.55);
  [8, 17].forEach(ex => { R(g, ex, ey - 2, 3, 3, '#ffffff'); R(g, ex + 1, ey - 1, 2, 2, '#20142c'); });
  if (angry) { R(g, 7, ey - 4, 4, 1, '#20142c'); R(g, 17, ey - 4, 4, 1, '#20142c'); }   // sobrancelhas bravas
  R(g, 11, ey + 4, 6, 1, '#20142c');                                                    // boca
  const GD = '#ffd94f', GS = '#c99a1e', cy = Math.max(0, top - 4);                      // coroa
  R(g, 9, cy + 2, 10, 3, GD); R(g, 9, cy + 4, 10, 1, GS);
  [9, 13, 17].forEach(x => { R(g, x, cy, 2, 2, GD); });
  P(g, 14, cy + 3, '#e0457b'); P(g, 11, cy + 3, '#4fb6e0'); P(g, 17, cy + 3, '#4fb6e0');
  return g;
}
export const kingSprite = cached((sq: number, angry: boolean, fl: boolean) => bake(kingGrid(sq, angry), fl));

// Besouro-guarda (patrulha e persegue)
function beetleGrid(step: number) {
  const g = G(14, 14), L = '#24203a', S = '#4d62b2', SL = '#a2b4f0', SD = '#2b3577', HD = '#262338', GD = '#e0ad48';
  const a = step ? 1 : 0;
  ([[3, a], [6, -a], [9, a]] as const).forEach(([y, o]) => { R(g, 0, y + o, 2, 1, L); R(g, 12, y - o, 2, 1, L); });
  for (let j = 0; j < 12; j++) for (let i = 0; i < 14; i++) {
    const dx = (i + 0.5 - 7) / 5.6, dy = (j + 0.5 - 6) / 5.8, d = dx * dx + dy * dy;
    if (d <= 1) { let c = S; if (dx < -0.2 && dy < -0.15 && d > 0.12) c = SL; if (dy > 0.55 || dx > 0.6) c = SD; g[j][i] = c; }
  }
  R(g, 7, 1, 1, 9, SD);
  P(g, 4, 4, GD); P(g, 10, 4, GD); P(g, 4, 8, GD); P(g, 10, 8, GD);
  R(g, 4, 10, 6, 3, HD); P(g, 5, 11, '#ffd75a'); P(g, 8, 11, '#ffd75a'); P(g, 3, 13, HD); P(g, 10, 13, HD); R(g, 6, 13, 2, 1, HD);
  return g;
}
const BROT = [0, 2, 1, 3];
export const beetleSprite = cached((dir: Dir, step: number, fl: boolean) => bake(rotN(beetleGrid(step), BROT[dir]), fl));

// Objetos de cenário (14x14 + contorno = 16x16)
function disc(cx: number, cy: number, rx: number, ry: number, fn: (dx: number, dy: number, i: number, j: number) => string) {
  const g = G(14, 14);
  for (let j = 0; j < 14; j++) for (let i = 0; i < 14; i++) { const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) g[j][i] = fn(dx, dy, i, j); }
  return g;
}
function bushGrid() {
  const g = disc(7, 7.5, 6.6, 6.2, (dx, dy, i, j) => {
    const hv = hash(i, j, 7), d = dx * dx + dy * dy;
    if (d > 0.62 && dy > 0.1) return '#2f6e2a';
    if (dx + dy < -0.6) return '#8ad064';
    if (hv < 0.2) return '#6cbc4d';
    if (hv > 0.86) return '#357a2e';
    return '#4c9c3b';
  });
  ([[4, 4], [8, 3], [10, 6], [5, 8]] as const).forEach(([x, y]) => P(g, x, y, '#b6e88a'));
  return g;
}
function rockGrid() {
  const g = disc(7, 7.6, 6.4, 5.8, (dx, dy) => dx + dy < -0.55 ? '#c6c9d2' : (dy > 0.5 || dx > 0.62) ? '#5e6069' : '#8f929b');
  P(g, 8, 5, '#5e6069'); P(g, 9, 6, '#5e6069'); P(g, 9, 7, '#5e6069'); P(g, 4, 4, '#e8eaef');
  return g;
}
function treeGrid() {
  const g = G(14, 14);
  R(g, 6, 11, 2, 3, '#6b4228'); R(g, 6, 11, 1, 3, '#8a5a36');
  const c = disc(7, 6, 6.6, 6, (dx, dy, i, j) => {
    const hv = hash(i, j, 3);
    if (dx + dy > 0.55) return '#2c6529';
    if (dx + dy < -0.5) return hv < 0.3 ? '#7cc25a' : '#62ae49';
    if (hv < 0.16) return '#55a043';
    if (hv > 0.88) return '#2f6d2b';
    return '#3e8a35';
  });
  for (let j = 0; j < 12; j++) for (let i = 0; i < 14; i++) if (c[j][i]) g[j][i] = c[j][i];
  return g;
}
function signGrid() {
  const g = G(14, 14);
  R(g, 6, 8, 2, 6, '#7d4f2a'); R(g, 1, 1, 12, 8, '#b9834b'); R(g, 1, 8, 12, 1, '#8f5d31'); R(g, 1, 1, 12, 1, '#d39b62');
  R(g, 3, 3, 8, 1, '#6a4422'); R(g, 3, 5, 6, 1, '#6a4422');
  return g;
}
function pillarGrid() {
  const g = G(14, 14);
  R(g, 3, 2, 8, 10, '#b3ada3'); R(g, 4, 2, 1, 10, '#dcd6cc'); R(g, 9, 2, 2, 10, '#8f897f');
  R(g, 2, 0, 10, 2, '#d2ccc2'); R(g, 2, 0, 10, 1, '#e6e0d6'); R(g, 2, 12, 10, 2, '#8f897f');
  return g;
}
// Tocha: poste de madeira com braseiro; a chama ganha brilho animado no renderer.
function torchGrid() {
  const g = G(14, 14);
  R(g, 6, 6, 2, 8, '#7d4f2a'); R(g, 6, 6, 1, 8, '#9a6538');
  R(g, 4, 5, 6, 2, '#4a4038'); R(g, 4, 5, 6, 1, '#6e6255');
  R(g, 5, 2, 4, 3, '#ee8b3d'); R(g, 6, 1, 2, 2, '#f5c542'); P(g, 6, 0, '#fff3b0');
  return g;
}
// Tocha apagada: o mesmo poste, com o braseiro frio e um fio de fumaça.
function coldTorchGrid() {
  const g = G(14, 14);
  R(g, 6, 6, 2, 8, '#7d4f2a'); R(g, 6, 6, 1, 8, '#9a6538');
  R(g, 4, 5, 6, 2, '#4a4038'); R(g, 4, 5, 6, 1, '#6e6255');
  R(g, 5, 4, 4, 1, '#2d2733'); P(g, 6, 3, '#5e5866'); P(g, 7, 1, '#8a8494');
  return g;
}
// Bloco de pedra entalhado (empurra), com um losango gravado.
function blockGrid() {
  const g = G(14, 14);
  R(g, 0, 0, 14, 14, '#8f897f'); R(g, 0, 0, 14, 2, '#c6c0b4'); R(g, 0, 0, 2, 14, '#b3ada3'); R(g, 0, 12, 14, 2, '#6a645b'); R(g, 12, 0, 2, 14, '#77716a');
  for (const [x, y] of [[7, 3], [6, 4], [8, 4], [5, 5], [9, 5], [4, 6], [10, 6], [5, 7], [9, 7], [6, 8], [8, 8], [7, 9]]) P(g, x, y, '#5a554d');
  P(g, 7, 6, '#d9b45a');
  return g;
}
// Portão: grade de ferro presa em dois postes.
function gateGrid() {
  const g = G(14, 14);
  R(g, 0, 0, 2, 14, '#6e6255'); R(g, 12, 0, 2, 14, '#6e6255'); R(g, 0, 0, 1, 14, '#8a7c6c');
  for (const x of [3, 6, 9]) { R(g, x, 1, 2, 13, '#4d505a'); R(g, x, 1, 1, 13, '#8f929b'); }
  R(g, 2, 3, 10, 2, '#3a3d46'); R(g, 2, 3, 10, 1, '#7a7d87'); R(g, 2, 10, 10, 2, '#3a3d46'); R(g, 2, 10, 10, 1, '#7a7d87');
  for (const x of [3, 6, 9]) P(g, x, 0, '#c6c9d2');
  return g;
}
export const OBJ: Record<string, HTMLCanvasElement> = { T: bake(treeGrid()), b: bake(bushGrid()), r: bake(rockGrid()), s: bake(signGrid()), o: bake(pillarGrid()), t: bake(torchGrid()), j: bake(coldTorchGrid()), G: bake(gateGrid()), B: bake(blockGrid()) };
export const SHADOW = (() => { const c = mk(14, 6), x = c.getContext('2d')!; x.fillStyle = 'rgba(16,24,8,0.32)'; for (let j = 0; j < 6; j++) for (let i = 0; i < 14; i++) { const dx = (i + 0.5 - 7) / 7, dy = (j + 0.5 - 3) / 3; if (dx * dx + dy * dy <= 1) x.fillRect(i, j, 1, 1); } return c; })();

function glyph(rows: string[], col: string) { const g = G(rows[0].length, rows.length); rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '1') g[j][i] = col; })); return bake(g); }
export const BANG = glyph(['11', '11', '11', '00', '11'], '#ffe66b');
export const QUES = glyph(['111', '001', '011', '000', '010'], '#ffffff');

/* ---------- Ícone do ouro (8x8 + contorno) ---------- */
function icon(rows: string[], pal: Record<string, string>) {
  const g = G(rows[0].length, rows.length);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) g[j][i] = pal[ch]; }));
  return bake(g);
}
// Ouro não é item (vai para o contador): o ícone dele continua aqui. Os dos itens vêm de content/items/ (ver icons.ts).
// Chave de masmorra: argola, haste e dentes. Vai para o contador do grupo, não para a mochila.
export const KEY_ICON = icon(['.yyy....', 'y...y...', 'y...y...', '.yyy....', '..y.....', '..yyy...', '..y.....', '..yy....'], { y: '#e9b44c' });
export const GOLD_ICON = icon(['..yyyy..', '.yywwyy.', 'yywyyyyo', 'yyyyyyyo', 'yyyyyyoo', '.yyyyoo.', '..oooo..'], { y: '#f5c542', w: '#fff3b0', o: '#b8862a' });

/* ---------- Baú (14x12 + contorno): fechado e aberto (vazio para você) ---------- */
function chestGrid(open: boolean) {
  const g = G(14, 12), W = '#9a6234', WD = '#6b4026', WL = '#c4854c', GOLD = '#e9b44c', GD = '#a8792a', IN = '#2a1a14';
  if (open) {
    R(g, 1, 0, 12, 3, WD); R(g, 1, 0, 12, 1, W); R(g, 2, 1, 10, 1, IN);           // tampa aberta, para trás
    R(g, 1, 3, 12, 2, IN);                                                       // por dentro, vazio
  } else {
    R(g, 1, 1, 12, 4, W); R(g, 1, 1, 12, 1, WL); R(g, 1, 4, 12, 1, WD);          // tampa
    R(g, 6, 3, 2, 3, GOLD); P(g, 6, 3, '#fff3b0');                                 // fecho
  }
  R(g, 0, 5, 14, 7, W); R(g, 0, 5, 14, 1, WL); R(g, 0, 11, 14, 1, WD);           // corpo
  R(g, 0, 5, 2, 7, GOLD); R(g, 12, 5, 2, 7, GOLD); R(g, 0, 5, 1, 7, GD); R(g, 13, 5, 1, 7, GD);
  if (!open) R(g, 6, 6, 2, 2, GOLD);
  return g;
}
export const CHEST = { closed: bake(chestGrid(false)), open: bake(chestGrid(true)) };

/* ---------- Morcego: dois quadros (asas abertas e fechadas) ---------- */
function batGrid(up: boolean) {
  const g = G(14, 8), B = '#3a2a4a', W = '#5a4570', WL = '#7a6294', E = '#ff5a5a';
  R(g, 5, 2, 4, 4, B); P(g, 5, 1, B); P(g, 8, 1, B);          // corpo e orelhas
  P(g, 6, 3, E); P(g, 7, 3, E);                                  // olhos
  if (up) { R(g, 0, 0, 5, 2, W); R(g, 9, 0, 5, 2, W); R(g, 2, 2, 3, 1, WL); R(g, 9, 2, 3, 1, WL); }
  else { R(g, 0, 3, 5, 2, W); R(g, 9, 3, 5, 2, W); R(g, 1, 5, 4, 1, WL); R(g, 9, 5, 4, 1, WL); }
  return g;
}
export const batSprite = cached((up: boolean, fl: boolean) => bake(batGrid(up), fl));

/* ---------- Bomba (10x10): pisca cada vez mais rápido perto de explodir ---------- */
function bombGrid(hot: boolean) {
  const g = G(10, 11), B = hot ? '#e2574c' : '#2d2a3a', L = hot ? '#ff9f8c' : '#5a566e';
  for (let j = 0; j < 8; j++) for (let i = 0; i < 10; i++) { const dx = i + 0.5 - 5, dy = j + 0.5 - 6.5 + 3; if (dx * dx + dy * dy <= 16) g[j + 3][i] = B; }
  R(g, 2, 4, 2, 2, L); R(g, 4, 1, 2, 2, '#8a6a3a'); P(g, 6, 0, '#8a6a3a');
  return g;
}
export const BOMB = { cold: bake(bombGrid(false)), hot: bake(bombGrid(true)) };
export const bombFrame = (fuse: number, tick: number) => (fuse < 60 ? (tick >> 1) & 1 : fuse < 100 ? (tick >> 3) & 1 : 0) ? BOMB.hot : BOMB.cold;

/* ---------- Galinha: ciscando (2 quadros) e furiosa voando (asas batendo, olhos vermelhos) ---------- */
function chickenGrid(dir: 2 | 3, step: number, angry: boolean) {
  const g = G(12, 11), W = '#f4f0e8', S = '#cfc6b4', R = '#e2574c', Y = '#f5c542', E = angry ? '#ff2a2a' : '#1f142b';
  R_(g, 3, 3, 7, 5, W); R_(g, 2, 4, 2, 3, W); R_(g, 4, 7, 5, 1, S);          // corpo e rabo
  R_(g, 8, 0, 3, 4, W); P(g, 9, 0, R); P(g, 10, 0, R); P(g, 9, 3, R);       // cabeça, crista, barbela
  P(g, 11, 2, Y); P(g, 9, 1, E);                                            // bico e olho
  if (angry) { R_(g, 3, step ? 1 : 3, 4, 2, S); }                           // asa batendo
  else { R_(g, 4, 4, 4, 2, S); R_(g, step ? 5 : 6, 8, 1, 3, Y); R_(g, step ? 7 : 6, 8, 1, 3, Y); }
  return dir === 2 ? mirror(g) : g;
}
function R_(g: Grid, x: number, y: number, w: number, h: number, c: string) { R(g, x, y, w, h, c); }
export const chickenSprite = cached((dir: 2 | 3, step: number, angry: boolean) => bake(chickenGrid(dir, step, angry)));

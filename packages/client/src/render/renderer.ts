import { DEFAULT_LOOK, TS, VIEW_H, VIEW_W, bobberOf, hash, sunlight, angDir, distAt, nextLower, swordPose, type EnemyView, type Look, type PlayerView, type SwordPose, type WorldMap } from '@vale/shared';
import type { Camera } from '../camera';
import type { Scene } from '../session/types';
import type { Particles } from './particles';
import { BANG, CHEST, ITEM_ICON, OBJ, bombFrame, QUES, SHADOW, batSprite, chickenSprite, kingSprite, beetleSprite, heroSprite, mk, slimeSprite } from './sprites';
import { drawTiles } from './tiles';

type Ctx = CanvasRenderingContext2D;
// talking: "x,y" do NPC que está conversando com você (ele se vira para você).
export interface View { lock?: { x: number; y: number } | null; talking?: string | null; me: PlayerView | undefined; cam: Camera; particles: Particles; showPaths: boolean; reticle: { x: number; y: number } | null; shake: number; tick: number }

function drawShadow(ctx: Ctx, x: number, y: number) { ctx.drawImage(SHADOW, Math.round(x - 7), Math.round(y - 3)); }
function drawSword(ctx: Ctx, p: PlayerView, s: SwordPose, tick: number) {
  const ca = Math.cos(s.ang), sa = Math.sin(s.ang);
  const X = (r: number) => Math.round(s.ox + ca * r), Y = (r: number) => Math.round(s.oy + sa * r);
  if (p.state === 'spin' || p.state === 'swing') {
    const back = p.state === 'spin' ? 0.24 : 0.16;
    for (let k = 1; k <= 4; k++) {
      const a = s.ang - k * back, r = s.len - 1;
      ctx.fillStyle = `rgba(255,248,230,${0.55 - k * 0.12})`;
      ctx.fillRect(Math.round(s.ox + Math.cos(a) * r), Math.round(s.oy + Math.sin(a) * r), 2, 2);
    }
  }
  ctx.fillStyle = '#1b1226';
  for (let r = 1; r <= s.len; r++) ctx.fillRect(X(r) - 1, Y(r) - 1, 3, 3);
  for (let k = -2; k <= 2; k++) ctx.fillRect(Math.round(s.ox + ca * 3 - sa * k) - 1, Math.round(s.oy + sa * 3 + ca * k) - 1, 3, 3);
  ctx.fillStyle = '#e9b44c';
  for (let k = -2; k <= 2; k++) ctx.fillRect(Math.round(s.ox + ca * 3 - sa * k), Math.round(s.oy + sa * 3 + ca * k), 1, 1);
  ctx.fillStyle = '#7a4a2a'; ctx.fillRect(X(1), Y(1), 1, 1); ctx.fillRect(X(2), Y(2), 1, 1);
  for (let r = 4; r <= s.len; r++) { ctx.fillStyle = r >= s.len - 1 ? '#ffffff' : '#d6e0ef'; ctx.fillRect(X(r), Y(r), 1, 1); }
  if (p.state === 'charge' && p.charged && (tick & 4)) {
    const tx = X(s.len + 1), ty = Y(s.len + 1);
    ctx.fillStyle = '#fff7d6'; ctx.fillRect(tx - 2, ty, 5, 1); ctx.fillRect(tx, ty - 2, 1, 5);
    ctx.fillStyle = '#f2a24e'; ctx.fillRect(tx, ty, 1, 1);
  }
}
function drawArrow(ctx: Ctx, x: number, y: number, ang: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const X = (r: number) => Math.round(x + ca * r), Y = (r: number) => Math.round(y + sa * r);
  const f1x = Math.round(x - sa * 1.2), f1y = Math.round(y + ca * 1.2), f2x = Math.round(x + sa * 1.2), f2y = Math.round(y - ca * 1.2);
  ctx.fillStyle = '#1b1226';
  for (let r = 0; r <= 9; r++) ctx.fillRect(X(r) - 1, Y(r) - 1, 3, 3);
  ctx.fillRect(f1x - 1, f1y - 1, 3, 3); ctx.fillRect(f2x - 1, f2y - 1, 3, 3);
  ctx.fillStyle = '#9a6538'; for (let r = 1; r <= 7; r++) ctx.fillRect(X(r), Y(r), 1, 1);
  ctx.fillStyle = '#e8eef8'; ctx.fillRect(X(8), Y(8), 1, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(X(9), Y(9), 1, 1);
  ctx.fillStyle = '#e05a4f'; ctx.fillRect(f1x, f1y, 1, 1); ctx.fillRect(f2x, f2y, 1, 1);
  ctx.fillStyle = '#f4f0fb'; ctx.fillRect(X(0), Y(0), 1, 1);
}
function drawBow(ctx: Ctx, p: PlayerView) {
  const fx = Math.cos(p.aim), fy = Math.sin(p.aim), qx = -fy, qy = fx;
  const bx = p.x + fx * 5, by = p.y - 6 + fy * 3;
  const pull = p.t < 7 ? Math.min(3, Math.round(p.t * 0.6)) : 0;
  const pts: [number, number][] = [];
  for (let k = -5; k <= 5; k++) { const f = (1 - (k / 5) * (k / 5)) * 3; pts.push([Math.round(bx + fx * f + qx * k), Math.round(by + fy * f + qy * k)]); }
  ctx.fillStyle = '#1b1226'; pts.forEach(([x, y]) => ctx.fillRect(x - 1, y - 1, 3, 3));
  pts.forEach(([x, y], i) => { ctx.fillStyle = i === 5 ? '#e9b44c' : '#a8692f'; ctx.fillRect(x, y, 1, 1); });
  ctx.fillStyle = '#efe6d2';
  for (let k = -5; k <= 5; k++) { const back = pull * (1 - Math.abs(k) / 5); ctx.fillRect(Math.round(bx - fx * back + qx * k), Math.round(by - fy * back + qy * k), 1, 1); }
  if (p.t < 7) drawArrow(ctx, bx - fx * pull, by - fy * pull, p.aim);
}
// Caída: deitada de lado, um pouco apagada.
function drawFallen(ctx: Ctx, p: PlayerView, look: Look) {
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.translate(Math.round(p.x), Math.round(p.y) - 4);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(heroSprite(0, 0, 'n', look.cloak, look.hair), -9, -9);
  ctx.restore();
}
// Barrinha de vida sobre a cabeça dos outros, só quando estão feridos.
function drawLifeBar(ctx: Ctx, p: PlayerView) {
  const x = Math.round(p.x) - 7, y = Math.round(p.y - p.z) - 17, w = Math.max(1, Math.round(12 * p.hp / p.maxHp));
  ctx.fillStyle = '#1b1226'; ctx.fillRect(x - 1, y - 1, 16, 4);
  ctx.fillStyle = '#4a2030'; ctx.fillRect(x, y, 14, 2);
  ctx.fillStyle = p.hp / p.maxHp > 0.3 ? '#e2574c' : '#ff9f43'; ctx.fillRect(x + 1, y, w, 2);
}
// Vara de pesca: linha da mão até a boia, que balança; na mordida, a boia afunda e aparece um "!".
function drawRod(ctx: Ctx, p: PlayerView, tick: number) {
  const b = bobberOf(p), bite = p.fish?.phase === 'bite', dip = bite ? ((tick >> 2) & 1) * 2 : Math.round(Math.sin(tick / 12));
  const hx = Math.round(p.x + (p.dir === 3 ? 6 : p.dir === 2 ? -6 : 3)), hy = Math.round(p.y - 9);
  const tipX = hx + (b.x - p.x) * 0.45, tipY = hy - 8;
  ctx.fillStyle = '#7a4a2a';
  for (let i = 0; i <= 6; i++) ctx.fillRect(Math.round(hx + (tipX - hx) * i / 6), Math.round(hy + (tipY - hy) * i / 6), 1, 1);
  ctx.fillStyle = 'rgba(240,240,255,0.7)';
  for (let i = 1; i < 10; i++) { const k = i / 10; ctx.fillRect(Math.round(tipX + (b.x - tipX) * k), Math.round(tipY + (b.y + dip - tipY) * k + Math.sin(k * Math.PI) * 3), 1, 1); }
  ctx.fillStyle = '#1b1226'; ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) + dip - 2, 4, 4);
  ctx.fillStyle = '#e2574c'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) + dip - 1, 2, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) + dip, 2, 1);
  if (bite) ctx.drawImage(BANG, Math.round(p.x - 2), Math.round(p.y - 30 - ((tick >> 3) & 1)));
}
function drawHero(ctx: Ctx, map: WorldMap, p: PlayerView, look: Look, tick: number, mine: boolean) {
  if (p.state === 'dead') { drawFallen(ctx, p, look); return; }
  if (p.state === 'fish') drawRod(ctx, p, tick);
  const blink = p.inv > 0 && ((p.inv >> 2) & 1) && p.state !== 'flying';
  const s = swordPose(p);
  const spinning = p.state === 'held' || p.state === 'flying';   // no colo se debate; voando, gira
  const dir = spinning ? ([0, 3, 1, 2] as const)[(tick >> (p.state === 'flying' ? 2 : 3)) & 3] : p.state === 'spin' && s ? angDir(s.ang) : p.dir;
  const bow = p.state === 'bow';
  const pose = (p.state === 'lift' || p.state === 'carry' || spinning) ? 'lift' : ((s || bow) ? 'atk' : 'n');
  const step = p.state === 'hurt' ? 0 : p.step;
  const px = Math.round(p.x), py = Math.round(p.y - p.z);
  const behind = s && Math.sin(s.ang) < -0.35;
  if (s && behind) drawSword(ctx, p, s, tick);
  if (bow && Math.sin(p.aim) < -0.35) drawBow(ctx, p);
  if (!blink) {
    ctx.drawImage(heroSprite(dir, step, pose, look.cloak, look.hair), px - 9, py - 13);
    const tx = Math.floor(p.x / TS), ty = Math.floor((p.y + 2) / TS);
    if (p.z < 1 && map.get(tx, ty) === 'g') {   // pés escondidos no mato alto
      ctx.fillStyle = '#3f7d2d'; for (let i = -6; i <= 5; i += 2) ctx.fillRect(px + i, py - 1 + ((i & 2) ? 0 : 1), 1, 4);
      ctx.fillStyle = '#93d464'; for (let i = -5; i <= 5; i += 3) ctx.fillRect(px + i, py - 2, 1, 1);
    }
  }
  if (s && !behind) drawSword(ctx, p, s, tick);
  if (bow && Math.sin(p.aim) >= -0.35) drawBow(ctx, p);
  if (p.carry && !spinning) {
    let cx = p.x, cy = p.y - p.z - 20 + (p.step ? ((p.walkT >> 3) & 1) : 0);
    if (p.state === 'lift' && p.liftFrom) {
      const t = Math.min(1, p.t / 12);
      cx = p.liftFrom.x + (p.x - p.liftFrom.x) * t;
      cy = p.liftFrom.y + (p.y - 20 - p.liftFrom.y) * t - Math.sin(t * Math.PI) * 6;
    }
    if (p.carry === 'bomb') ctx.drawImage(bombFrame(p.carryFuse ?? 150, tick), Math.round(cx - 6), Math.round(cy - 6));
    else if (p.carry !== 'player') ctx.drawImage(OBJ[p.carry], Math.round(cx - 8), Math.round(cy - 8));   // pessoa no colo se desenha sozinha
  }
  if (!mine && p.hp < p.maxHp && !p.carry) drawLifeBar(ctx, p);
}
function drawEnemy(ctx: Ctx, e: EnemyView, tick: number) {
  const fl = e.hurtT > 0 && ((e.hurtT >> 1) & 1) === 1;
  if (e.type === 'chicken') {   // furiosa (do bando) voa e bate as asas; comum cisca
    const angry = e.mode === 'chase', dir = e.dir === 2 ? 2 : 3;
    ctx.drawImage(chickenSprite(dir, (e.anim >> (angry ? 2 : 4)) & 1, angry), Math.round(e.x - 7), Math.round(e.y - 11 - e.z));
    return;
  }
  if (e.type === 'king') {
    const sq = e.mode === 'hop' ? (e.z > 4 ? 2 : 1) : e.timer < 10 ? 1 : ((e.anim >> 4) & 1);
    ctx.drawImage(kingSprite(sq, e.hp <= e.maxHp / 2, fl), Math.round(e.x - 15), Math.round(e.y - 25 - e.z));
    return;
  }
  if (e.type === 'bat') {
    ctx.drawImage(batSprite(((e.anim >> 2) & 1) === 1, fl), Math.round(e.x - 8), Math.round(e.y - 9 - e.z));
    return;
  }
  if (e.type === 'slime') {
    let sq = 0;
    if (e.mode === 'hop') sq = e.z > 2 ? 2 : 0;
    else if (e.timer < 8) sq = 1;
    else sq = ((e.anim >> 4) & 1) ? 1 : 0;
    ctx.drawImage(slimeSprite(sq, fl), Math.round(e.x - 8), Math.round(e.y - 10 - e.z));
  } else {
    ctx.drawImage(beetleSprite(e.dir, (e.anim >> 3) & 1, fl), Math.round(e.x - 8), Math.round(e.y - 10));
    if (e.alert > 0) ctx.drawImage(BANG, Math.round(e.x - 2), Math.round(e.y - 24 - (e.alert > 28 ? 2 : 0)));
    else if (e.mode === 'search') ctx.drawImage(QUES, Math.round(e.x - 2), Math.round(e.y - 24 + ((tick >> 4) & 1)));
  }
}
function dots(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 4));
  ctx.fillStyle = c;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
}
// Depuração (tecla P): mapa de fluxo, perseguições e buscas dos besouros.
function drawPaths(ctx: Ctx, w: Scene, v: View) {
  const flow = w.flow; if (!flow) return;
  const tx0 = Math.floor(v.cam.x / TS), ty0 = Math.floor(v.cam.y / TS);
  for (let ty = ty0; ty <= ty0 + VIEW_H / TS; ty++) for (let tx = tx0; tx <= tx0 + VIEW_W / TS; tx++) {
    const d = distAt(flow, tx, ty); if (!isFinite(d)) continue;
    ctx.fillStyle = `hsla(${Math.round(35 + Math.min(1, d / 18) * 190)},85%,55%,0.3)`;
    ctx.fillRect(tx * TS, ty * TS, TS, TS);
    const n = nextLower(flow, tx, ty), cx = tx * TS + 8, cy = ty * TS + 8;
    ctx.fillStyle = 'rgba(20,14,30,0.6)';
    if (!n) { ctx.fillRect(cx - 1, cy - 1, 3, 3); continue; }
    const dx = n[0] - tx, dy = n[1] - ty;
    for (let r = -2; r <= 3; r++) ctx.fillRect(cx + dx * r, cy + dy * r, 1, 1);
    ctx.fillRect(cx + dx * 2 - dy, cy + dy * 2 - dx, 1, 1); ctx.fillRect(cx + dx * 2 + dy, cy + dy * 2 + dx, 1, 1);
  }
  for (const e of w.enemies) {
    if (e.type !== 'beetle') continue;
    if (e.mode === 'chase' && v.me) dots(ctx, e.x, e.y - 2, v.me.x, v.me.y - 4, '#ff5a5a');
    else if (e.mode === 'search' && e.lastSeen) {
      const lx = e.lastSeen[0] * TS + 8, ly = e.lastSeen[1] * TS + 8;
      dots(ctx, e.x, e.y - 2, lx, ly, '#ffe66b');
      ctx.fillStyle = '#ffe66b'; for (let k = -2; k <= 2; k++) { ctx.fillRect(lx + k, ly + k, 1, 1); ctx.fillRect(lx + k, ly - k, 1, 1); }
    } else { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, 96, 0, Math.PI * 2); ctx.stroke(); }
  }
}
// Marca da ajuda na mira: quatro cantinhos em volta do alvo, pulsando.
function drawLock(ctx: Ctx, t: { x: number; y: number }, tick: number) {
  const r = 9 + ((tick >> 3) & 1), x = Math.round(t.x), y = Math.round(t.y);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = x + sx * r, cy = y + sy * r;
    ctx.fillStyle = '#1b1226'; ctx.fillRect(cx - (sx > 0 ? 3 : 0) - 1, cy - 1, 5, 3); ctx.fillRect(cx - 1, cy - (sy > 0 ? 3 : 0) - 1, 3, 5);
    ctx.fillStyle = '#ffe66b'; ctx.fillRect(cx - (sx > 0 ? 2 : 0), cy, 3, 1); ctx.fillRect(cx, cy - (sy > 0 ? 2 : 0), 1, 3);
  }
}
function drawReticle(ctx: Ctx, r: { x: number; y: number }) {
  const x = Math.round(r.x), y = Math.round(r.y);
  const ticks = [[-5, 0, 3, 1], [3, 0, 3, 1], [0, -5, 1, 3], [0, 3, 1, 3]];
  ctx.fillStyle = '#1b1226';
  ticks.forEach(([a, b, w, h]) => ctx.fillRect(x + a - 1, y + b - 1, w + 2, h + 2)); ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = '#fff7d6'; ticks.forEach(([a, b, w, h]) => ctx.fillRect(x + a, y + b, w, h));
  ctx.fillStyle = '#f2a24e'; ctx.fillRect(x, y, 1, 1);
}

export function render(ctx: Ctx, w: Scene, v: View) {
  const wf = ((v.tick / 24) | 0) % 4;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  let sx = 0, sy = 0;
  if (v.shake > 0) { sx = ((Math.random() * 5) | 0) - 2; sy = ((Math.random() * 5) | 0) - 2; }
  const cx = Math.round(v.cam.x), cy = Math.round(v.cam.y);
  ctx.setTransform(1, 0, 0, 1, sx - cx, sy - cy);
  drawTiles(ctx, w.map, cx, cy, VIEW_W, VIEW_H, wf);
  if (v.showPaths) drawPaths(ctx, w, v);
  // só o que está perto da câmera entra na lista de desenho
  const near = (x: number, y: number) => x > cx - 32 && x < cx + VIEW_W + 32 && y > cy - 32 && y < cy + VIEW_H + 48;
  const list: { y: number; d: () => void }[] = [];
  for (const p of w.players) if (near(p.x, p.y)) {
    if (p.state !== 'dead' && p.state !== 'held') drawShadow(ctx, p.x, p.y + 1);
    list.push({ y: p.y, d: () => drawHero(ctx, w.map, p, w.profiles.get(p.id)?.look ?? DEFAULT_LOOK, v.tick, p.id === w.meId) });
  }
  for (const e of w.enemies) if (near(e.x, e.y)) {
    const flying = e.type === 'bat' || (e.type === 'chicken' && e.mode === 'chase');
    if (e.type === 'king') { const s = Math.max(0.5, 1 - e.z / 50); ctx.drawImage(SHADOW, Math.round(e.x - 13 * s), Math.round(e.y - 2), Math.round(26 * s), 6); }
    else if (flying) ctx.drawImage(SHADOW, Math.round(e.x - 4), Math.round(e.y - 1), 8, 3); else drawShadow(ctx, e.x, e.y + 2);
    list.push({ y: flying ? e.y + 20 : e.y, d: () => drawEnemy(ctx, e, v.tick) });   // morcego voa: desenhado por cima
  }
  for (const n of w.npcs) {
    const x = n.x * TS + 8, y = n.y * TS + 12;
    if (!near(x, y)) continue;
    let dir = n.dir;
    if (v.talking === `${n.x},${n.y}` && v.me) { const dx = v.me.x - x, dy = v.me.y - y; dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0); }
    drawShadow(ctx, x, y + 1);
    list.push({ y, d: () => ctx.drawImage(heroSprite(dir, 0, 'n', n.look.cloak, n.look.hair), x - 9, y - 13) });
  }
  for (const c of w.chests) {
    const x = c.x * TS, y = c.y * TS;
    if (near(x + 8, y + 8)) list.push({ y: y + 12, d: () => ctx.drawImage(c.open ? CHEST.open : CHEST.closed, x, y + 2) });
  }
  // Drops: flutuam de leve; os reservados a outro jogador ficam meio apagados; piscam antes de sumir.
  for (const d of w.drops) {
    if (!near(d.x, d.y) || (d.fading && (v.tick >> 3) & 1)) continue;
    const bob = Math.round(Math.sin((v.tick + d.id * 13) / 14) * 1.5);
    list.push({ y: d.y - 1, d: () => {
      ctx.globalAlpha = d.reserved ? 0.45 : 1;
      ctx.drawImage(SHADOW, Math.round(d.x - 7), Math.round(d.y - 2), 14, 4);
      ctx.drawImage(ITEM_ICON[d.item], Math.round(d.x - 5), Math.round(d.y - 12 + bob));
      ctx.globalAlpha = 1;
    } });
  }
  for (const o of w.thrown) if (near(o.x, o.y)) { drawShadow(ctx, o.x, o.y); list.push({ y: o.y, d: () => o.type === 'bomb' ? ctx.drawImage(bombFrame(100, v.tick), Math.round(o.x - 6), Math.round(o.y - 9 - o.z)) : ctx.drawImage(OBJ[o.type], Math.round(o.x - 8), Math.round(o.y - 8 - o.z)) }); }
  for (const b of w.bombs) if (near(b.x, b.y)) { ctx.drawImage(SHADOW, Math.round(b.x - 5), Math.round(b.y - 1), 10, 4); list.push({ y: b.y, d: () => ctx.drawImage(bombFrame(b.fuse, v.tick), Math.round(b.x - 6), Math.round(b.y - 11)) }); }
  for (const a of w.arrows) {
    if (!near(a.x, a.y) || (a.stuck && a.stuck < 10 && (a.stuck & 2))) continue;
    list.push({ y: a.y, d: () => drawArrow(ctx, a.x - Math.cos(a.ang) * 5, a.y - 6 - Math.sin(a.ang) * 5, a.ang) });
  }
  list.sort((a, b) => a.y - b.y).forEach(i => i.d());
  v.particles.draw(ctx);
  if (v.lock) drawLock(ctx, v.lock, v.tick);
  torchFlames(ctx, w, cx, cy, v.tick);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawLight(ctx, w, cx - sx, cy - sy, v.tick);
  if (v.reticle) drawReticle(ctx, v.reticle);
}

/* ---------- Tochas e luz ---------- */
function visibleTiles(w: Scene, cx: number, cy: number, f: (tx: number, ty: number, c: string) => void) {
  for (let ty = Math.max(0, Math.floor(cy / TS) - 1); ty <= Math.min(w.map.rows - 1, Math.floor((cy + VIEW_H) / TS) + 1); ty++)
    for (let tx = Math.max(0, Math.floor(cx / TS) - 1); tx <= Math.min(w.map.cols - 1, Math.floor((cx + VIEW_W) / TS) + 1); tx++) f(tx, ty, w.map.tiles[ty][tx]);
}
// Chama tremulando por cima do desenho fixo da tocha.
function torchFlames(ctx: Ctx, w: Scene, cx: number, cy: number, tick: number) {
  visibleTiles(w, cx, cy, (tx, ty, c) => {
    if (c !== 't') return;
    const k = hash(tx, ty, tick >> 3), x = tx * TS, y = ty * TS;
    ctx.fillStyle = k < 0.5 ? '#f5c542' : '#ee8b3d'; ctx.fillRect(x + 7 + (k < 0.3 ? -1 : 0), y + 1 - (k > 0.7 ? 1 : 0), 2, 2);
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(x + 7 + (k > 0.5 ? 1 : 0), y + 2, 1, 1);
  });
}
// Escuridão da noite (ou da caverna) com buracos de luz em degraus, no estilo pixel art.
const lightCv = mk(VIEW_W, VIEW_H), lctx = lightCv.getContext('2d')!;
function drawLight(ctx: Ctx, w: Scene, cx: number, cy: number, tick: number) {
  const sun = w.dark ? 0 : sunlight(w.day), h = w.day * 24;
  const dusk = !w.dark && ((h >= 16.5 && h < 19.5) || (h >= 4.5 && h < 7)) ? 1 - Math.abs(sun - 0.5) * 2 : 0;
  if (dusk > 0) { ctx.fillStyle = `rgba(255,130,60,${(0.16 * dusk).toFixed(3)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }   // entardecer e amanhecer alaranjados
  const dark = w.dark ? 0.8 : (1 - sun) * 0.74;
  if (dark < 0.02) return;
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, VIEW_W, VIEW_H);
  lctx.fillStyle = `rgba(6,8,26,${dark.toFixed(3)})`; lctx.fillRect(0, 0, VIEW_W, VIEW_H);
  lctx.globalCompositeOperation = 'destination-out';
  const hole = (x: number, y: number, r: number) => {
    for (const [f, a] of [[1, 0.35], [0.72, 0.35], [0.45, 0.4]] as const) { lctx.fillStyle = `rgba(0,0,0,${a})`; lctx.beginPath(); lctx.arc(Math.round(x - cx), Math.round(y - cy), r * f, 0, Math.PI * 2); lctx.fill(); }
  };
  for (const p of w.players) if (p.state !== 'dead') hole(p.x, p.y - 6, p.id === w.meId ? 42 : 32);   // cada um carrega uma luz pequena
  visibleTiles(w, cx, cy, (tx, ty, c) => {
    if (c === 't') hole(tx * TS + 8, ty * TS + 3, 62 + Math.round(hash(tx, ty, tick >> 4) * 4));
    else if (c === 'u') hole(tx * TS + 8, ty * TS + 6, 26);
    else if (c === 'h') hole(tx * TS + 8, ty * TS + 10, 18);
  });
  ctx.drawImage(lightCv, 0, 0);
}

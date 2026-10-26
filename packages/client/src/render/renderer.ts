import { DEFAULT_LOOK, TS, VIEW_H, VIEW_W, angDir, distAt, nextLower, swordPose, type EnemyView, type Look, type PlayerView, type SwordPose, type WorldMap } from '@vale/shared';
import type { Camera } from '../camera';
import type { Scene } from '../session/types';
import type { Particles } from './particles';
import { BANG, ITEM_ICON, OBJ, QUES, SHADOW, beetleSprite, heroSprite, slimeSprite } from './sprites';
import { drawTiles } from './tiles';

type Ctx = CanvasRenderingContext2D;
export interface View { me: PlayerView | undefined; cam: Camera; particles: Particles; showPaths: boolean; reticle: { x: number; y: number } | null; shake: number; tick: number }

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
function drawHero(ctx: Ctx, map: WorldMap, p: PlayerView, look: Look, tick: number, mine: boolean) {
  if (p.state === 'dead') { drawFallen(ctx, p, look); return; }
  const blink = p.inv > 0 && ((p.inv >> 2) & 1);
  const s = swordPose(p);
  const dir = p.state === 'spin' && s ? angDir(s.ang) : p.dir;
  const bow = p.state === 'bow';
  const pose = (p.state === 'lift' || p.state === 'carry') ? 'lift' : ((s || bow) ? 'atk' : 'n');
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
  if (p.carry) {
    let cx = p.x, cy = p.y - p.z - 20 + (p.step ? ((p.walkT >> 3) & 1) : 0);
    if (p.state === 'lift' && p.liftFrom) {
      const t = Math.min(1, p.t / 12);
      cx = p.liftFrom.x + (p.x - p.liftFrom.x) * t;
      cy = p.liftFrom.y + (p.y - 20 - p.liftFrom.y) * t - Math.sin(t * Math.PI) * 6;
    }
    ctx.drawImage(OBJ[p.carry], Math.round(cx - 8), Math.round(cy - 8));
  }
  if (!mine && p.hp < p.maxHp && !p.carry) drawLifeBar(ctx, p);
}
function drawEnemy(ctx: Ctx, e: EnemyView, tick: number) {
  const fl = e.hurtT > 0 && ((e.hurtT >> 1) & 1) === 1;
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
    if (p.state !== 'dead') drawShadow(ctx, p.x, p.y + 1);
    list.push({ y: p.y, d: () => drawHero(ctx, w.map, p, w.profiles.get(p.id)?.look ?? DEFAULT_LOOK, v.tick, p.id === w.meId) });
  }
  for (const e of w.enemies) if (near(e.x, e.y)) { drawShadow(ctx, e.x, e.y + 2); list.push({ y: e.y, d: () => drawEnemy(ctx, e, v.tick) }); }
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
  for (const o of w.thrown) if (near(o.x, o.y)) { drawShadow(ctx, o.x, o.y); list.push({ y: o.y, d: () => ctx.drawImage(OBJ[o.type], Math.round(o.x - 8), Math.round(o.y - 8 - o.z)) }); }
  for (const a of w.arrows) {
    if (!near(a.x, a.y) || (a.stuck && a.stuck < 10 && (a.stuck & 2))) continue;
    list.push({ y: a.y, d: () => drawArrow(ctx, a.x - Math.cos(a.ang) * 5, a.y - 6 - Math.sin(a.ang) * 5, a.ang) });
  }
  list.sort((a, b) => a.y - b.y).forEach(i => i.d());
  v.particles.draw(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (v.reticle) drawReticle(ctx, v.reticle);
}

import { unpackArrow, unpackBomb, unpackDrop, unpackEnemy, unpackPlayer, unpackThrown, type ArrowView, type BombView, type DropView, type EnemyView, type PlayerView, type SnapshotMsg, type ThrownView } from '@vale/shared';

// Os outros jogadores e os monstros são desenhados um pouco no passado, entre dois snapshots,
// para o movimento sair liso mesmo recebendo só 20 atualizações por segundo.
export interface Frame { t: number; players: Map<string, PlayerView>; enemies: Map<number, EnemyView>; thrown: Map<number, ThrownView>; arrows: Map<number, ArrowView>; drops: DropView[]; bombs: BombView[] }

export function toFrame(s: SnapshotMsg): Frame {
  return {
    t: s.t,
    players: new Map(s.p.map(t => { const v = unpackPlayer(t); return [v.id, v]; })),
    enemies: new Map(s.e.map(t => { const v = unpackEnemy(t); return [v.id, v]; })),
    thrown: new Map(s.o.map(t => { const v = unpackThrown(t); return [v.id, v]; })),
    arrows: new Map(s.a.map(t => { const v = unpackArrow(t); return [v.id, v]; })),
    drops: s.d.map(unpackDrop),   // drops e bombas ficam parados: não precisam de interpolação
    bombs: (s.b ?? []).map(unpackBomb)
  };
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpi = (a: number, b: number, k: number) => Math.round(lerp(a, b, k));
function lerpAng(a: number, b: number, k: number) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; }

function mix<K, V>(a: Map<K, V>, b: Map<K, V>, k: number, f: (a: V, b: V, k: number) => V): V[] {
  const out: V[] = [];
  for (const [id, vb] of b) { const va = a.get(id); out.push(va ? f(va, vb, k) : vb); }
  return out;
}
const mixPlayer = (a: PlayerView, b: PlayerView, k: number): PlayerView => ({
  ...b, x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k), aim: lerpAng(a.aim, b.aim, k),
  t: a.state === b.state ? lerpi(a.t, b.t, k) : b.t, walkT: lerpi(a.walkT, b.walkT, k), inv: lerpi(a.inv, b.inv, k)
});
const mixEnemy = (a: EnemyView, b: EnemyView, k: number): EnemyView => ({
  ...b, x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k), anim: lerpi(a.anim, b.anim, k), hurtT: lerpi(a.hurtT, b.hurtT, k),
  ...(a.mode === b.mode ? { timer: lerpi(a.timer, b.timer, k), alert: lerpi(a.alert, b.alert, k) } : {})
});
const mixThrown = (a: ThrownView, b: ThrownView, k: number): ThrownView => ({ ...b, x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) });
const mixArrow = (a: ArrowView, b: ArrowView, k: number): ArrowView => ({ ...b, x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

export class Interpolator {
  private frames: Frame[] = [];
  push(f: Frame) {
    if (this.frames.length && f.t <= this.frames[this.frames.length - 1].t) return;   // chegou fora de ordem
    this.frames.push(f);
    if (this.frames.length > 30) this.frames.shift();
  }
  clear() { this.frames = []; }
  at(t: number) {
    const fs = this.frames;
    if (!fs.length) return { players: [], enemies: [], thrown: [], arrows: [], drops: [], bombs: [] };
    let i = fs.length - 1;
    while (i > 0 && fs[i].t > t) i--;
    while (i > 1 && fs.length > 3 && fs[0].t < fs[i - 1].t) fs.shift(), i--;   // descarta o que já passou
    const a = fs[i], b = fs[Math.min(i + 1, fs.length - 1)];
    const k = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1;
    return {
      players: mix(a.players, b.players, k, mixPlayer), enemies: mix(a.enemies, b.enemies, k, mixEnemy),
      thrown: mix(a.thrown, b.thrown, k, mixThrown), arrows: mix(a.arrows, b.arrows, k, mixArrow), drops: b.drops, bombs: b.bombs
    };
  }
}

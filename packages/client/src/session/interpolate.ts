import { unpackArrow, unpackBomb, unpackDrop, unpackEnemy, unpackPlayer, unpackSpell, unpackThrown, type SpellView, type ArrowView, type BombView, type DropView, type EnemyView, type PlayerView, type SnapshotMsg, type ThrownView } from '@vale/shared';

// Os outros jogadores e os monstros são desenhados um pouco no passado, entre dois snapshots,
// para o movimento sair liso mesmo recebendo só 20 atualizações por segundo.
export interface Frame { t: number; players: Map<string, PlayerView>; enemies: Map<number, EnemyView>; thrown: Map<number, ThrownView>; arrows: Map<number, ArrowView>; spells: Map<number, SpellView>; drops: DropView[]; bombs: BombView[] }

export function toFrame(s: SnapshotMsg): Frame {
  return {
    t: s.t,
    players: new Map(s.p.map(t => { const v = unpackPlayer(t); return [v.id, v]; })),
    enemies: new Map(s.e.map(t => { const v = unpackEnemy(t); return [v.id, v]; })),
    thrown: new Map(s.o.map(t => { const v = unpackThrown(t); return [v.id, v]; })),
    arrows: new Map(s.a.map(t => { const v = unpackArrow(t); return [v.id, v]; })),
    spells: new Map((s.m ?? []).map(t => { const v = unpackSpell(t); return [v.id, v]; })),
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
const mixSpell = (a: SpellView, b: SpellView, k: number): SpellView => ({ ...b, x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

// Snapshot atrasado: quem estava andando segue no mesmo rumo por alguns passos, em vez de congelar e depois pular.
// Salto grande entre dois snapshots (renasceu, trocou de lugar) não é movimento: fica parado.
const MAX_AHEAD = 5, TELEPORT = 24;
function ahead<V extends { x: number; y: number; z: number }>(a: Map<unknown, V>, b: Map<unknown, V>, k: number): V[] {
  const out: V[] = [];
  for (const [id, vb] of b) {
    const va = a.get(id);
    out.push(va && Math.abs(vb.x - va.x) + Math.abs(vb.y - va.y) < TELEPORT ? { ...vb, x: lerp(va.x, vb.x, k), y: lerp(va.y, vb.y, k), z: Math.max(0, lerp(va.z, vb.z, k)) } : vb);
  }
  return out;
}

/* Relógio do servidor visto daqui, pelo relógio de verdade (não pelos passos locais: num aparelho lento os passos atrasam
   e o relógio confundiria lentidão com rede). Mede o quanto os snapshots chegam atrasados nos últimos ~2 s e soma ao
   atraso da cena o que cobre 9 em cada 10 deles, até MAX_EXTRA. Paradas maiores que isso nenhum atraso esconde
   (a extrapolação cobre um pouco); esperar mais só deixaria o golpe mais atrasado. A mudança é gradual, para a cena não
   voltar no tempo. */
const STEP_MS = 1000 / 60, MAX_EXTRA = 6, WINDOW = 40;   // passos; snapshots lembrados
export class SnapshotClock {
  private offset = NaN;          // ms do servidor (passo × duração) menos o relógio local
  private late: number[] = [];   // atraso de cada snapshot recente, em passos
  private extra = 0;             // atraso a mais em uso, em passos
  push(serverTick: number, now: number) {
    const est = serverTick * STEP_MS - now;
    if (Number.isNaN(this.offset) || Math.abs(est - this.offset) > 500) { this.offset = est; this.late = []; return; }
    this.late.push(Math.max(0, (this.offset - est) / STEP_MS));
    if (this.late.length > WINDOW) this.late.shift();
    const sorted = [...this.late].sort((a, b) => a - b), target = Math.min(MAX_EXTRA, sorted[Math.floor(sorted.length * 0.9)]);
    this.extra += Math.max(-0.05, Math.min(0.5, target - this.extra));
    this.offset += (est - this.offset) * 0.05;
  }
  reset() { this.offset = NaN; this.late = []; this.extra = 0; }
  ready() { return !Number.isNaN(this.offset); }
  tick(now: number) { return (now + this.offset) / STEP_MS; }   // passo do servidor agora (fracionado: a cena anda a cada quadro)
  delay(sendEvery: number) { return sendEvery * 2 + 2 + this.extra; }
}

export class Interpolator {
  private frames: Frame[] = [];
  ahead = 0; frozen = 0;   // quadros desenhados além do último snapshot: seguindo o rumo / já parados
  push(f: Frame) {
    if (this.frames.length && f.t <= this.frames[this.frames.length - 1].t) return;   // chegou fora de ordem
    this.frames.push(f);
    if (this.frames.length > 30) this.frames.shift();
  }
  clear() { this.frames = []; }
  at(t: number) {
    const fs = this.frames;
    if (!fs.length) return { players: [], enemies: [], thrown: [], arrows: [], spells: [], drops: [], bombs: [] };
    const last = fs[fs.length - 1];
    if (t > last.t) { if (t - last.t > MAX_AHEAD || fs.length < 2) this.frozen++; else this.ahead++; }   // para o /debug
    if (t > last.t && fs.length > 1) {
      const prev = fs[fs.length - 2], k = 1 + Math.min(t - last.t, MAX_AHEAD) / (last.t - prev.t);
      return {
        players: ahead(prev.players, last.players, k), enemies: ahead(prev.enemies, last.enemies, k),
        thrown: [...last.thrown.values()], arrows: [...last.arrows.values()], spells: [...last.spells.values()], drops: last.drops, bombs: last.bombs
      };
    }
    let i = fs.length - 1;
    while (i > 0 && fs[i].t > t) i--;
    while (i > 1 && fs.length > 3 && fs[0].t < fs[i - 1].t) fs.shift(), i--;   // descarta o que já passou
    const a = fs[i], b = fs[Math.min(i + 1, fs.length - 1)];
    const k = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1;
    return {
      players: mix(a.players, b.players, k, mixPlayer), enemies: mix(a.enemies, b.enemies, k, mixEnemy),
      thrown: mix(a.thrown, b.thrown, k, mixThrown), arrows: mix(a.arrows, b.arrows, k, mixArrow), spells: mix(a.spells, b.spells, k, mixSpell), drops: b.drops, bombs: b.bombs
    };
  }
}

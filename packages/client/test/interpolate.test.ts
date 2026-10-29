import { describe, expect, it } from 'vitest';
import type { EnemyView } from '@vale/shared';
import { Interpolator, SnapshotClock, type Frame } from '../src/session/interpolate';

const slime = (x: number, z = 0) => ({ id: 1, type: 'slime', x, y: 50, z, dir: 0, mode: 'idle', timer: 0, anim: 0, hurtT: 0, alert: 0, lastSeen: null, hp: 20, maxHp: 20, slowed: false, mini: false }) as EnemyView;
const frame = (t: number, ...enemies: EnemyView[]): Frame =>
  ({ t, players: new Map(), enemies: new Map(enemies.map(e => [e.id, e])), thrown: new Map(), arrows: new Map(), spells: new Map(), drops: [], bombs: [] });

describe('interpolação', () => {
  it('entre dois snapshots, mistura as posições', () => {
    const it = new Interpolator(); it.push(frame(0, slime(0))); it.push(frame(3, slime(3)));
    expect(it.at(1).enemies[0].x).toBeCloseTo(1);
  });
  it('snapshot atrasado: segue no mesmo rumo por alguns passos em vez de congelar', () => {
    const it = new Interpolator(); it.push(frame(0, slime(0, 6))); it.push(frame(3, slime(3, 3)));
    const e = it.at(5).enemies[0];
    expect(e.x).toBeCloseTo(5);
    expect(e.z).toBeCloseTo(1);
    expect(it.at(100).enemies[0].x).toBeCloseTo(8);   // no máximo 5 passos adiante
    expect(it.at(100).enemies[0].z).toBe(0);           // não afunda no chão
  });
  it('salto grande (renasceu) não vira movimento', () => {
    const it = new Interpolator(); it.push(frame(0, slime(0))); it.push(frame(3, slime(200)));
    expect(it.at(5).enemies[0].x).toBe(200);
  });
});

describe('relógio dos snapshots', () => {
  const MS = 1000 / 60;
  // um snapshot a cada 3 passos; late[i] = quantos passos o i-ésimo chegou atrasado
  const feed = (c: SnapshotClock, late: number[], from = 0) => late.forEach((l, i) => c.push((from + i) * 3, ((from + i) * 3 + l) * MS));
  it('rede estável: atraso mínimo, e a cena anda com o relógio de verdade', () => {
    const c = new SnapshotClock(); feed(c, Array(200).fill(0));
    expect(c.delay(3)).toBeCloseTo(8);
    expect(c.tick(600 * MS)).toBeCloseTo(600);
  });
  it('rede que oscila: o atraso cresce aos poucos até cobrir os atrasos vistos', () => {
    const c = new SnapshotClock(); feed(c, [0]);
    feed(c, [6], 1); expect(c.delay(3)).toBeCloseTo(8.5);   // não pula de uma vez (a cena voltaria no tempo)
    feed(c, Array(40).fill(0).map((_, i) => i % 4 === 0 ? 5 : 0), 2);
    expect(c.delay(3)).toBeGreaterThan(11);
  });
  it('parada longa não estica o atraso além do limite (só deixaria o golpe mais atrasado)', () => {
    const c = new SnapshotClock(); feed(c, [0]); feed(c, Array(60).fill(0).map((_, i) => i % 2 ? 25 : 0), 1);
    expect(c.delay(3)).toBeLessThanOrEqual(14);
  });
  it('rede acalma: o atraso volta devagar', () => {
    const c = new SnapshotClock(); feed(c, [0]); feed(c, Array(40).fill(0).map((_, i) => i % 3 ? 0 : 6), 1);
    const high = c.delay(3);
    feed(c, Array(400).fill(0), 41);
    expect(c.delay(3)).toBeLessThan(high);
  });
});

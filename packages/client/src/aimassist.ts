import { FACE, type EnemyView, type PlayerView } from '@vale/shared';

// Ajuda na mira para quem joga no celular: ao atacar, mira (e vira o personagem) para um alvo.
// Prefere o que está à frente (para onde o joystick aponta, ou para onde o personagem olha se estiver parado),
// mas quem está bem perto em qualquer direção também conta, e o personagem se vira sozinho para ele:
// pontos = distância × (1 + desvio) à frente, distância × 1,6 fora do cone (só até AROUND); ganha o menor.
// Só vale o que dá para atacar: monstros (galinha não, para ninguém chamar o bando sem querer) e jogadores com PvP ativo dos dois lados.
const RANGE = 120, CONE = 1.2, AROUND = 80;   // px, radianos (~70° para cada lado) e px em volta

export function assistTarget(me: PlayerView, enemies: readonly EnemyView[], players: readonly PlayerView[], move: { x: number; y: number }): { x: number; y: number } | null {
  const base = move.x || move.y ? Math.atan2(move.y, move.x) : FACE[me.dir];
  let best: { x: number; y: number } | null = null, score = Infinity;
  const consider = (x: number, y: number) => {
    const dx = x - me.x, dy = y - (me.y - 6), d = Math.hypot(dx, dy);
    if (d > RANGE || d < 1) return;
    const a = Math.atan2(dy, dx), diff = Math.abs(Math.atan2(Math.sin(a - base), Math.cos(a - base)));
    const s = diff <= CONE ? d * (1 + diff) : d <= AROUND ? d * 1.6 : Infinity;
    if (s < score) { score = s; best = { x, y }; }
  };
  for (const e of enemies) if (e.type !== 'chicken' && e.hp > 0) consider(e.x, e.y - 4 - e.z);
  if (me.pvpActive) for (const p of players) if (p.id !== me.id && p.pvpActive && p.state !== 'dead') consider(p.x, p.y - 6);
  return best;
}

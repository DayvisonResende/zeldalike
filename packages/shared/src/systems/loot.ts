import { ticks } from '../constants';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { ITEMS, addItem, canFit, takeItem, type LootId } from '../items';
import type { DropRule } from '../rules';
import { useBomb } from './bombs';
import type { World } from '../world';
import { sfx } from './fx';

/* ---------- Drops no chão ---------- */
export interface Drop {
  id: number; item: LootId; n: number; x: number; y: number;
  owner: string | null; ownerUntil: number;   // só o dono pega até ownerUntil; depois, qualquer um
  expires: number; born: number;
}
export const PICK_RANGE = 14;    // pegar com o botão: o item mais perto até essa distância
export const SWEEP_RANGE = 40;   // segurar o botão: tudo em volta até essa distância
export const SWEEP_HOLD = 24;    // passos segurando o botão para pegar tudo

function spawnDrop(w: World, item: LootId, n: number, x: number, y: number, owner: string | null) {
  const d: Drop = { id: w.nextId++, item, n, x, y, owner, ownerUntil: owner ? w.tick + ticks(w.rules.loot.ownerTime) : 0, expires: w.tick + ticks(w.rules.loot.lifetime), born: w.tick };
  w.drops.push(d);
  return d;
}
// Sorteia uma tabela de drop: o que saiu e quanto.
export function rollLoot(w: World, list: DropRule[], dropRate = w.rules.rates.drop) {
  const out: { item: LootId; n: number }[] = [];
  for (const d of list) {
    if (w.rng.next() >= Math.min(1, d.chance * dropRate)) continue;
    let n = d.min + w.rng.int(d.max - d.min + 1);
    if (d.item === 'gold') n = Math.max(1, Math.round(n * w.rules.rates.gold));
    out.push({ item: d.item, n });
  }
  return out;
}
// Sorteia uma lista de drops e espalha em volta de um ponto, reservada a `owner`.
export function spawnLoot(w: World, list: DropRule[], x: number, y: number, owner: string | null, dropRate = w.rules.rates.drop) {
  rollLoot(w, list, dropRate).forEach(({ item, n }, k) => {
    const a = k * 2.4;   // espalha um pouco em volta
    spawnDrop(w, item, n, x + Math.cos(a) * (k ? 7 : 0), y + Math.sin(a) * (k ? 5 : 0), owner);
  });
}
// Monstro derrubado: sorteia a tabela dele; o loot fica reservado a quem deu o último golpe.
export function dropLoot(w: World, e: Enemy, killer: Player | undefined) {
  spawnLoot(w, w.rules.enemies[e.type].drops, e.x, e.y, killer?.id ?? null);
}
export const lootName = (item: LootId, n: number) => item === 'gold' ? `${n} de ouro` : `${n > 1 ? n + ' ' : ''}${ITEMS[item].name}`;

/* ---------- Pegar com o botão de Ação (B) ---------- */
// O item fica no chão até alguém apertar B perto dele; segurar B pega tudo em volta.
// Reservado: só o dono pega até ownerUntil. Recém-caído: espera um instante (deixa "cair").
export const canPick = (w: World, p: Player, d: Drop) => d.n > 0 && w.tick - d.born >= 12 && (!d.owner || d.owner === p.id || w.tick >= d.ownerUntil);
const dist = (p: Player, d: Drop) => Math.hypot(d.x - p.x, d.y - p.y);
export function nearestDrop(w: World, p: Player, range = PICK_RANGE) {
  let best: Drop | null = null, bd = range;
  for (const d of w.drops) if (canPick(w, p, d) && dist(p, d) <= bd) { bd = dist(p, d); best = d; }
  return best;
}
// Põe o drop na mochila (ouro, na carteira). Devolve o quanto pegou.
// Na previsão do cliente só diz que pegaria: quem entrega de verdade é o servidor.
function take(w: World, p: Player, d: Drop) {
  if (w.predicting) return d.n;
  const stack = w.rules.inventory.stack;
  let got = d.n;
  if (d.item === 'gold') p.gold += d.n;
  else {
    if (!canFit(p.bag, d.item, stack)) { notice(w, p, 'Inventário cheio.'); return 0; }
    got = d.n - addItem(p.bag, d.item, d.n, stack);
    p.bagVersion++;
  }
  d.n -= got;
  w.emit({ t: 'gain', to: p.id, x: p.x, y: p.y, text: '+' + lootName(d.item, got) });
  return got;
}
// B apertado perto de um item: pega o mais perto. Devolve true se havia item (o B não faz outra coisa).
export function pickNearest(w: World, p: Player) {
  const d = nearestDrop(w, p);
  if (!d) return false;
  if (take(w, p, d) && !w.predicting) sfx(w, 'pickup', p);
  return true;
}
// B segurado: pega tudo em volta (do mais perto para o mais longe).
export function pickAll(w: World, p: Player) {
  const near = w.drops.filter(d => canPick(w, p, d) && dist(p, d) <= SWEEP_RANGE).sort((a, b) => dist(p, a) - dist(p, b));
  let n = 0;
  for (const d of near) if (take(w, p, d)) n++;
  if (n && !w.predicting) sfx(w, 'pickup', p);
  return n;
}

// Uma vez por passo: some o que expirou ou já foi pego.
export function updateLoot(w: World) {
  w.drops = w.drops.filter(d => d.expires > w.tick && d.n > 0);
}
const noticeAt = new WeakMap<Player, number>();
function notice(w: World, p: Player, text: string) {
  if (w.tick - (noticeAt.get(p) ?? -1e9) < 120) return;   // no máximo um aviso a cada 2 s
  noticeAt.set(p, w.tick); w.emit({ t: 'notice', to: p.id, text });
}

/* ---------- Usar e largar ---------- */
export type ItemResult = { ok: true } | { ok: false; reason: string };
const USE_COOLDOWN = 30;   // passos entre um item e outro (meio segundo)

export function useItem(w: World, p: Player, slot: number): ItemResult {
  const s = p.bag[slot];
  if (!s) return { ok: false, reason: 'Esse espaço está vazio.' };
  if (p.state === 'dead') return { ok: false, reason: 'Você está caído.' };
  const def = ITEMS[s.id];
  if (s.id === 'bomb') {
    if (p.carry || p.state === 'fish') return { ok: false, reason: 'Mãos ocupadas.' };
    if (w.tick - p.useAt < USE_COOLDOWN) return { ok: false, reason: 'Calma, um de cada vez.' };
    p.useAt = w.tick; useBomb(w, p, slot); return { ok: true };
  }
  if (def.gear) return { ok: false, reason: `Equipe ${def.name} no A ou no C pelo inventário.` };
  if (!def.heal && !def.mana) return { ok: false, reason: `${def.name} não tem uso por enquanto.` };
  if (w.tick - p.useAt < USE_COOLDOWN) return { ok: false, reason: 'Calma, um de cada vez.' };
  if ((!def.heal || p.hp >= p.maxHp) && (!def.mana || p.mp >= p.maxMp)) return { ok: false, reason: def.heal ? 'Sua vida já está cheia.' : 'Sua mana já está cheia.' };
  if (def.heal) p.hp = Math.min(p.maxHp, p.hp + def.heal);
  if (def.mana) p.mp = Math.min(p.maxMp, p.mp + def.mana);
  takeItem(p.bag, slot); p.bagVersion++; p.useAt = w.tick;
  sfx(w, 'use', p);
  return { ok: true };
}
// Larga o espaço inteiro no chão, sem dono: qualquer um pode pegar (é assim que se passa item para um amigo).
export function dropItem(w: World, p: Player, slot: number): ItemResult {
  const s = p.bag[slot];
  if (!s) return { ok: false, reason: 'Esse espaço está vazio.' };
  if (p.state === 'dead') return { ok: false, reason: 'Você está caído.' };
  const n = takeItem(p.bag, slot, s.n); p.bagVersion++;
  const d = spawnDrop(w, s.id, n, p.x, p.y + 6, null);
  d.born = w.tick + 48;   // quem largou não pega de volta na hora sem querer
  return { ok: true };
}

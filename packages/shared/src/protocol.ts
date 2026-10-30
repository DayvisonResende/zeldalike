import type { Enemy } from './entities/enemy';
import type { Carryable, Player, PlayerState } from './entities/player';
import type { GameEvent } from './events';
import { emptyInput, type InputState } from './input';
import { cleanLook, cleanName, type Look, type Profile } from './looks';
import type { ItemDef, LootId, Slot } from './items';
import type { EnemyType } from './rules';
import type { Arrow, Thrown } from './systems/projectiles';
import type { PvpMode } from './systems/pvp';
import type { Spell, SpellKind } from './systems/magic';
import { DEFAULT_GEAR, type WearSlot } from './gear';
import type { MapData } from './world/map';

/* Mensagens entre cliente e servidor. Tudo em arrays curtos: com 100 jogadores, cada byte conta.
   Posições viajam em décimos de pixel e ângulos em milésimos de radiano, como inteiros. */
export const MSG = { hello: 'h', input: 'i', snapshot: 's', welcome: 'w', profile: 'p', chat: 'c', pvp: 'v', item: 't', shop: 'k', mark: 'm', party: 'g', rules: 'r', items: 'n', telemetry: 'y' } as const;   // rules: GearRules (números das armas), ao entrar e quando o config muda

/* ---------- Input: [seq, bits, mira] ---------- */
const HELD = ['up', 'down', 'left', 'right', 'a', 'b', 'c', 'd'] as const;
export type InputMsg = [seq: number, bits: number, aim: number | null];
export function encodeInput(seq: number, s: InputState): InputMsg {
  let bits = s.tap << 8;
  HELD.forEach((k, i) => { if (s[k]) bits |= 1 << i; });
  return [seq, bits, s.aim === null ? null : Math.round(s.aim * 1000)];
}
// Vem de fora, então nada é confiável: qualquer coisa estranha vira null.
export function decodeInput(m: unknown): { seq: number; input: InputState } | null {
  if (!Array.isArray(m) || m.length !== 3) return null;
  const [seq, bits, aim] = m;
  if (!Number.isSafeInteger(seq) || !Number.isInteger(bits) || bits < 0 || bits > 0xfff) return null;
  if (aim !== null && (!Number.isInteger(aim) || Math.abs(aim) > 7000)) return null;
  const input = emptyInput();
  HELD.forEach((k, i) => { input[k] = (bits & (1 << i)) !== 0; });
  input.tap = bits >> 8; input.aim = aim === null ? null : aim / 1000;
  return { seq, input };
}

/* ---------- O que o cliente precisa para desenhar cada coisa ---------- */
// Dos outros jogadores só chega o percentual de vida (hp de 0 a 100, maxHp = 100); a mana não é enviada.
export type PlayerView = Pick<Player, 'id' | 'x' | 'y' | 'z' | 'dir' | 'aim' | 'state' | 't' | 'step' | 'walkT' | 'inv' | 'carry' | 'liftFrom' | 'charged' | 'hp' | 'maxHp' | 'mp' | 'maxMp' | 'pvpActive' | 'pvp' | 'safe' | 'killer' | 'level' | 'fish' | 'heldBy' | 'gear' | 'using' | 'revive' | 'hook'> & { carryFuse?: number };
export type EnemyView = Pick<Enemy, 'id' | 'type' | 'x' | 'y' | 'z' | 'dir' | 'mode' | 'timer' | 'anim' | 'hurtT' | 'alert' | 'lastSeen' | 'hp' | 'maxHp' | 'slowed' | 'mini'>;
export type ThrownView = Pick<Thrown, 'id' | 'x' | 'y' | 'z' | 'type'>;
export type ArrowView = Pick<Arrow, 'id' | 'x' | 'y' | 'ang' | 'stuck'>;

const STATES: PlayerState[] = ['walk', 'hurt', 'lift', 'carry', 'throw', 'swing', 'spin', 'charge', 'dashprep', 'dash', 'bonk', 'hop', 'bow', 'dead', 'fish', 'held', 'flying', 'cast', 'hook'];
const MODES: Enemy['mode'][] = ['idle', 'hop', 'patrol', 'chase', 'search'];
// A ordem viaja pela rede: tipos novos sempre no fim.
const ENEMIES: EnemyType[] = ['slime', 'beetle', 'bat', 'chicken', 'king'];
const q = (v: number) => Math.round(v * 10), uq = (v: number) => v / 10;
const qa = (v: number) => Math.round(v * 1000), uqa = (v: number) => v / 1000;
const CARRY: (Carryable | null)[] = [null, 'b', 'r', 'bomb', 'player'];
const carryCode = (c: Carryable | null) => Math.max(0, CARRY.indexOf(c));
const carryOf = (n: number): Carryable | null => CARRY[n] ?? null;

export type PlayerTuple = [string, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, string, string, number, number, number];   // [19]: o equipamento em uso, pelo id ('' = nada); [21], [22]: ponta do gancho (-1 = sem)
export function packPlayer(p: PlayerView): PlayerTuple {
  return [p.id, q(p.x), q(p.y), q(p.z), p.dir, qa(p.aim), STATES.indexOf(p.state), p.t, p.step, p.walkT, p.inv, carryCode(p.carry),
    p.liftFrom ? q(p.liftFrom.x) : -1, p.liftFrom ? q(p.liftFrom.y) : -1, p.charged ? 1 : 0, p.maxHp > 0 ? Math.ceil(p.hp / p.maxHp * 100) : 0, p.pvpActive ? 1 : 0, p.level, p.heldBy ?? '', p.using ?? '', p.revive, p.hook ? q(p.hook.x) : -1, p.hook ? q(p.hook.y) : -1];
}
export function unpackPlayer(t: PlayerTuple): PlayerView {
  return { id: t[0], x: uq(t[1]), y: uq(t[2]), z: uq(t[3]), dir: t[4] as Player['dir'], aim: uqa(t[5]), state: STATES[t[6]] ?? 'walk', t: t[7], step: t[8], walkT: t[9], inv: t[10],
    carry: carryOf(t[11]), liftFrom: t[12] < 0 ? null : { x: uq(t[12]), y: uq(t[13]) }, charged: t[14] === 1, hp: t[15], maxHp: 100, mp: 0, maxMp: 0, pvpActive: t[16] === 1, pvp: t[16] === 1, safe: false, killer: null, level: t[17], fish: null, heldBy: t[18] || null, gear: { ...DEFAULT_GEAR }, using: t[19] || null, revive: t[20] ?? 0, hook: (t[21] ?? -1) < 0 ? null : { x: uq(t[21]), y: uq(t[22]), dx: 0, dy: 0, dist: 0, phase: 'out' } };
}
export type EnemyTuple = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];   // [16]: minichefe
export function packEnemy(e: EnemyView): EnemyTuple {
  return [e.id, ENEMIES.indexOf(e.type), q(e.x), q(e.y), q(e.z), e.dir, MODES.indexOf(e.mode), e.timer, e.anim, e.hurtT, e.alert, e.lastSeen ? e.lastSeen[0] : -1, e.lastSeen ? e.lastSeen[1] : -1, e.hp, e.maxHp, e.slowed ? 1 : 0, e.mini ? 1 : 0];
}
export function unpackEnemy(t: EnemyTuple): EnemyView {
  return { id: t[0], type: ENEMIES[t[1]], x: uq(t[2]), y: uq(t[3]), z: uq(t[4]), dir: t[5] as Enemy['dir'], mode: MODES[t[6]], timer: t[7], anim: t[8], hurtT: t[9], alert: t[10], lastSeen: t[11] < 0 ? null : [t[11], t[12]], hp: t[13], maxHp: t[14], slowed: t[15] === 1, mini: t[16] === 1 };
}
export type ThrownTuple = [number, number, number, number, number];
export const packThrown = (o: ThrownView): ThrownTuple => [o.id, q(o.x), q(o.y), q(o.z), carryCode(o.type)];
export const unpackThrown = (t: ThrownTuple): ThrownView => ({ id: t[0], x: uq(t[1]), y: uq(t[2]), z: uq(t[3]), type: carryOf(t[4]) ?? 'r' });
export type SpellView = Pick<Spell, 'id' | 'kind' | 'big' | 'x' | 'y'>;
export type SpellTuple = [number, number, number, number, number];
const SPELLS: SpellKind[] = ['fire', 'shadow'];
export const packSpell = (s: SpellView): SpellTuple => [s.id, SPELLS.indexOf(s.kind), s.big ? 1 : 0, q(s.x), q(s.y)];
export const unpackSpell = (t: SpellTuple): SpellView => ({ id: t[0], kind: SPELLS[t[1]] ?? 'fire', big: t[2] === 1, x: uq(t[3]), y: uq(t[4]) });
export type ArrowTuple = [number, number, number, number, number];
export const packArrow = (a: ArrowView): ArrowTuple => [a.id, q(a.x), q(a.y), qa(a.ang), a.stuck];
export const unpackArrow = (t: ArrowTuple): ArrowView => ({ id: t[0], x: uq(t[1]), y: uq(t[2]), ang: uqa(t[3]), stuck: t[4] });

// Drops no chão. `reserved`: ainda é de outro jogador (você não pega); `fading`: vai sumir logo.
export interface DropView { id: number; item: LootId; n: number; x: number; y: number; reserved: boolean; fading: boolean }
export type DropTuple = [number, LootId, number, number, number, number];   // o item vai pelo id (itens vêm de arquivos: não há ordem fixa)
export const packDrop = (d: DropView): DropTuple => [d.id, d.item, q(d.x), q(d.y), d.n, (d.reserved ? 1 : 0) | (d.fading ? 2 : 0)];
export const unpackDrop = (t: DropTuple): DropView => ({ id: t[0], item: t[1], x: uq(t[2]), y: uq(t[3]), n: t[4], reserved: (t[5] & 1) !== 0, fading: (t[5] & 2) !== 0 });
export interface ItemRequest { action: 'use' | 'drop'; slot: number }
// Bombas no chão: [id, x, y, pavio]
export type BombTuple = [number, number, number, number];
export interface BombView { id: number; x: number; y: number; fuse: number }
export const packBomb = (b: BombView): BombTuple => [b.id, q(b.x), q(b.y), b.fuse];
export const unpackBomb = (t: BombTuple): BombView => ({ id: t[0], x: uq(t[1]), y: uq(t[2]), fuse: t[3] });

/* ---------- Estado completo do próprio jogador (para a previsão no cliente) ---------- */
type OwnKeys = 'x' | 'y' | 'z' | 'push' | 'dvx' | 'dvy' | 'hop' | 'dir' | 'aim' | 'state' | 't' | 'step' | 'walkT' | 'inv' | 'kx' | 'ky' | 'carry' | 'liftFrom' | 'charge' | 'charged' | 'hp' | 'maxHp' | 'mp' | 'maxMp' | 'killer' | 'pvp' | 'pvpActive' | 'safe' | 'level' | 'xp' | 'gold' | 'inPortal' | 'portalWait' | 'steps' | 'fish' | 'carryFuse' | 'holding' | 'heldBy' | 'struggle' | 'prevDirs' | 'gear' | 'using' | 'useBtn' | 'big' | 'slowUntil' | 'shove' | 'holdB' | 'revive' | 'reviveBy' | 'stats' | 'fragments' | 'hook' | 'effects';
export type OwnState = Pick<Player, OwnKeys> & { hit: (number | string)[] };
export function ownState(p: Player): OwnState {
  return { x: p.x, y: p.y, z: p.z, push: p.push, dvx: p.dvx, dvy: p.dvy, hop: p.hop && { ...p.hop }, dir: p.dir, aim: p.aim, state: p.state, t: p.t, step: p.step, walkT: p.walkT,
    inv: p.inv, kx: p.kx, ky: p.ky, carry: p.carry, liftFrom: p.liftFrom && { ...p.liftFrom }, charge: p.charge, charged: p.charged, hit: [...p.hit],
    hp: Math.round(p.hp * 10) / 10, maxHp: p.maxHp, mp: Math.round(p.mp * 10) / 10, maxMp: p.maxMp,
    killer: p.killer, pvp: p.pvp, pvpActive: p.pvpActive, safe: p.safe, level: p.level, xp: p.xp, gold: p.gold, inPortal: p.inPortal, portalWait: p.portalWait, steps: p.steps, fish: p.fish && { ...p.fish }, carryFuse: p.carryFuse, holding: p.holding, heldBy: p.heldBy, struggle: p.struggle, prevDirs: p.prevDirs,
    gear: { ...p.gear }, using: p.using, useBtn: p.useBtn, big: p.big, slowUntil: p.slowUntil, shove: p.shove, holdB: p.holdB, revive: p.revive, reviveBy: p.reviveBy, stats: { ...p.stats }, fragments: [...p.fragments], hook: p.hook && { ...p.hook }, effects: { ...p.effects } };
}
export function applyOwnState(p: Player, s: OwnState) {
  const { hit, hop, liftFrom, fish, gear, stats, fragments, hook, effects, ...rest } = s;
  Object.assign(p, rest);
  p.gear = { ...gear }; p.stats = { ...stats }; p.fragments = [...fragments]; p.hook = hook && { ...hook }; p.effects = { ...effects };
  p.fish = fish && { ...fish };
  p.hop = hop && { ...hop }; p.liftFrom = liftFrom && { ...liftFrom }; p.hit = new Set(hit);
}
// O que a previsão do cliente simula do seu estado. Vida, mana, ouro, nível e afins vêm só do servidor (a previsão
// roda sem "life"): ficam de fora da comparação e são copiados à parte (applyOwnLife).
const OWN_LIFE = ['hp', 'maxHp', 'mp', 'maxMp', 'killer', 'pvp', 'pvpActive', 'safe', 'level', 'xp', 'gold', 'stats', 'fragments', 'effects'] as const;
export function ownSimKey(s: OwnState) { const o: Partial<OwnState> = { ...s }; for (const k of OWN_LIFE) delete o[k]; return JSON.stringify(o); }
export function applyOwnLife(p: Player, s: OwnState) {
  p.hp = s.hp; p.maxHp = s.maxHp; p.mp = s.mp; p.maxMp = s.maxMp; p.killer = s.killer; p.pvp = s.pvp; p.pvpActive = s.pvpActive; p.safe = s.safe;
  p.level = s.level; p.xp = s.xp; p.gold = s.gold; p.stats = { ...s.stats }; p.fragments = [...s.fragments]; p.effects = { ...s.effects };
}

/* ---------- Mensagens do servidor ---------- */
// `map`: o mapa do servidor (o cliente usa este, não o que veio no pacote do jogo); `tiles`: como o chão está agora.
// `at`: onde você está nesse mapa (ao entrar ou ao passar por um portal).
export interface WelcomeMsg {
  id: string; tick: number; tiles: string[]; sendEvery: number; motd: string; profiles: Profile[]; map: MapData; at: { x: number; y: number };
  mapId?: string;       // id do mapa (o de world.maps; numa masmorra, o do mapa, não o da cópia)
  explored?: string;    // tiles deste mapa que você já viu (bits em base64)
  safe?: string[];      // ids das regiões que são zona segura (para o mapa do mundo)
  marks?: MarkMsg[];    // marcadores que já estão neste mapa
}
// Marcador "venham aqui!": quem marcou, onde (pixels) e por quanto tempo ainda vale (ms). `clear`: tirou o marcador.
export type MarkMsg = { id: string; name: string; x: number; y: number; ttl: number } | { id: string; clear: true };
export const MARK_TTL = 60000;
// Nome e aparência mudam pouco: vão numa mensagem própria quando alguém entra, muda ou sai, e não em todo snapshot.
export type ProfileMsg = Profile | { id: string; gone: true };
export interface ProfileRequest { name: string; look: Look }
export function decodeProfileRequest(m: unknown): ProfileRequest | null {
  if (!m || typeof m !== 'object') return null;
  const r = m as Record<string, unknown>;
  return { name: cleanName(r.name), look: cleanLook(r.look) };
}
export interface SnapshotMsg {
  t: number;              // passo do servidor
  ack: number;            // último input seu já aplicado
  me: OwnState | null;
  p: PlayerTuple[];       // outros jogadores perto
  e: EnemyTuple[];
  o: ThrownTuple[];
  a: ArrowTuple[];
  ev: GameEvent[];        // eventos perto de você (e os endereçados a você)
  pvp: PvpInfo;
  d: DropTuple[];         // drops no chão, perto
  b: BombTuple[];         // bombas acesas no chão, perto
  m?: SpellTuple[];       // magias voando, perto
  xpNext: number;         // XP para o próximo nível (-1 no nível máximo)
  day: number;            // hora do dia: 0 = meia-noite, 0,5 = meio-dia
  r?: [string, number, number][];   // de tempos em tempos: todos no seu mapa, em tiles [id, x, y] (para o mapa do mundo)
  iv?: [number, number];  // invasão em andamento: [gelecas restantes (-1 = ainda no aviso), segundos até o fim do aviso/da luta]
  bag?: Slot[];           // inventário: só vem quando mudou
  ch?: string[];          // baús deste mapa vazios para você ("x,y"): só vem quando muda
  g?: PartyInfo;          // seu grupo (só vem se você estiver em um)
  wear?: Record<WearSlot, Slot>;   // o que você está vestindo: vem junto com o inventário (quando muda)
  kc?: number;            // masmorra: quantas chaves o grupo tem
}
/* ---------- Itens ---------- */
// Catálogo de itens (de content/items/): os dados e o ícone (PNG 16×16 em data URL). Vem ao entrar e quando a pasta muda.
export type ItemCatalogMsg = Record<string, ItemDef & { icon: string }>;

/* ---------- Grupo ---------- */
// Cada membro (você incluído, na ordem em que entraram): [id, nome, nível, vida em %, caído (1/0), x, y, onde].
// x e y em pixels quando está no seu mapa; -1 quando está em outro. `onde`: região (ou mapa) em que ele está.
export type PartyTuple = [string, string, number, number, number, number, number, string];
export interface PartyInfo { leader: string; m: PartyTuple[] }
// Cliente → servidor. invite: pelo nome; kick: só quem lidera; who: lista de quem está online.
export type PartyRequest = { action: 'invite'; name: string } | { action: 'accept' | 'decline' | 'leave' | 'who' } | { action: 'kick'; id: string };
// Servidor → cliente: convite recebido (ou que expirou/foi respondido: invite null) e a lista de quem está online.
export interface OnlineEntry { name: string; level: number; where: string; party: boolean; mine: boolean }
export type PartyMsg = { invite: { from: string; ttl: number } | null } | { who: OnlineEntry[] };
export const INVITE_TTL = 60000;
// Modo do servidor e quantos segundos faltam para você poder desligar o seu PvP.
export interface PvpInfo { mode: PvpMode; lock: number }

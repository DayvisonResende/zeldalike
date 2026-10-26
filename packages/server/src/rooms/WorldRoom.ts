import { Room, ServerError, type Client } from 'colyseus';
import {
  MSG, TICK_RATE, World, blockedAt, dropItem, maxStats, packDrop, parseInventory, pvpLock, respawnPos, setPvp, useItem, viewRect, xpToNext, decodeChatRequest, decodeInput, decodeProfileRequest, emptyInput, ownState, packArrow, packEnemy, packPlayer, packThrown,
  type ChatMsg, type GameEvent, type InputState, type JoinOptions, type Player, type Profile, type ProfileMsg, type SnapshotMsg, type WelcomeMsg
} from '@vale/shared';
import { toRules } from '../config/load';
import { getConfig, onConfig } from '../config/store';
import type { Config } from '../config/schema';
import { WORLD_MAP } from '../map';
import { eventFor, inView } from './interest';
import { onlineCharacters } from '../auth/routes';
import { accountForToken } from '../auth/sessions';
import { getCharacter, saveCharacters, type CharacterRow, type CharacterState } from '../persistence/characters';
import { getDb } from '../persistence/db';

const MAX_QUEUE = 12;  // inputs guardados por jogador; acima disso descarta os mais velhos
const CATCH_UP = 3;    // fila maior que isso: aplica dois inputs por passo
const PROFILE_EVERY = 1000;   // ms entre trocas de nome/aparência

interface Seat { client: Client; charId: number; bagSent: number; queue: { seq: number; input: InputState }[]; ack: number; profileAt: number; chatTokens: number; chatAt: number; kicked?: boolean }
interface Auth { accountId: number; character: CharacterRow }
const profileOf = (p: Player): Profile => ({ id: p.id, name: p.name, look: { ...p.look } });
const fmtWait = (s: number) => s >= 60 ? `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s` : `${s}s`;

// Uma sala só para o mundo inteiro: ela nunca fecha, mesmo vazia.
// O servidor é a autoridade: recebe só os comandos dos jogadores e devolve o que cada um enxerga.
export class WorldRoom extends Room {
  autoDispose = false;
  maxMessagesPerSecond = 90;   // o cliente manda 60 inputs/s; acima disso é abuso
  world!: World;
  private seats = new Map<string, Seat>();
  private events: GameEvent[] = [];
  private sendEvery = 3;
  private saveTimer?: NodeJS.Timeout;
  private unsub?: () => void;

  onCreate() {
    this.world = new World(WORLD_MAP, toRules(getConfig()), Date.now() | 0);
    this.apply(getConfig());
    this.unsub = onConfig(c => this.apply(c));
    this.onMessage(MSG.input, (client, msg) => this.onInput(client, msg));
    this.onMessage(MSG.hello, client => this.welcome(client));   // o cliente pede quando já está ouvindo
    this.onMessage(MSG.profile, (client, msg) => this.onProfile(client, msg));
    this.onMessage(MSG.chat, (client, msg) => this.onChat(client, msg));
    this.onMessage(MSG.pvp, (client, msg) => this.onPvp(client, msg));
    this.onMessage(MSG.item, (client, msg) => this.onItem(client, msg));
    this.setFixedTimestep(() => this.step(), TICK_RATE);
    this.scheduleSave();
  }
  private apply(c: Config) {
    this.world.rules = toRules(c);
    if (this.saveTimer) this.scheduleSave();
    this.maxClients = c.server.maxPlayers;
    this.sendEvery = Math.max(1, Math.round(TICK_RATE / c.network.sendRate));
  }

  // Só entra quem tem sessão válida e escolheu um personagem da própria conta.
  async onAuth(_client: Client, options: Partial<JoinOptions>): Promise<Auth> {
    const acc = await accountForToken(getDb(), options?.token);
    if (!acc) throw new ServerError(401, 'Sessão expirada. Entre de novo.');
    const character = Number.isInteger(options?.characterId) ? await getCharacter(getDb(), acc.id, options!.characterId!) : undefined;
    if (!character) throw new ServerError(404, 'Personagem não encontrado.');
    return { accountId: acc.id, character };
  }

  onJoin(client: Client, _options: unknown, auth: Auth) {
    const c = auth.character;
    // O mesmo personagem entrou de outro lugar: a sessão antiga sai, e o estado dela (mais novo que o do banco) continua.
    let resume: CharacterState | null = null;
    for (const [id, seat] of this.seats) if (seat.charId === c.id) {
      resume = this.stateOf(this.world.players.get(id)!);
      seat.kicked = true; this.world.removePlayer(id); this.seats.delete(id);
      seat.client.send(MSG.chat, { ch: 'system', text: 'Seu personagem entrou em outro lugar.' } satisfies ChatMsg);
      seat.client.leave(4002);
    }
    const s = resume ?? this.loadState(c);
    const p = this.world.addPlayer(client.sessionId, c.name, s.x, s.y, s.look);
    p.level = s.level; p.xp = s.xp; p.gold = s.gold; p.bag = s.bag;
    const m = maxStats(this.world, p.level); p.maxHp = m.hp; p.maxMp = m.mp;
    p.hp = Math.min(s.hp, m.hp); p.mp = Math.min(s.mp, m.mp);
    onlineCharacters.add(c.id);
    this.seats.set(client.sessionId, { client, charId: c.id, bagSent: -1, queue: [], ack: 0, profileAt: 0, chatTokens: getConfig().chat.burst, chatAt: Date.now() });
    this.broadcastProfile(profileOf(p), client);
    if (getConfig().chat.announceJoins) this.sendChat({ ch: 'system', text: `${p.name} entrou no Vale` }, client);
  }
  // Queda de conexão: segura o lugar por 15 s, parado.
  async onDrop(client: Client) {
    const p = this.world.players.get(client.sessionId);
    if (p) p.input = emptyInput();
    const seat = this.seats.get(client.sessionId);
    if (seat) seat.queue = [];
    await this.allowReconnection(client, 15);
  }
  onReconnect(client: Client) {
    const seat = this.seats.get(client.sessionId);
    if (seat) { seat.client = client; seat.bagSent = -1; }   // reenvia o inventário
    this.welcome(client);
  }
  async onLeave(client: Client) {
    const seat = this.seats.get(client.sessionId), p = this.world.players.get(client.sessionId);
    if (!seat || seat.kicked) return;   // expulso por ter entrado de outro lugar: já foi salvo e trocado
    onlineCharacters.delete(seat.charId);
    if (p) await this.save([[seat, p]]);
    if (p && getConfig().chat.announceJoins) this.sendChat({ ch: 'system', text: `${p.name} saiu` }, client);
    this.world.removePlayer(client.sessionId);
    this.seats.delete(client.sessionId);
    this.broadcastProfile({ id: client.sessionId, gone: true });
  }
  async onDispose() { this.unsub?.(); clearTimeout(this.saveTimer); await this.saveAll(); }

  /* ---------- Salvar e carregar personagens ---------- */
  private loadState(c: CharacterRow): CharacterState {
    const w = this.world, r = w.rules.player, m = maxStats(w, c.level);
    const ok = c.x !== null && c.y !== null && w.map.inBounds(Math.floor(c.x / 16), Math.floor(c.y / 16)) && !blockedAt(w.map, c.x, c.y, 5, 4);
    const at = ok ? { x: c.x!, y: c.y! } : respawnPos(w, r.respawnPoint);
    const hp = c.hp === null || c.hp <= 0 ? m.hp : Math.min(c.hp, m.hp);
    let bag; try { bag = JSON.parse(c.items); } catch { bag = []; }
    return { ...at, hp, mp: c.mp === null ? m.mp : Math.min(c.mp, m.mp), look: { cloak: c.cloak, hair: c.hair },
      level: c.level, xp: c.xp, gold: c.gold, bag: parseInventory(bag, w.rules.inventory.slots, w.rules.inventory.stack) };
  }
  // Quem sai caído volta no ponto de renascimento, com a vida cheia.
  private stateOf(p: Player): CharacterState {
    const keep = { look: { ...p.look }, level: p.level, xp: p.xp, gold: p.gold, bag: p.bag.map(s => s && { ...s }) };
    if (p.state === 'dead') { const at = respawnPos(this.world, this.world.rules.player.respawnPoint); return { ...at, hp: p.maxHp, mp: p.maxMp, ...keep }; }
    return { x: p.x, y: p.y, hp: p.hp, mp: p.mp, ...keep };
  }
  private async save(list: [Seat, Player][]) {
    try { await saveCharacters(getDb(), list.map(([s, p]) => ({ id: s.charId, state: this.stateOf(p) }))); }
    catch (e) { console.error('[banco] falha ao salvar personagens:', e); }
  }
  private saveAll() {
    return this.save([...this.seats].flatMap(([id, s]) => { const p = this.world.players.get(id); return p ? [[s, p] as [Seat, Player]] : []; }));
  }
  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => { await this.saveAll(); this.scheduleSave(); }, getConfig().accounts.saveEvery * 1000);
  }

  private welcome(client: Client) {
    const msg: WelcomeMsg = {
      id: client.sessionId, tick: this.world.tick, tiles: this.world.map.tiles.map(r => r.join('')), sendEvery: this.sendEvery, motd: getConfig().server.motd,
      profiles: [...this.world.players.values()].map(profileOf)
    };
    client.send(MSG.welcome, msg);
  }
  private broadcastProfile(msg: ProfileMsg, except?: Client) {
    for (const seat of this.seats.values()) if (seat.client !== except) seat.client.send(MSG.profile, msg);
  }
  // Troca de nome/aparência: validada e no máximo uma por segundo.
  private onProfile(client: Client, raw: unknown) {
    const seat = this.seats.get(client.sessionId), p = this.world.players.get(client.sessionId), req = decodeProfileRequest(raw);
    if (!seat || !p || !req || Date.now() - seat.profileAt < PROFILE_EVERY) return;
    seat.profileAt = Date.now();
    p.look = req.look;   // o nome é o do personagem, escolhido na criação
    this.broadcastProfile(profileOf(p));
  }
  // Chat: limpo, limitado contra spam (burst mensagens a cada `per`) e entregue por canal.
  private onChat(client: Client, raw: unknown) {
    const cfg = getConfig().chat, seat = this.seats.get(client.sessionId), p = this.world.players.get(client.sessionId);
    const req = decodeChatRequest(raw, cfg.maxLength);
    if (!seat || !p || !req) return;
    const now = Date.now();
    seat.chatTokens = Math.min(cfg.burst, seat.chatTokens + (now - seat.chatAt) / 1000 * cfg.burst / cfg.per); seat.chatAt = now;
    if (seat.chatTokens < 1) { client.send(MSG.chat, { ch: 'system', text: 'Calma! Espere um pouco antes de mandar outra mensagem.' } satisfies ChatMsg); return; }
    seat.chatTokens--;
    const msg: ChatMsg = { ch: req.ch, text: req.text, from: p.id, name: p.name };
    if (req.ch === 'global') { this.sendChat(msg); return; }
    for (const [id, s] of this.seats) {   // "Perto": só quem está no alcance (inclui quem falou)
      const o = this.world.players.get(id);
      if (o && Math.hypot(o.x - p.x, o.y - p.y) <= cfg.localRange) s.client.send(MSG.chat, msg);
    }
  }
  // Ligar/desligar o PvP (só no modo optional, respeitando cooldown e combat lock).
  private onPvp(client: Client, raw: unknown) {
    const p = this.world.players.get(client.sessionId);
    if (!p || !raw || typeof (raw as { on?: unknown }).on !== 'boolean') return;
    const on = (raw as { on: boolean }).on, r = setPvp(this.world, p, on);
    if (r.ok) { client.send(MSG.chat, { ch: 'system', text: on ? 'PvP ligado: outros jogadores com PvP podem te atacar.' : 'PvP desligado.' } satisfies ChatMsg); return; }
    const text = r.reason === 'mode'
      ? (this.world.rules.pvp.mode === 'open' ? 'Neste servidor o PvP é sempre ligado.' : 'Neste servidor não há PvP.')
      : `Você só pode desligar o PvP em ${fmtWait(r.wait ?? 0)}.`;
    client.send(MSG.chat, { ch: 'system', text } satisfies ChatMsg);
  }
  // Usar ou largar um item do inventário; recusa vira aviso só para quem pediu.
  private onItem(client: Client, raw: unknown) {
    const p = this.world.players.get(client.sessionId), m = raw as { action?: unknown; slot?: unknown } | null;
    if (!p || !m || !Number.isInteger(m.slot) || (m.slot as number) < 0 || (m.slot as number) >= p.bag.length) return;
    const r = m.action === 'use' ? useItem(this.world, p, m.slot as number) : m.action === 'drop' ? dropItem(this.world, p, m.slot as number) : null;
    if (r && !r.ok) client.send(MSG.chat, { ch: 'system', text: r.reason } satisfies ChatMsg);
  }
  private announceKill(by: string, victim: string) {
    const a = this.world.players.get(by), v = this.world.players.get(victim);
    if (a && v && getConfig().pvp.announceKills) this.sendChat({ ch: 'system', text: `${a.name} derrubou ${v.name}` });
  }
  private sendChat(msg: ChatMsg, except?: Client) {
    for (const seat of this.seats.values()) if (seat.client !== except) seat.client.send(MSG.chat, msg);
  }
  private onInput(client: Client, raw: unknown) {
    const seat = this.seats.get(client.sessionId), m = decodeInput(raw);
    if (!seat || !m || m.seq <= seat.ack || (seat.queue.length && m.seq <= seat.queue[seat.queue.length - 1].seq)) return;
    seat.queue.push(m);
    while (seat.queue.length > MAX_QUEUE) {   // descarta o mais velho, mas não perde os toques dele
      const old = seat.queue.shift()!; seat.queue[0].input.tap |= old.input.tap; seat.ack = old.seq;
    }
  }

  private step() {
    // Cada input vira exatamente um passo do jogador, como o cliente previu. Sem input, ele espera;
    // com fila acumulada (a rede engasgou), aplica dois por passo até alcançar.
    for (const [id, seat] of this.seats) {
      for (let n = seat.queue.length > CATCH_UP ? 2 : 1; n > 0 && seat.queue.length; n--) {
        const next = seat.queue.shift()!;
        this.world.stepPlayer(id, next.input); seat.ack = next.seq;
      }
    }
    for (const ev of this.world.step({ players: false })) {
      if (ev.t === 'kill') this.announceKill(ev.by, ev.victim);
      else this.events.push(ev);
    }
    if (this.world.tick % this.sendEvery === 0) { this.sendSnapshots(); this.events = []; }
  }
  private sendSnapshots() {
    const w = this.world;
    for (const [id, seat] of this.seats) {
      const me = w.players.get(id); if (!me) continue;
      const view = viewRect(w.map, me.x, me.y), near = (o: { x: number; y: number }) => inView(view, o);
      const msg: SnapshotMsg = {
        t: w.tick, ack: seat.ack, me: ownState(me),
        p: [...w.players.values()].filter(p => p.id !== id && near(p)).map(packPlayer),
        e: w.enemies.filter(near).map(packEnemy),
        o: w.thrown.filter(near).map(packThrown),
        a: w.arrows.filter(near).map(packArrow),
        ev: this.events.filter(ev => eventFor(ev, id, view)),
        pvp: { mode: w.rules.pvp.mode, lock: pvpLock(w, me) },
        d: w.drops.filter(near).map(d => packDrop({ ...d, reserved: !!d.owner && d.owner !== id && w.tick < d.ownerUntil, fading: d.expires - w.tick < 600 })),
        xpNext: me.level >= w.rules.leveling.maxLevel ? -1 : xpToNext(w, me.level)
      };
      if (seat.bagSent !== me.bagVersion) { msg.bag = me.bag; seat.bagSent = me.bagVersion; }
      seat.client.send(MSG.snapshot, msg);
    }
  }
}

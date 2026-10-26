import { Room, type Client } from 'colyseus';
import {
  MSG, TICK_RATE, World, pvpLock, setPvp, viewRect, cleanLook, cleanName, decodeChatRequest, decodeInput, decodeProfileRequest, emptyInput, ownState, packArrow, packEnemy, packPlayer, packThrown,
  type ChatMsg, type GameEvent, type InputState, type Player, type Profile, type ProfileMsg, type SnapshotMsg, type WelcomeMsg
} from '@vale/shared';
import { toRules } from '../config/load';
import { getConfig, onConfig } from '../config/store';
import type { Config } from '../config/schema';
import { WORLD_MAP } from '../map';
import { eventFor, inView } from './interest';

const MAX_QUEUE = 12;  // inputs guardados por jogador; acima disso descarta os mais velhos
const CATCH_UP = 3;    // fila maior que isso: aplica dois inputs por passo
const PROFILE_EVERY = 1000;   // ms entre trocas de nome/aparência

interface Seat { client: Client; queue: { seq: number; input: InputState }[]; ack: number; profileAt: number; chatTokens: number; chatAt: number }
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
    this.setFixedTimestep(() => this.step(), TICK_RATE);
  }
  private apply(c: Config) {
    this.world.rules = toRules(c);
    this.maxClients = c.server.maxPlayers;
    this.sendEvery = Math.max(1, Math.round(TICK_RATE / c.network.sendRate));
  }

  onJoin(client: Client, options?: { name?: unknown; look?: unknown }) {
    const p = this.world.addPlayer(client.sessionId, cleanName(options?.name), undefined, undefined, cleanLook(options?.look));
    this.seats.set(client.sessionId, { client, queue: [], ack: 0, profileAt: 0, chatTokens: getConfig().chat.burst, chatAt: Date.now() });
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
    if (seat) seat.client = client;
    this.welcome(client);
  }
  onLeave(client: Client) {
    const p = this.world.players.get(client.sessionId);
    if (p && getConfig().chat.announceJoins) this.sendChat({ ch: 'system', text: `${p.name} saiu` }, client);
    this.world.removePlayer(client.sessionId);
    this.seats.delete(client.sessionId);
    this.broadcastProfile({ id: client.sessionId, gone: true });
  }
  onDispose() { this.unsub?.(); }

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
    p.name = req.name; p.look = req.look;
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
        pvp: { mode: w.rules.pvp.mode, lock: pvpLock(w, me) }
      };
      seat.client.send(MSG.snapshot, msg);
    }
  }
}

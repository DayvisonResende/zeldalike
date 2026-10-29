import { Room, ServerError, type Client } from 'colyseus';
import {
  ITEMS, LOOT_IDS, MARK_TTL, MSG, base64ToBits, bitsToBase64, buyItem, exploredOf, exploredSize, type MarkMsg, startInvasion, type LootId, equipGear, isGear, isItem, packSpell, parseGear, sellItem, TICK_RATE, World, arrive, dayTime, sunlight, blockedAt, decodeChatRequest, decodeInput, decodeProfileRequest, dropItem, emptyInput, maxStats, ownState,
  openChests, packArrow, packBomb, packDrop, packEnemy, packPlayer, packThrown, parseInventory, pruneChests, pvpLock, remaining, respawn, respawnPos, setPvp, useItem, viewRect, xpToNext,
  type ChatMsg, type GameEvent, type InputState, type ItemId, type JoinOptions, type Player, type Profile, type ProfileMsg, type SnapshotMsg, type WelcomeMsg
} from '@vale/shared';
import { toRules } from '../config/load';
import { configPath, getConfig, onConfig } from '../config/store';
import { runCommand, type CommandContext, type Found } from '../chat/commands';
import { filterChat } from '../chat/filter';
import { backupNow } from '../persistence/backup';
import type { Config } from '../config/schema';
import { getMaps, startMap } from '../map';
import { eventFor, inView } from './interest';
import { onlineCharacters } from '../auth/routes';
import { accountForToken } from '../auth/sessions';
import { getCharacter, saveCharacters, type CharacterRow, type CharacterState } from '../persistence/characters';
import { getDb } from '../persistence/db';
import { submitRecord } from '../persistence/records';

const MAX_QUEUE = 12;  // inputs guardados por jogador; acima disso descarta os mais velhos
const CATCH_UP = 3;    // fila maior que isso: aplica dois inputs por passo
const PROFILE_EVERY = 1000;   // ms entre trocas de nome/aparência

interface Seat {
  client: Client; charId: number; map: string;   // map: id do mundo onde o jogador está
  bagSent: number; chestsSent: string; queue: { seq: number; input: InputState }[]; ack: number;
  profileAt: number; chatTokens: number; chatAt: number; kicked?: boolean;
  username: string;   // login da conta (para saber quem é administrador)
}
interface Auth { accountId: number; username: string; character: CharacterRow }
const profileOf = (p: Player): Profile => ({ id: p.id, name: p.name, look: { ...p.look } });
const fmtWait = (s: number) => s >= 60 ? `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s` : `${s}s`;

// Uma sala só para o jogo inteiro: ela nunca fecha, mesmo vazia. Dentro dela, um mundo (World) por mapa.
// O servidor é a autoridade: recebe só os comandos dos jogadores e devolve o que cada um enxerga no mapa em que está.
export class WorldRoom extends Room {
  autoDispose = false;
  maxMessagesPerSecond = 90;   // o cliente manda 60 inputs/s; acima disso é abuso
  worlds = new Map<string, World>();
  private seats = new Map<string, Seat>();
  private muted = new Map<number, number>();   // personagem → até quando está sem chat (ms)
  private marks = new Map<string, { map: string; name: string; x: number; y: number; until: number }>();   // marcador de cada um
  private markAt = new Map<string, number>();   // último marcador de cada um (no máximo um por segundo)
  private events = new Map<string, GameEvent[]>();   // eventos de cada mundo desde o último snapshot
  private ticks = 0;
  private night: boolean | null = null;   // para anunciar quando anoitece e quando amanhece
  private sendEvery = 3;
  private saveTimer?: NodeJS.Timeout;
  private unsub?: () => void;

  // Mundo principal (onde se nasce e renasce).
  get world() { return this.worlds.get(startMap())!; }

  onCreate() {
    const seed = Date.now() | 0;
    for (const [id, map] of Object.entries(getMaps())) {
      const w = new World(map, toRules(getConfig()), seed + this.worlds.size);
      w.home = id === startMap(); w.id = id;
      this.worlds.set(id, w); this.events.set(id, []);
    }
    this.apply(getConfig());
    this.unsub = onConfig(c => this.apply(c));
    this.onMessage(MSG.input, (client, msg) => this.onInput(client, msg));
    this.onMessage(MSG.hello, client => this.welcome(client));   // o cliente pede quando já está ouvindo
    this.onMessage(MSG.profile, (client, msg) => this.onProfile(client, msg));
    this.onMessage(MSG.chat, (client, msg) => this.onChat(client, msg));
    this.onMessage(MSG.pvp, (client, msg) => this.onPvp(client, msg));
    this.onMessage(MSG.item, (client, msg) => this.onItem(client, msg));
    this.onMessage(MSG.shop, (client, msg) => this.onShop(client, msg));
    this.onMessage(MSG.mark, (client, msg) => this.onMark(client, msg));
    this.setFixedTimestep(() => this.step(), TICK_RATE);
    this.scheduleSave();
  }
  private apply(c: Config) {
    for (const w of this.worlds.values()) w.rules = toRules(c);
    if (this.saveTimer) this.scheduleSave();
    this.maxClients = c.server.maxPlayers;
    this.sendEvery = Math.max(1, Math.round(TICK_RATE / c.network.sendRate));
  }
  // Jogador e o mundo em que ele está.
  private find(id: string) {
    const seat = this.seats.get(id), w = seat && this.worlds.get(seat.map), p = w?.players.get(id);
    return seat && w && p ? { seat, w, p } : null;
  }

  // Só entra quem tem sessão válida e escolheu um personagem da própria conta.
  async onAuth(_client: Client, options: Partial<JoinOptions>): Promise<Auth> {
    const acc = await accountForToken(getDb(), options?.token);
    if (!acc) throw new ServerError(401, 'Sessão expirada. Entre de novo.');
    const character = Number.isInteger(options?.characterId) ? await getCharacter(getDb(), acc.id, options!.characterId!) : undefined;
    if (!character) throw new ServerError(404, 'Personagem não encontrado.');
    return { accountId: acc.id, username: acc.username, character };
  }

  onJoin(client: Client, _options: unknown, auth: Auth) {
    const c = auth.character;
    // O mesmo personagem entrou de outro lugar: a sessão antiga sai, e o estado dela (mais novo que o do banco) continua.
    let resume: CharacterState | null = null;
    for (const [id, seat] of this.seats) if (seat.charId === c.id) {
      const old = this.find(id);
      if (old) { resume = this.stateOf(old.p, old.seat.map); old.w.removePlayer(id); }
      seat.kicked = true; this.seats.delete(id);
      seat.client.send(MSG.chat, { ch: 'system', text: 'Seu personagem entrou em outro lugar.' } satisfies ChatMsg);
      seat.client.leave(4002);
    }
    const s = resume ?? this.loadState(c), w = this.worlds.get(s.map)!;
    const p = w.addPlayer(client.sessionId, c.name, s.x, s.y, s.look);
    p.level = s.level; p.xp = s.xp; p.gold = s.gold; p.bag = s.bag; p.chests = s.chests; p.chestLoot = s.chestLoot; p.gear = s.gear;
    for (const [id, b64] of Object.entries(s.explored)) { const o = this.worlds.get(id); if (o) p.explored[id] = base64ToBits(b64, exploredSize(o.map.cols, o.map.rows)); }
    const m = maxStats(w, p.level); p.maxHp = m.hp; p.maxMp = m.mp;
    p.hp = Math.min(s.hp, m.hp); p.mp = Math.min(s.mp, m.mp);
    onlineCharacters.add(c.id);
    this.seats.set(client.sessionId, { client, charId: c.id, map: s.map, bagSent: -1, chestsSent: '', queue: [], ack: 0, profileAt: 0, chatTokens: getConfig().chat.burst, chatAt: Date.now(), username: auth.username });
    this.broadcastProfile(profileOf(p), client);
    if (getConfig().chat.announceJoins) this.sendChat({ ch: 'system', text: `${p.name} entrou no Vale` }, client);
  }
  // Queda de conexão: segura o lugar por 15 s, parado.
  async onDrop(client: Client) {
    if (!this.seats.has(client.sessionId)) return;   // expulso (ou trocado por outra entrada): não guarda o lugar
    const f = this.find(client.sessionId);
    if (f) { f.p.input = emptyInput(); f.seat.queue = []; }
    await this.allowReconnection(client, 15);
  }
  onReconnect(client: Client) {
    const seat = this.seats.get(client.sessionId);
    if (seat) { seat.client = client; seat.bagSent = -1; seat.chestsSent = ''; }   // reenvia inventário e baús
    this.welcome(client);
  }
  async onLeave(client: Client) {
    const seat = this.seats.get(client.sessionId);
    if (!seat || seat.kicked) return;   // expulso por ter entrado de outro lugar: já foi salvo e trocado
    const f = this.find(client.sessionId);
    onlineCharacters.delete(seat.charId);
    if (f) await this.save([[seat, f.p]]);
    if (f && getConfig().chat.announceJoins) this.sendChat({ ch: 'system', text: `${f.p.name} saiu` }, client);
    f?.w.removePlayer(client.sessionId);
    this.seats.delete(client.sessionId);
    this.broadcastProfile({ id: client.sessionId, gone: true });
    const mark = this.marks.get(client.sessionId);
    if (mark) { this.marks.delete(client.sessionId); this.sendToMap(mark.map, { id: client.sessionId, clear: true }); }
    this.markAt.delete(client.sessionId);
  }
  async onDispose() { this.unsub?.(); clearTimeout(this.saveTimer); await this.saveAll(); }

  /* ---------- Trocar de mapa ---------- */
  // Leva o jogador (com tudo que ele tem) para outro mundo e manda o mapa novo para o cliente.
  private transfer(id: string, to: string, at: { x: number; y: number }) {
    const f = this.find(id), dest = this.worlds.get(to);
    if (!f || !dest) return null;
    f.w.removePlayer(id);
    dest.players.set(id, f.p);
    arrive(f.p, at);
    f.seat.map = to; f.seat.queue = []; f.seat.chestsSent = '';
    this.welcome(f.seat.client);
    return f.p;
  }
  private onPortal(id: string, to: string, point: string) {
    const dest = this.worlds.get(to);
    const at = dest?.map.data.points?.[point] ?? dest?.map.data.spawn;
    if (at) this.transfer(id, to, at);
  }
  // Caído fora do mapa principal: renasce no principal.
  private goHome(id: string) {
    const home = this.world, p = this.transfer(id, startMap(), home.map.data.spawn);
    if (p) respawn(home, p);
  }

  /* ---------- Salvar e carregar personagens ---------- */
  private loadState(c: CharacterRow): CharacterState {
    const map = this.worlds.has(c.map) ? c.map : startMap(), w = this.worlds.get(map)!;
    const r = w.rules.player, m = maxStats(w, c.level);
    const ok = c.x !== null && c.y !== null && w.map.inBounds(Math.floor(c.x / 16), Math.floor(c.y / 16)) && !blockedAt(w.map, c.x, c.y, 5, 4);
    const at = ok ? { x: c.x!, y: c.y! } : map === startMap() ? respawnPos(w, r.respawnPoint) : w.map.data.spawn;
    const hp = c.hp === null || c.hp <= 0 ? m.hp : Math.min(c.hp, m.hp);
    let bag, gear, chests: Record<string, number> = {};
    try { gear = JSON.parse(c.gear ?? '{}'); } catch { gear = {}; }
    try { bag = JSON.parse(c.items); } catch { bag = []; }
    try { for (const [k, v] of Object.entries(JSON.parse(c.chests ?? '{}'))) if (typeof v === 'number') chests[k] = v; } catch { }
    // resto guardado nos baús: só o que fizer sentido (item conhecido, quantidade inteira positiva)
    const chestLoot: CharacterState['chestLoot'] = {};
    try {
      for (const [k, v] of Object.entries(JSON.parse(c.chest_loot ?? '{}'))) {
        const items = Array.isArray(v) ? v.filter(i => i && (LOOT_IDS as unknown[]).includes(i.item) && Number.isInteger(i.n) && i.n > 0).map(i => ({ item: i.item as LootId, n: i.n as number })) : [];
        if (items.length) chestLoot[k] = items;
      }
    } catch { }
    const explored: Record<string, string> = {};
    try { for (const [k, v] of Object.entries(JSON.parse(c.explored ?? '{}'))) if (typeof v === 'string' && this.worlds.has(k)) explored[k] = v; } catch { }
    return { map, ...at, chests, chestLoot, explored, hp, mp: c.mp === null ? m.mp : Math.min(c.mp, m.mp), look: { cloak: c.cloak, hair: c.hair },
      level: c.level, xp: c.xp, gold: c.gold, bag: parseInventory(bag, w.rules.inventory.slots, w.rules.inventory.stack), gear: parseGear(gear) };
  }
  // Quem sai caído volta no ponto de renascimento do mapa principal, com a vida cheia.
  private stateOf(p: Player, map: string): CharacterState {
    const w = this.worlds.get(map); if (w) pruneChests(w, p);
    const keep = { look: { ...p.look }, level: p.level, xp: p.xp, gold: p.gold, bag: p.bag.map(s => s && { ...s }), chests: { ...p.chests }, chestLoot: Object.fromEntries(Object.entries(p.chestLoot).map(([k, v]) => [k, v.map(i => ({ ...i }))])), gear: { ...p.gear },
      explored: Object.fromEntries(Object.entries(p.explored).map(([k, v]) => [k, bitsToBase64(v)])) };
    if (p.state === 'dead') {
      const at = respawnPos(this.world, this.world.rules.player.respawnPoint);
      return { map: startMap(), ...at, hp: p.maxHp, mp: p.maxMp, ...keep };
    }
    return { map, x: p.x, y: p.y, hp: p.hp, mp: p.mp, ...keep };
  }
  private async save(list: [Seat, Player][]) {
    try { await saveCharacters(getDb(), list.map(([s, p]) => ({ id: s.charId, state: this.stateOf(p, s.map) }))); }
    catch (e) { console.error('[banco] falha ao salvar personagens:', e); }
  }
  private saveAll() {
    return this.save([...this.seats.keys()].flatMap(id => { const f = this.find(id); return f ? [[f.seat, f.p] as [Seat, Player]] : []; }));
  }
  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => { await this.saveAll(); this.scheduleSave(); }, getConfig().accounts.saveEvery * 1000);
  }

  // Mapa do mundo onde o jogador está, como o chão está agora, e quem está online. Também usado ao trocar de mapa.
  private welcome(client: Client) {
    const seat = this.seats.get(client.sessionId), w = (seat && this.worlds.get(seat.map)) ?? this.world;
    const me = w.players.get(client.sessionId);
    const msg: WelcomeMsg = {
      id: client.sessionId, tick: w.tick, tiles: w.map.tiles.map(r => r.join('')), sendEvery: this.sendEvery, motd: getConfig().server.motd,
      map: { ...w.map.data, enemies: [] }, at: me ? { x: me.x, y: me.y } : w.map.data.spawn,
      profiles: [...this.worlds.values()].flatMap(o => [...o.players.values()].map(profileOf)),
      explored: me ? bitsToBase64(exploredOf(w, me)) : '', safe: getConfig().pvp.safeZones,
      marks: [...this.marks].filter(([, m]) => m.map === w.id && m.until > Date.now()).map(([id, m]) => ({ id, name: m.name, x: m.x, y: m.y, ttl: m.until - Date.now() }))
    };
    client.send(MSG.welcome, msg);
  }
  private broadcastProfile(msg: ProfileMsg, except?: Client) {
    for (const seat of this.seats.values()) if (seat.client !== except) seat.client.send(MSG.profile, msg);
  }
  // Troca de aparência: validada e no máximo uma por segundo.
  private onProfile(client: Client, raw: unknown) {
    const f = this.find(client.sessionId), req = decodeProfileRequest(raw);
    if (!f || !req || Date.now() - f.seat.profileAt < PROFILE_EVERY) return;
    f.seat.profileAt = Date.now();
    f.p.look = req.look;   // o nome é o do personagem, escolhido na criação
    this.broadcastProfile(profileOf(f.p));
  }
  // Chat: limpo, limitado contra spam (burst mensagens a cada `per`) e entregue por canal.
  private onChat(client: Client, raw: unknown) {
    const cfg = getConfig().chat, f = this.find(client.sessionId);
    const req = decodeChatRequest(raw, cfg.maxLength);
    if (!f || !req) return;
    const { seat, p } = f, now = Date.now();
    seat.chatTokens = Math.min(cfg.burst, seat.chatTokens + (now - seat.chatAt) / 1000 * cfg.burst / cfg.per); seat.chatAt = now;
    if (seat.chatTokens < 1) { client.send(MSG.chat, { ch: 'system', text: 'Calma! Espere um pouco antes de mandar outra mensagem.' } satisfies ChatMsg); return; }
    seat.chatTokens--;
    const reply = (text: string) => client.send(MSG.chat, { ch: 'system', text } satisfies ChatMsg);
    if (req.text.startsWith('/')) { void runCommand(this.commandContext(client.sessionId, reply), req.text); return; }   // comando: nunca vai para os outros
    const until = this.muted.get(seat.charId) ?? 0;
    if (until > now) { reply(`Você está sem chat por mais ${Math.ceil((until - now) / 60000)} min.`); return; }
    const text = cfg.filter ? filterChat(req.text, cfg.blockedWords) : req.text;
    const msg: ChatMsg = { ch: req.ch, text, from: p.id, name: p.name };
    if (req.ch === 'global') { this.sendChat(msg); return; }
    for (const [id, s] of this.seats) {   // "Perto": só quem está no mesmo mapa e no alcance (inclui quem falou)
      const o = s.map === seat.map ? f.w.players.get(id) : undefined;
      if (o && Math.hypot(o.x - p.x, o.y - p.y) <= cfg.localRange) s.client.send(MSG.chat, msg);
    }
  }
  // Marcador "venham aqui!": um por jogador, vale MARK_TTL, chega a quem está no mesmo mapa. { x, y } em pixels, ou { clear: true }.
  private onMark(client: Client, raw: unknown) {
    const f = this.find(client.sessionId), m = raw as { x?: unknown; y?: unknown; clear?: unknown } | null;
    if (!f || !m) return;
    const now = Date.now();
    if (now - (this.markAt.get(client.sessionId) ?? 0) < 1000) return;
    this.markAt.set(client.sessionId, now);
    if (m.clear) { if (this.marks.delete(client.sessionId)) this.sendToMap(f.seat.map, { id: client.sessionId, clear: true }); return; }
    const x = Number(m.x), y = Number(m.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= f.w.map.width || y >= f.w.map.height) return;
    const old = this.marks.get(client.sessionId);
    if (old && old.map !== f.seat.map) this.sendToMap(old.map, { id: client.sessionId, clear: true });
    this.marks.set(client.sessionId, { map: f.seat.map, name: f.p.name, x: Math.round(x), y: Math.round(y), until: now + MARK_TTL });
    this.sendToMap(f.seat.map, { id: client.sessionId, name: f.p.name, x: Math.round(x), y: Math.round(y), ttl: MARK_TTL });
  }
  private sendToMap(map: string, msg: MarkMsg) { for (const s of this.seats.values()) if (s.map === map) s.client.send(MSG.mark, msg); }
  // O que os comandos do chat podem fazer, para quem digitou (`id`).
  private commandContext(id: string, reply: (text: string) => void): CommandContext {
    const found = (sid: string): Found | null => { const f = this.find(sid); return f ? { p: f.p, w: f.w, id: sid } : null; };
    const seat = this.seats.get(id)!;
    return {
      admin: getConfig().admins.some(a => a.toLowerCase() === seat.username.toLowerCase()),
      me: found(id)!,
      reply,
      online: () => [...this.seats.keys()].map(found).filter((f): f is Found => !!f),
      find: name => [...this.seats.keys()].map(found).find(f => f && f.p.name.toLowerCase() === name.toLowerCase()) ?? null,
      announce: text => this.announce(text),
      kick: (sid, reason) => {
        // como "entrou em outro lugar": salva, tira do mundo e só então desconecta (sem guardar o lugar para ele voltar)
        const k = this.find(sid); if (!k) return;
        const { seat: s, w, p } = k;
        s.kicked = true; this.seats.delete(sid); onlineCharacters.delete(s.charId);
        void this.save([[s, p]]);
        w.removePlayer(sid);
        this.broadcastProfile({ id: sid, gone: true });
        s.client.send(MSG.chat, { ch: 'system', text: 'Você foi expulso do servidor.' + (reason ? ` Motivo: ${reason}` : '') } satisfies ChatMsg);
        s.client.leave(4003);   // o cliente volta para a tela de personagens (pode entrar de novo)
        this.sendChat({ ch: 'system', text: `${p.name} foi expulso.` });
      },
      mute: (sid, minutes) => {
        const s = this.seats.get(sid); if (!s) return;
        this.muted.set(s.charId, Date.now() + minutes * 60000);
        s.client.send(MSG.chat, { ch: 'system', text: `Você está sem chat por ${minutes} min.` } satisfies ChatMsg);
      },
      unmute: sid => { const s = this.seats.get(sid); return !!s && this.muted.delete(s.charId); },
      startInvasion: () => startInvasion(this.world),
      backup: () => { const b = getConfig().database.backup; return backupNow(getDb(), configPath(b.dir), b.keep); }
    };
  }
  // Ligar/desligar o PvP (só no modo optional, respeitando cooldown e combat lock).
  private onPvp(client: Client, raw: unknown) {
    const f = this.find(client.sessionId);
    if (!f || !raw || typeof (raw as { on?: unknown }).on !== 'boolean') return;
    const on = (raw as { on: boolean }).on, r = setPvp(f.w, f.p, on);
    if (r.ok) { client.send(MSG.chat, { ch: 'system', text: on ? 'PvP ligado: outros jogadores com PvP podem te atacar.' : 'PvP desligado.' } satisfies ChatMsg); return; }
    const text = r.reason === 'mode'
      ? (f.w.rules.pvp.mode === 'open' ? 'Neste servidor o PvP é sempre ligado.' : 'Neste servidor não há PvP.')
      : `Você só pode desligar o PvP em ${fmtWait(r.wait ?? 0)}.`;
    client.send(MSG.chat, { ch: 'system', text } satisfies ChatMsg);
  }
  // Usar ou largar um item do inventário; recusa vira aviso só para quem pediu.
  private onItem(client: Client, raw: unknown) {
    const f = this.find(client.sessionId), m = raw as { action?: unknown; slot?: unknown; gear?: unknown } | null;
    if (f && m?.action === 'equip') {   // equipar no A ou no C: { gear, slot: 'a' | 'c' }
      const r = isGear(m.gear) && (m.slot === 'a' || m.slot === 'c') ? equipGear(f.p, m.gear, m.slot) : null;
      if (r && !r.ok) client.send(MSG.chat, { ch: 'system', text: r.reason } satisfies ChatMsg);
      return;
    }
    if (!f || !m || !Number.isInteger(m.slot) || (m.slot as number) < 0 || (m.slot as number) >= f.p.bag.length) return;
    const r = m.action === 'use' ? useItem(f.w, f.p, m.slot as number) : m.action === 'drop' ? dropItem(f.w, f.p, m.slot as number) : null;
    if (r && !r.ok) client.send(MSG.chat, { ch: 'system', text: r.reason } satisfies ChatMsg);
  }
  // Comprar ou vender na loja; o mundo confere preço, ouro, espaço e se está perto do lojista.
  private onShop(client: Client, raw: unknown) {
    const f = this.find(client.sessionId), m = raw as { action?: unknown; shop?: unknown; item?: unknown; n?: unknown } | null;
    if (!f || !m || typeof m.shop !== 'string' || !isItem(m.item) || !Number.isInteger(m.n)) return;
    const r = m.action === 'buy' ? buyItem(f.w, f.p, m.shop, m.item, m.n as number) : m.action === 'sell' ? sellItem(f.w, f.p, m.shop, m.item, m.n as number) : null;
    if (r && !r.ok) client.send(MSG.chat, { ch: 'system', text: r.reason } satisfies ChatMsg);
  }
  // Peixe pescado: confere o recorde do servidor; recorde novo é anunciado para todos.
  private async onFish(w: World, id: string, item: ItemId, size: number) {
    const p = w.players.get(id);
    if (!p || !size) return;
    try {
      if (await submitRecord(getDb(), item, size, p.name))
        this.sendChat({ ch: 'system', text: `🏆 ${p.name} pescou ${ITEMS[item].name} de ${size} cm: novo recorde do servidor!` });
    } catch (e) { console.error('[banco] recorde de pesca:', e); }
  }
  private announceKill(w: World, by: string, victim: string) {
    const a = w.players.get(by), v = w.players.get(victim);
    if (a && v && getConfig().pvp.announceKills) this.sendChat({ ch: 'system', text: `${a.name} derrubou ${v.name}` });
  }
  // Aviso para o servidor inteiro: no chat e na tela de cada um.
  private announce(text: string) {
    this.sendChat({ ch: 'system', text });
    for (const [id, seat] of this.seats) this.events.get(seat.map)?.push({ t: 'notice', to: id, text });
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
      const w = this.worlds.get(seat.map)!;
      for (let n = seat.queue.length > CATCH_UP ? 2 : 1; n > 0 && seat.queue.length; n--) {
        const next = seat.queue.shift()!;
        w.stepPlayer(id, next.input); seat.ack = next.seq;
      }
    }
    // Portais e voltas para casa ficam para depois de todos os mundos andarem (trocar de mundo no meio do laço confundiria a ordem).
    const moves: (() => void)[] = [];
    for (const [id, w] of this.worlds) {
      const out = this.events.get(id)!;
      for (const ev of w.step({ players: false })) {
        if (ev.t === 'kill') this.announceKill(w, ev.by, ev.victim);
        else if (ev.t === 'portal') moves.push(() => this.onPortal(ev.id, ev.to, ev.arrive));
        else if (ev.t === 'gohome') moves.push(() => this.goHome(ev.id));
        else if (ev.t === 'announce') this.announce(ev.text);
        else if (ev.t === 'fish') { this.onFish(w, ev.id, ev.item, ev.size); out.push(ev); }
        else out.push(ev);
      }
    }
    for (const m of moves) m();
    const night = sunlight(dayTime(this.world)) < 0.5;
    if (this.night !== null && night !== this.night) this.sendChat({ ch: 'system', text: night ? 'A noite caiu no Vale. Cuidado com os morcegos.' : 'O sol nasceu no Vale.' });
    this.night = night;
    if (++this.ticks % this.sendEvery === 0) { this.sendSnapshots(); for (const k of this.events.keys()) this.events.set(k, []); }
  }
  private sendSnapshots() {
    for (const [id, seat] of this.seats) {
      const w = this.worlds.get(seat.map)!, me = w.players.get(id); if (!me) continue;
      const view = viewRect(w.map, me.x, me.y), near = (o: { x: number; y: number }) => inView(view, o);
      const msg: SnapshotMsg = {
        t: w.tick, ack: seat.ack, me: ownState(me),
        p: [...w.players.values()].filter(p => p.id !== id && near(p)).map(packPlayer),
        e: w.enemies.filter(near).map(packEnemy),
        o: w.thrown.filter(near).map(packThrown),
        a: w.arrows.filter(near).map(packArrow),
        ev: this.events.get(seat.map)!.filter(ev => eventFor(ev, id, view)),
        pvp: { mode: w.rules.pvp.mode, lock: pvpLock(w, me) },
        d: w.drops.filter(near).map(d => packDrop({ ...d, reserved: !!d.owner && d.owner !== id && w.tick < d.ownerUntil, fading: d.expires - w.tick < 600 })),
        b: w.bombs.filter(near).map(packBomb),
        m: w.spells.filter(near).map(packSpell),
        xpNext: me.level >= w.rules.leveling.maxLevel ? -1 : xpToNext(w, me.level),
        day: Math.round(dayTime(w) * 1000) / 1000
      };
      const inv = this.world.invasion;
      if (inv) msg.iv = [inv.phase === 'warn' ? -1 : remaining(this.world), Math.max(0, Math.ceil((inv.until - this.world.tick) / TICK_RATE))];
      if (w.tick % 40 < this.sendEvery) msg.r = [...w.players.values()].filter(o => o.id !== id && o.state !== 'dead').map(o => [o.id, Math.floor(o.x / 16), Math.floor(o.y / 16)]);
      if (seat.bagSent !== me.bagVersion) { msg.bag = me.bag; seat.bagSent = me.bagVersion; }
      const ch = openChests(w, me), mark = ch.join(';') || '-';   // muda ao abrir e quando um baú enche de novo ('' = nunca enviado)
      if (mark !== seat.chestsSent) { msg.ch = ch; seat.chestsSent = mark; }
      seat.client.send(MSG.snapshot, msg);
    }
  }
}

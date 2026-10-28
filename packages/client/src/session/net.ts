import { Client, type Room } from '@colyseus/sdk';
import {
  MSG, World, applyOwnState, bfs, cleanLook, cleanName, encodeInput, tileOf,
  type ChatMsg, type ChatRequest, type GearId, type GearSlot, type ItemId, type GameEvent, type JoinOptions, type PvpInfo, type Slot, type InputState, type MapData, type Player, type PlayerView, type Profile, type ProfileMsg, type ProfileRequest, type SnapshotMsg, type WelcomeMsg
} from '@vale/shared';
import { Interpolator, toFrame } from './interpolate';
import type { Inventory, Scene, Session, Status } from './types';

const OVERLAY_TICKS = 90;   // quanto tempo um corte previsto espera a confirmação do servidor

/* Online: o servidor manda no mundo. O cliente
   - prevê o próprio movimento na hora (um World só com você, sem monstros) e corrige quando o servidor discorda;
   - desenha os outros e os monstros interpolados, ~130 ms no passado;
   - mostra os efeitos do servidor no mesmo instante em que desenha a cena a que eles pertencem. */
export class NetSession implements Session {
  status: Status = 'connecting';
  private room: Room | null = null;
  private pred: World;
  private meId = '';
  private auth: string[][];                                   // mapa como o servidor diz que está
  private overlay = new Map<string, number>();                // cortes previstos ainda sem confirmação → validade
  private pending: { seq: number; input: InputState }[] = [];
  private seq = 0;
  private local = 0; private offset = NaN; private sendEvery = 3;
  private interp = new Interpolator();
  private queued: { t: number; ev: GameEvent[] }[] = [];
  private smooth = { x: 0, y: 0 };
  private profiles = new Map<string, Profile>();
  private pvpInfo: PvpInfo | null = null;
  private bag: Slot[] = []; private xpNext = 50; private day = 0.33; private invasion: [number, number] | null = null;
  private openChests = new Set<string>();
  onWelcome?: (motd: string) => void;
  onChat?: (m: ChatMsg) => void;
  onLeave?: (code: number) => void;
  onMapChange?: () => void;
  leave() { return this.room?.leave(); }

  constructor(data: MapData) {
    this.pred = new World({ ...data, enemies: [] }); this.pred.predicting = true;
    this.auth = this.pred.map.tiles.map(r => r.slice());
  }
  get map() { return this.pred.map; }
  private get player(): Player | undefined { return this.pred.players.get(this.meId); }

  // Entra no mundo; sem resposta em `timeout`, desiste (e, se a entrada chegar atrasada, sai dela na hora).
  async connect(url: string, join: JoinOptions, timeout = 10000) {
    const joining = new Client(url).join('world', join);
    let timer = 0;
    const late = new Promise<never>((_, fail) => { timer = window.setTimeout(() => fail(Object.assign(new Error('O servidor demorou para responder.'), { code: 0 })), timeout); });
    let room: Room;
    try { room = await Promise.race([joining, late]); }
    catch (e) { joining.then(r => r.leave(), () => { }); throw e; }
    finally { clearTimeout(timer); }
    this.room = room;
    room.onMessage(MSG.welcome, (m: WelcomeMsg) => this.welcome(m));
    room.onMessage(MSG.snapshot, (m: SnapshotMsg) => this.snapshot(m));
    room.onMessage(MSG.chat, (m: ChatMsg) => this.onChat?.(m));
    room.onMessage(MSG.profile, (m: ProfileMsg) => { if ('gone' in m) this.profiles.delete(m.id); else this.profiles.set(m.id, m); });
    room.onDrop(() => { this.status = 'reconnecting'; });
    room.onReconnect(() => { this.status = 'online'; });
    room.onLeave(code => { this.status = 'offline'; this.onLeave?.(code); });
    room.send(MSG.hello);
  }

  private welcome(m: WelcomeMsg) {
    this.meId = m.id; this.sendEvery = m.sendEvery;
    // o mapa do servidor manda: se for outro (ou outra versão), recria o mundo da previsão com ele
    if (JSON.stringify(m.map) !== JSON.stringify({ ...this.pred.map.data, enemies: [] })) {
      const changed = !!this.meId && this.pred.players.size > 0;
      this.pred = new World({ ...m.map, enemies: [] }); this.pred.predicting = true;
      this.auth = this.pred.map.tiles.map(r => r.slice());
      if (changed) this.onMapChange?.();
    }
    m.tiles.forEach((row, ty) => [...row].forEach((c, tx) => { this.auth[ty][tx] = c; this.pred.map.set(tx, ty, c); }));
    this.overlay.clear(); this.pending = []; this.queued = []; this.interp.clear(); this.offset = NaN;
    if (!this.player) { for (const id of [...this.pred.players.keys()]) this.pred.removePlayer(id); this.pred.addPlayer(m.id, '', m.at.x, m.at.y); }
    else { const p = this.player; p.x = m.at.x; p.y = m.at.y; }
    this.smooth = { x: 0, y: 0 };
    this.profiles = new Map(m.profiles.map(p => [p.id, p]));
    this.openChests = new Set();   // o servidor manda a lista do mapa novo no próximo snapshot
    this.status = 'online';
    this.onWelcome?.(m.motd);
  }

  private snapshot(s: SnapshotMsg) {
    // relógio: estima o passo do servidor a partir do local, sem saltos pequenos
    const est = s.t - this.local;
    if (Number.isNaN(this.offset) || Math.abs(est - this.offset) > 30) this.offset = est; else this.offset += (est - this.offset) * 0.05;
    this.interp.push(toFrame(s));
    this.pvpInfo = s.pvp; this.xpNext = s.xpNext; this.day = s.day; this.invasion = s.iv ?? null;
    if (s.bag) this.bag = s.bag;
    if (s.ch) this.openChests = new Set(s.ch);
    if (s.ev.length) this.queued.push({ t: s.t, ev: s.ev });
    this.reconcile(s);
  }

  // Volta ao estado que o servidor confirmou e reaplica os inputs que ele ainda não viu.
  private reconcile(s: SnapshotMsg) {
    const p = this.player; if (!p || !s.me) return;
    const bx = p.x, by = p.y;
    applyOwnState(p, s.me);
    this.pending = this.pending.filter(i => i.seq > s.ack);
    for (const i of this.pending) this.predict(i.input);
    // a diferença vira um deslize suave, a não ser que seja grande demais (aí teleporta)
    this.smooth.x += bx - p.x; this.smooth.y += by - p.y;
    if (Math.hypot(this.smooth.x, this.smooth.y) > 24) this.smooth = { x: 0, y: 0 };
  }
  private predict(input: InputState) {
    this.pred.setInput(this.meId, input);
    const evs = this.pred.step({ life: false });
    for (const ev of evs) if (ev.t === 'tile') this.overlay.set(ev.tx + ',' + ev.ty, this.local + OVERLAY_TICKS);
    this.pred.thrown = []; this.pred.arrows = []; this.pred.drops = []; this.pred.bombs = []; this.pred.spells = []; this.pred.regrow.clear();   // objetos voando, drops e regeneração vêm do servidor
    return evs;
  }
  private applyTile(tx: number, ty: number, c: string) {
    this.auth[ty][tx] = c; this.pred.map.set(tx, ty, c); this.overlay.delete(tx + ',' + ty);
  }

  // Mostra na hora para você; o servidor confirma e avisa os outros.
  setProfile(p: ProfileRequest) {
    const clean = { name: cleanName(p.name), look: cleanLook(p.look) };
    if (this.meId) this.profiles.set(this.meId, { id: this.meId, ...clean });
    if (this.status === 'online') this.room?.send(MSG.profile, clean);
  }

  pvp() { return this.pvpInfo; }
  inventory(): Inventory | null {
    const p = this.player; if (!p) return null;
    return { bag: this.bag, gold: p.gold, level: p.level, xp: p.xp, xpNext: this.xpNext, gear: p.gear };
  }
  useItem(slot: number) { if (this.status === 'online') this.room?.send(MSG.item, { action: 'use', slot }); }
  dropItem(slot: number) { if (this.status === 'online') this.room?.send(MSG.item, { action: 'drop', slot }); }
  equip(gear: GearId, slot: GearSlot) { if (this.status === 'online') this.room?.send(MSG.item, { action: 'equip', gear, slot }); }
  shop(action: 'buy' | 'sell', shop: string, item: ItemId, n: number) { if (this.status === 'online') this.room?.send(MSG.shop, { action, shop, item, n }); }
  setPvp(on: boolean) { if (this.status === 'online') this.room?.send(MSG.pvp, { on }); }
  chat(req: ChatRequest) { if (this.status === 'online') this.room?.send(MSG.chat, req); }

  me(): PlayerView | undefined {
    const p = this.player; if (!p) return;
    return { ...p, x: p.x + this.smooth.x, y: p.y + this.smooth.y };
  }
  private get renderTick() { return this.local + this.offset - (this.sendEvery * 2 + 2); }

  step(input: InputState): GameEvent[] {
    this.local++;
    this.smooth.x *= 0.85; this.smooth.y *= 0.85;
    const out: GameEvent[] = [];
    if (this.status === 'online' && this.player && this.room) {
      const seq = ++this.seq;
      this.pending.push({ seq, input });
      this.room.send(MSG.input, encodeInput(seq, input));
      // da previsão só saem os efeitos que você mesmo causou; o resto vem do servidor
      for (const ev of this.predict(input)) if ((ev.t === 'sfx' || ev.t === 'burst' || ev.t === 'shake') && ev.by === this.meId) out.push(ev);
    }
    for (const [k, until] of this.overlay) if (this.local > until) { const [tx, ty] = k.split(',').map(Number); this.pred.map.set(tx, ty, this.auth[ty][tx]); this.overlay.delete(k); }
    // eventos do servidor saem quando a cena interpolada chega ao momento deles
    const rt = this.renderTick;
    while (this.queued.length && this.queued[0].t <= rt + this.sendEvery) {
      for (const ev of this.queued.shift()!.ev) { if (ev.t === 'tile') this.applyTile(ev.tx, ev.ty, ev.c); else out.push(ev); }
    }
    return out;
  }

  scene(withFlow: boolean): Scene {
    const v = this.interp.at(this.renderTick), me = this.me();
    const players = me ? [me, ...v.players] : v.players;
    const flow = withFlow && players.length ? bfs(this.map, players.map(p => tileOf(this.map, p.x, p.y)), 32) : null;
    const chests = (this.map.data.chests ?? []).map(c => ({ x: c.x, y: c.y, open: this.openChests.has(`${c.x},${c.y}`) }));
    return { map: this.map, meId: this.meId, players, enemies: v.enemies, thrown: v.thrown, arrows: v.arrows, drops: v.drops, bombs: v.bombs, spells: v.spells, chests, npcs: this.map.data.npcs ?? [],
      day: this.day, invasion: this.invasion, dark: !!this.map.data.dark, profiles: this.profiles, flow };
  }
}

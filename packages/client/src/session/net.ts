import { Client, type Room } from '@colyseus/sdk';
import {
  MSG, TS, World, along, applyOwnLife, applyOwnState, decodeInput, ownSimKey, ownState, blocksShot, hitsEnemy, swordPose, type Arrow, type EnemyView, base64ToBits, bfs, cleanLook, cleanName, encodeInput, exploredSize, reveal, tileOf, unpackDrop, type Drop, type MarkMsg,
  type ChatMsg, type ChatRequest, type GearRules, type ItemCatalogMsg, type PartyMsg, type PartyRequest, type GearId, type GearSlot, type WearSlot, type ItemId, type GameEvent, type JoinOptions, type PvpInfo, type Slot, type InputState, type MapData, type Player, type PlayerView, type Profile, type ProfileMsg, type ProfileRequest, type FramePart, type SnapshotMsg, type TelemetryMsg, type WelcomeMsg
} from '@vale/shared';
import { Interpolator, SnapshotClock, toFrame } from './interpolate';
import { setCatalog } from '../render/icons';
import type { Inventory, MapState, Mark, PartyState, Scene, Session, Status } from './types';
import type { NetDebug } from '../ui/debug';

const OVERLAY_TICKS = 90;   // quanto tempo um corte previsto espera a confirmação do servidor
// Corpo do monstro, igual ao do servidor (createEnemy): o Rei é maior, o besouro um pouco mais alto.
const body = (e: EnemyView) => ({ hw: e.type === 'king' ? 12 : 6, hh: e.type === 'king' ? 8 : e.type === 'beetle' ? 5 : 4 });

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
  private local = 0; private clock = new SnapshotClock(); private sendEvery = 3;
  private interp = new Interpolator();
  private queued: { t: number; ev: GameEvent[] }[] = [];
  private smooth = { x: 0, y: 0 };
  private profiles = new Map<string, Profile>();
  private pvpInfo: PvpInfo | null = null;
  private bag: Slot[] = []; private xpNext = 50; private day = 0.33; private invasion: [number, number] | null = null;
  private openChests = new Set<string>();
  onWelcome?: (motd: string) => void;
  onChat?: (m: ChatMsg) => void;
  onParty?: (m: PartyMsg) => void;
  private partyNow: PartyState | null = null;
  private rulesNow: GearRules | null = null;
  private keys: number | null = null;
  private wearNow: Record<WearSlot, Slot> = { head: null, body: null, feet: null, neck: null, ring: null };
  private mapId = '';   // id do mapa (como o servidor chama), para os fragmentos achados
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
    room.onMessage(MSG.mark, (m: MarkMsg) => this.onMark(m));
    room.onMessage(MSG.party, (m: PartyMsg) => this.onParty?.(m));
    room.onMessage(MSG.rules, (m: GearRules) => { this.rulesNow = m; });
    room.onMessage(MSG.items, (m: ItemCatalogMsg) => setCatalog(m));   // itens do servidor (inclusive os novos da Oficina)
    room.onDrop(() => { this.status = 'reconnecting'; });
    room.onReconnect(() => { this.status = 'online'; });
    room.onLeave(code => { this.status = 'offline'; this.onLeave?.(code); });
    room.send(MSG.hello);
  }

  private onMark(m: MarkMsg) {
    if ('clear' in m) this.marks.delete(m.id);
    else this.marks.set(m.id, { id: m.id, name: m.name, x: m.x, y: m.y, until: Date.now() + m.ttl });
  }
  private welcome(m: WelcomeMsg) {
    this.meId = m.id; this.sendEvery = m.sendEvery; this.mapId = m.mapId ?? '';
    this.explored = base64ToBits(m.explored ?? '', exploredSize(m.map.cols, m.map.rows));
    this.safe = m.safe ?? [];
    this.marks = new Map((m.marks ?? []).flatMap(k => 'clear' in k ? [] : [[k.id, { id: k.id, name: k.name, x: k.x, y: k.y, until: Date.now() + k.ttl }] as const]));
    this.roster = [];
    // o mapa do servidor manda: se for outro (ou outra versão), recria o mundo da previsão com ele
    if (JSON.stringify(m.map) !== JSON.stringify({ ...this.pred.map.data, enemies: [] })) {
      const changed = !!this.meId && this.pred.players.size > 0;
      this.pred = new World({ ...m.map, enemies: [] }); this.pred.predicting = true;
      this.auth = this.pred.map.tiles.map(r => r.slice());
      if (changed) this.onMapChange?.();
    }
    m.tiles.forEach((row, ty) => [...row].forEach((c, tx) => { this.auth[ty][tx] = c; this.pred.map.set(tx, ty, c); }));
    this.overlay.clear(); this.pending = []; this.queued = []; this.myArrows = []; this.interp.clear(); this.clock.reset(); this.predicted.clear(); this.toReconcile = null; this.felt.clear(); this.flash.clear(); this.echoes = [];
    if (!this.player) { for (const id of [...this.pred.players.keys()]) this.pred.removePlayer(id); this.pred.addPlayer(m.id, '', m.at.x, m.at.y); this.syncBag(); }
    else { const p = this.player; p.x = m.at.x; p.y = m.at.y; }
    this.smooth = { x: 0, y: 0 };
    this.profiles = new Map(m.profiles.map(p => [p.id, p]));
    this.openChests = new Set();   // o servidor manda a lista do mapa novo no próximo snapshot
    this.status = 'online';
    this.onWelcome?.(m.motd);
  }

  // Itens no chão do último snapshot, no formato do mundo, para a previsão saber que o B vai pegar algo
  // (só diz que pegaria; o servidor entrega). Reservado a outro: nunca pegável aqui.
  private dropsNow: Drop[] = [];
  // Mapa do mundo: o explorado vem do servidor ao entrar no mapa; daí em diante o cliente revela igual a ele, sem esperar.
  private explored = new Uint8Array(0); private safe: string[] = [];
  private marks = new Map<string, Mark>(); private roster: { id: string; x: number; y: number }[] = [];
  mapState(): MapState {
    const p = this.player, map = this.pred.map;
    if (p && this.explored.length === exploredSize(map.cols, map.rows)) reveal(this.explored, map.cols, map.rows, Math.floor(p.x / 16), Math.floor(p.y / 16));
    const now = Date.now();
    for (const [id, k] of this.marks) if (k.until <= now) this.marks.delete(id);
    return { explored: this.explored, safe: this.safe, marks: [...this.marks.values()], roster: this.roster };
  }
  mark(x: number, y: number) { if (this.status === 'online') this.room?.send(MSG.mark, { x, y }); }
  clearMark() { if (this.status === 'online') this.room?.send(MSG.mark, { clear: true }); }
  private snapshot(s: SnapshotMsg) {
    const t0 = performance.now();
    this.onSnapshot(s);
    this.snapMs = Math.max(this.snapMs, performance.now() - t0);
  }
  // /debug: tempo de partes da previsão neste quadro (o main soma às partes do quadro)
  private times = new Map<FramePart, number>();
  private time(k: FramePart, from: number) { this.times.set(k, (this.times.get(k) ?? 0) + performance.now() - from); }
  takeTimes() { const t = [...this.times]; this.times.clear(); return t; }
  private onSnapshot(s: SnapshotMsg) {
    this.dropsNow = s.d.map(unpackDrop).map(d => ({ id: d.id, item: d.item, n: d.n, x: d.x, y: d.y, owner: d.reserved ? '?' : null, ownerUntil: d.reserved ? Infinity : 0, expires: Infinity, born: -Infinity }));
    const now = performance.now();
    if (this.snapAt) this.gapMax = Math.max(this.gapMax, now - this.snapAt);
    this.snapAt = now; this.snaps++;
    this.clock.push(s.t, now);
    this.interp.push(toFrame(s));
    this.keys = s.kc ?? null;
    this.pvpInfo = s.pvp; this.xpNext = s.xpNext; this.day = s.day; this.invasion = s.iv ?? null;
    this.partyNow = s.g ? { leader: s.g.leader, members: s.g.m.map(([id, name, level, hp, dead, x, y, where]) => ({ id, name, level, hp, dead: dead === 1, at: x < 0 ? null : { x, y }, where })) } : null;
    if (s.r) this.roster = s.r.map(([id, x, y]) => ({ id, x, y }));
    if (s.bag) { this.bag = s.bag; this.syncBag(); }
    if (s.wear) this.wearNow = s.wear;
    if (s.ch) this.openChests = new Set(s.ch);
    if (s.ev.length) this.queued.push({ t: s.t, ev: s.ev });
    this.toReconcile = s;   // confere a previsão uma vez por passo, com o mais novo (ver step)
  }

  /* Volta ao estado que o servidor confirmou e reaplica os inputs que ele ainda não viu. Refazer a previsão custa um
     passo de simulação por input pendente (no celular, centenas por segundo); então, se o servidor chegou exatamente
     onde a previsão chegou naquele input, a previsão de agora já está certa: só copia vida, ouro e afins. */
  private toReconcile: SnapshotMsg | null = null;   // snapshot mais novo ainda não conferido com a previsão
  private predicted = new Map<number, string>();   // seq → estado previsto depois desse input (só o que a previsão simula)
  private reconcile(s: SnapshotMsg) {
    const p = this.player; if (!p || !s.me) return;
    const agreed = this.predicted.get(s.ack) === ownSimKey(s.me);
    for (const seq of this.predicted.keys()) if (seq <= s.ack) this.predicted.delete(seq);
    this.pending = this.pending.filter(i => i.seq > s.ack);
    if (agreed) { applyOwnLife(p, s.me); return; }
    const bx = p.x, by = p.y;
    applyOwnState(p, s.me);
    this.replays += this.pending.length; this.pendingMax = Math.max(this.pendingMax, this.pending.length);
    for (const i of this.pending) this.predict(i.input);
    // a diferença vira um deslize suave, a não ser que seja grande demais (aí teleporta)
    this.smooth.x += bx - p.x; this.smooth.y += by - p.y;
    if (Math.hypot(this.smooth.x, this.smooth.y) > 24) this.smooth = { x: 0, y: 0 };
  }
  private predict(input: InputState, live = false) {
    const t0 = performance.now();
    this.pred.setInput(this.meId, input);
    const evs = this.pred.step({ life: false });
    if (live) this.time('sim_mundo', t0);
    // flechas que você acabou de soltar: seguem aqui na hora (o servidor não manda as suas de volta; ver myArrows)
    if (live) for (const a of this.pred.arrows) if (a.owner === this.meId) this.myArrows.push({ ...a });
    for (const ev of evs) if (ev.t === 'tile') this.overlay.set(ev.tx + ',' + ev.ty, this.local + OVERLAY_TICKS);
    this.pred.thrown = []; this.pred.arrows = []; this.pred.drops = this.dropsNow; this.pred.bombs = []; this.pred.spells = []; this.pred.regrow.clear();   // objetos voando, drops e regeneração vêm do servidor
    return evs;
  }
  /* ---------- Suas flechas ----------
     O arco é previsto (anda na hora), então a flecha também: se viesse do servidor, chegaria atrasada (a rede mais a
     interpolação), descolada do arco. Aqui ela voa, crava na parede e some ao acertar um monstro como no servidor;
     quem decide o dano continua sendo o servidor. */
  private myArrows: Arrow[] = [];
  private lastEnemies: EnemyView[] = [];
  private stepArrows(out: GameEvent[]) {
    for (const a of this.myArrows) {
      if (a.stuck) { if (--a.stuck <= 0) a.dead = true; continue; }
      a.x += a.vx; a.y += a.vy;
      if (--a.life <= 0) { a.dead = true; continue; }
      const tx = a.x + Math.cos(a.ang) * 5, ty = a.y + Math.sin(a.ang) * 5, cx = Math.floor(tx / TS), cy = Math.floor(ty / TS);
      if (!this.map.inBounds(cx, cy)) { a.dead = true; continue; }
      if (blocksShot(this.map.tiles[cy][cx])) { a.stuck = 30; continue; }
      // mesmas caixas do servidor (createEnemy): o Rei é maior; atordoado, a flecha passa direto
      const e = this.lastEnemies.find(e => e.hurtT === 0 && !a.hits?.includes(e.id) && Math.abs(e.x - tx) < body(e).hw + 2 && Math.abs(e.y - ty) < body(e).hh + 5);
      if (e) {
        if (e.type !== 'chicken' && e.hp > 0) this.feel(e, out);
        if (a.pierce) { a.pierce--; (a.hits ??= []).push(e.id); } else a.dead = true;   // flecha que atravessa (efeito): segue
      }
    }
    this.myArrows = this.myArrows.filter(a => !a.dead);
  }
  /* ---------- Seus golpes ----------
     O dano chega do servidor uma ida e volta depois, com o monstro ~130 ms no passado. Para o golpe não parecer
     atrasado, a espada (ou a sua flecha) que encosta num monstro como você o vê já toca o som e faz ele piscar; o
     servidor continua decidindo o dano, e o som dele, quando chega, é descartado (já tocou). */
  private felt = new Set<number>();                       // monstros que este golpe já acertou
  private feltState = '';
  private flash = new Map<number, number>();              // monstro → até quando pisca (passo local)
  private echoes: { x: number; y: number; until: number }[] = [];   // sons de acerto já tocados, à espera do servidor
  private feelHits(out: GameEvent[]) {
    const p = this.player, s = p && p.state !== 'charge' ? swordPose(p) : null;
    if (!p || !s || p.state !== this.feltState) this.felt.clear();
    this.feltState = p?.state ?? '';
    if (!p || !s) return;
    for (const f of p.state === 'dash' ? [0.6, 1.0] : [0.5, 0.8, 1.05]) {
      const [x, y] = along(s, f);
      for (const e of this.lastEnemies) {
        if (e.type === 'chicken' || e.hp <= 0 || e.hurtT > 0 || this.felt.has(e.id) || !hitsEnemy({ ...e, ...body(e) }, x, y)) continue;
        this.felt.add(e.id); this.feel(e, out);
      }
    }
  }
  private feel(e: EnemyView, out: GameEvent[]) {
    this.flash.set(e.id, this.local + 16);
    this.echoes.push({ x: e.x, y: e.y, until: this.local + 60 });
    out.push({ t: 'sfx', name: 'hit', x: e.x, y: e.y, by: this.meId });
  }
  // Som de acerto do servidor perto de um que você já ouviu: era o mesmo golpe.
  private echoed(ev: GameEvent) {
    if (ev.t !== 'sfx' || ev.name !== 'hit' || ev.by) return false;
    this.echoes = this.echoes.filter(h => h.until > this.local);
    const i = this.echoes.findIndex(h => Math.abs(h.x - ev.x) < 32 && Math.abs(h.y - ev.y) < 32);
    if (i >= 0) this.echoes.splice(i, 1);
    return i >= 0;
  }
  // A previsão precisa da mochila: é dela que sai o que está no A e no C (cajado, gancho, uma espada da Oficina).
  // Sem isso, a previsão usava a espada e o arco de base, discordava do servidor e refazia os passos.
  private syncBag() { const p = this.player; if (p) p.bag = this.bag.map(s => s && { ...s, ...(s.roll ? { roll: { ...s.roll } } : {}) }); }
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
  party() { return this.partyNow; }
  gearRules() { return this.rulesNow; }
  partyRequest(req: PartyRequest) { if (this.status === 'online') this.room?.send(MSG.party, req); }
  inventory(): Inventory | null {
    const p = this.player; if (!p) return null;
    return { bag: this.bag, gold: p.gold, level: p.level, xp: p.xp, xpNext: this.xpNext, gear: p.gear, stats: p.stats, maxHp: p.maxHp, maxMp: p.maxMp, wear: this.wearNow };
  }
  useItem(slot: number) { if (this.status === 'online') this.room?.send(MSG.item, { action: 'use', slot }); }
  dropItem(slot: number) { if (this.status === 'online') this.room?.send(MSG.item, { action: 'drop', slot }); }
  equip(gear: GearId, slot: GearSlot) { if (this.status === 'online') this.room?.send(MSG.item, { action: 'equip', gear, slot }); }
  wear(slot: number) { if (this.status === 'online') this.room?.send(MSG.item, { action: 'wear', slot }); }
  unwear(part: WearSlot) { if (this.status === 'online') this.room?.send(MSG.item, { action: 'unwear', slot: part }); }
  sortBag() { if (this.status === 'online') this.room?.send(MSG.item, { action: 'sort' }); }
  shop(action: 'buy' | 'sell', shop: string, item: ItemId, n: number) { if (this.status === 'online') this.room?.send(MSG.shop, { action, shop, item, n }); }
  setPvp(on: boolean) { if (this.status === 'online') this.room?.send(MSG.pvp, { on }); }
  chat(req: ChatRequest) { if (this.status === 'online') this.room?.send(MSG.chat, req); }

  me(): PlayerView | undefined {
    const p = this.player; if (!p) return;
    return { ...p, x: p.x + this.smooth.x, y: p.y + this.smooth.y };
  }
  // Para o /debug: o pior desde a última leitura.
  private snapAt = 0; private gapMax = 0; private snaps = 0; private replays = 0; private pendingMax = 0; private snapMs = 0;
  debug(): NetDebug {
    const d = { gap: this.gapMax, delay: this.clock.delay(this.sendEvery) * 1000 / 60, ahead: this.interp.ahead, frozen: this.interp.frozen, snaps: this.snaps,
      replays: this.replays, pending: this.pendingMax, snapMs: this.snapMs };
    this.snapMs = 0; this.gapMax = 0; this.snaps = 0; this.replays = 0; this.pendingMax = 0; this.interp.ahead = 0; this.interp.frozen = 0;
    return d;
  }
  telemetry(m: TelemetryMsg) { if (this.status === 'online') this.room?.send(MSG.telemetry, m); }
  private get renderTick() { return this.clock.tick(performance.now()) - this.clock.delay(this.sendEvery); }

  step(input: InputState): GameEvent[] {
    this.local++;
    // Depois de um buraco na rede chegam dezenas de snapshots juntos. Conferir a previsão em cada um refazia todos os
    // inputs pendentes de novo e de novo (o /debug mostrou 1.073 passos refeitos num segundo); o mais novo basta.
    if (this.toReconcile) { const t = performance.now(); this.reconcile(this.toReconcile); this.toReconcile = null; this.time('rede_snapshot', t); }
    const out: GameEvent[] = [];
    this.stepArrows(out);
    this.smooth.x *= 0.85; this.smooth.y *= 0.85;
    if (this.status === 'online' && this.player && this.room) {
      const seq = ++this.seq, msg = encodeInput(seq, input);
      input = decodeInput(msg)!.input;   // a previsão usa o mesmo input que o servidor recebe (mira arredondada): assim os dois chegam ao mesmo lugar
      this.pending.push({ seq, input });
      this.room.send(MSG.input, msg);
      // da previsão só saem os efeitos que você mesmo causou; o resto vem do servidor
      for (const ev of this.predict(input, true)) if ((ev.t === 'sfx' || ev.t === 'burst' || ev.t === 'shake') && ev.by === this.meId) out.push(ev);
      const tk = performance.now();
      this.predicted.set(seq, ownSimKey(ownState(this.player)));
      this.time('sim_comparacao', tk);
      this.feelHits(out);
    }
    for (const [k, until] of this.overlay) if (this.local > until) { const [tx, ty] = k.split(',').map(Number); this.pred.map.set(tx, ty, this.auth[ty][tx]); this.overlay.delete(k); }
    // eventos do servidor saem quando a cena interpolada chega ao momento deles
    const rt = this.renderTick;
    while (this.queued.length && this.queued[0].t <= rt + this.sendEvery) {
      for (const ev of this.queued.shift()!.ev) { if (ev.t === 'tile') this.applyTile(ev.tx, ev.ty, ev.c); else if (!this.echoed(ev)) out.push(ev); }
    }
    return out;
  }

  scene(withFlow: boolean): Scene {
    const v = this.interp.at(this.renderTick), me = this.me();
    for (const [id, until] of this.flash) if (until <= this.local) this.flash.delete(id);
    if (this.flash.size) v.enemies = v.enemies.map(e => { const until = this.flash.get(e.id); return until && e.hurtT === 0 ? { ...e, hurtT: until - this.local } : e; });
    this.lastEnemies = v.enemies;
    const players = me ? [me, ...v.players] : v.players;
    const flow = withFlow && players.length ? bfs(this.map, players.map(p => tileOf(this.map, p.x, p.y)), 32) : null;
    const chests = (this.map.data.chests ?? []).map(c => ({ x: c.x, y: c.y, open: this.openChests.has(`${c.x},${c.y}`) }));
    return { map: this.map, meId: this.meId, players, enemies: v.enemies, thrown: v.thrown, arrows: [...v.arrows, ...this.myArrows], drops: v.drops, bombs: v.bombs, spells: v.spells, chests, npcs: this.map.data.npcs ?? [],
      day: this.day, invasion: this.invasion, dark: !!this.map.data.dark, profiles: this.profiles, flow, keys: this.keys,
      fragments: (this.map.data.fragments ?? []).filter(f => !this.player?.fragments.includes(`${this.mapId}:${f.x},${f.y}`)) };
  }
}

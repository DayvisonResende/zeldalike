import { MARK_TTL, World, fragmentKey, buyItem, exploredOf, equipGear, sellItem, type GearId, type GearSlot, type ItemId, dayTime, remaining, dropItem, openChests, pvpLock, setPvp, useItem, xpToNext, cleanChat, type ItemResult, cleanLook, cleanName, type ChatMsg, type ChatRequest, type GameEvent, type InputState, type MapData, type Player, type Profile, type ProfileRequest } from '@vale/shared';
import type { Inventory, MapState, Mark, Scene, Session, Status } from './types';

// Sem servidor: o mundo inteiro roda no navegador. Útil para desenvolver e quando o servidor está fora.
export class LocalSession implements Session {
  status: Status = 'local';
  onChat?: (m: ChatMsg) => void;
  private world: World;
  private player: Player;
  constructor(data: MapData, profile: ProfileRequest) {
    this.world = new World(data, undefined, (Math.random() * 2 ** 31) | 0);
    this.player = this.world.addPlayer('local', cleanName(profile.name), undefined, undefined, cleanLook(profile.look));
  }
  get map() { return this.world.map; }
  me() { return this.player; }
  private myMark: Mark | null = null;
  mapState(): MapState {
    if (this.myMark && this.myMark.until <= Date.now()) this.myMark = null;
    return { explored: exploredOf(this.world, this.player), safe: this.world.rules.pvp.safeZones, marks: this.myMark ? [this.myMark] : [], roster: [] };
  }
  mark(x: number, y: number) { this.myMark = { id: this.player.id, name: this.player.name, x, y, until: Date.now() + MARK_TTL }; }
  clearMark() { this.myMark = null; }
  gearRules() { const r = this.world.rules; return { weapons: r.weapons, magic: r.magic, gear: r.gear }; }
  party() { return null; }   // offline não tem grupo
  partyRequest() { }
  // Sozinho no mundo: a mensagem só volta para você.
  chat(req: ChatRequest) { const text = cleanChat(req.text, 120); if (text) this.onChat?.({ ch: req.ch, text, from: this.player.id, name: this.player.name }); }
  inventory(): Inventory {
    const p = this.player, next = xpToNext(this.world, p.level);
    return { bag: p.bag, gold: p.gold, level: p.level, xp: p.xp, xpNext: isFinite(next) ? next : -1, gear: p.gear, stats: p.stats, maxHp: p.maxHp, maxMp: p.maxMp };
  }
  private itemResult(r: ItemResult) { if (!r.ok) this.onChat?.({ ch: 'system', text: r.reason }); }
  useItem(slot: number) { this.itemResult(useItem(this.world, this.player, slot)); }
  dropItem(slot: number) { this.itemResult(dropItem(this.world, this.player, slot)); }
  equip(gear: GearId, slot: GearSlot) { this.itemResult(equipGear(this.player, gear, slot)); }
  shop(action: 'buy' | 'sell', shop: string, item: ItemId, n: number) { this.itemResult((action === 'buy' ? buyItem : sellItem)(this.world, this.player, shop, item, n)); }
  pvp() { return { mode: this.world.rules.pvp.mode, lock: pvpLock(this.world, this.player) }; }
  setPvp(on: boolean) {
    const r = setPvp(this.world, this.player, on);
    this.onChat?.({ ch: 'system', text: r.ok ? (on ? 'PvP ligado.' : 'PvP desligado.') : 'Não dá para mudar o PvP agora.' });
  }
  setProfile(p: ProfileRequest) { this.player.name = cleanName(p.name); this.player.look = cleanLook(p.look); }
  step(input: InputState): GameEvent[] {
    this.world.setInput(this.player.id, input);
    return this.world.step().map((ev): GameEvent => ev.t === 'portal' ? { t: 'notice', to: this.player.id, text: 'Esse portal leva a outro mapa: só funciona online.' } : ev)
      .filter(ev => !('to' in ev) || ev.to === this.player.id);
  }
  scene(): Scene {
    const w = this.world;
    const profiles = new Map<string, Profile>([...w.players.values()].map(p => [p.id, { id: p.id, name: p.name, look: p.look }]));
    const drops = w.drops.map(d => ({ ...d, reserved: !!d.owner && d.owner !== this.player.id && w.tick < d.ownerUntil, fading: d.expires - w.tick < 600 }));
    const open = new Set(openChests(w, this.player)), chests = (w.map.data.chests ?? []).map(c => ({ x: c.x, y: c.y, open: open.has(`${c.x},${c.y}`) }));
    return { map: w.map, meId: this.player.id, players: [...w.players.values()], enemies: w.enemies, thrown: w.thrown, arrows: w.arrows, drops, bombs: w.bombs, spells: w.spells, chests, npcs: w.map.data.npcs ?? [], day: dayTime(w), invasion: w.invasion ? [w.invasion.phase === 'warn' ? -1 : remaining(w), Math.max(0, Math.ceil((w.invasion.until - w.tick) / 60))] : null, dark: !!w.map.data.dark, profiles, flow: w.flow,
      keys: w.map.data.keys || w.map.data.rooms ? w.keys : null, fragments: (w.map.data.fragments ?? []).filter(f => !this.player.fragments.includes(fragmentKey(w, f.x, f.y))) };
  }
}

import { World, dropItem, pvpLock, setPvp, useItem, xpToNext, cleanChat, type ItemResult, cleanLook, cleanName, type ChatMsg, type ChatRequest, type GameEvent, type InputState, type MapData, type Player, type Profile, type ProfileRequest } from '@vale/shared';
import type { Inventory, Scene, Session, Status } from './types';

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
  // Sozinho no mundo: a mensagem só volta para você.
  chat(req: ChatRequest) { const text = cleanChat(req.text, 120); if (text) this.onChat?.({ ch: req.ch, text, from: this.player.id, name: this.player.name }); }
  inventory(): Inventory {
    const p = this.player, next = xpToNext(this.world, p.level);
    return { bag: p.bag, gold: p.gold, level: p.level, xp: p.xp, xpNext: isFinite(next) ? next : -1 };
  }
  private itemResult(r: ItemResult) { if (!r.ok) this.onChat?.({ ch: 'system', text: r.reason }); }
  useItem(slot: number) { this.itemResult(useItem(this.world, this.player, slot)); }
  dropItem(slot: number) { this.itemResult(dropItem(this.world, this.player, slot)); }
  pvp() { return { mode: this.world.rules.pvp.mode, lock: pvpLock(this.world, this.player) }; }
  setPvp(on: boolean) {
    const r = setPvp(this.world, this.player, on);
    this.onChat?.({ ch: 'system', text: r.ok ? (on ? 'PvP ligado.' : 'PvP desligado.') : 'Não dá para mudar o PvP agora.' });
  }
  setProfile(p: ProfileRequest) { this.player.name = cleanName(p.name); this.player.look = cleanLook(p.look); }
  step(input: InputState): GameEvent[] {
    this.world.setInput(this.player.id, input);
    return this.world.step().filter(ev => !('to' in ev) || ev.to === this.player.id);
  }
  scene(): Scene {
    const w = this.world;
    const profiles = new Map<string, Profile>([...w.players.values()].map(p => [p.id, { id: p.id, name: p.name, look: p.look }]));
    const drops = w.drops.map(d => ({ ...d, reserved: !!d.owner && d.owner !== this.player.id && w.tick < d.ownerUntil, fading: d.expires - w.tick < 600 }));
    return { map: w.map, meId: this.player.id, players: [...w.players.values()], enemies: w.enemies, thrown: w.thrown, arrows: w.arrows, drops, profiles, flow: w.flow };
  }
}

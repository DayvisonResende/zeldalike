import { World, pvpLock, setPvp, cleanChat, cleanLook, cleanName, type ChatMsg, type ChatRequest, type GameEvent, type InputState, type MapData, type Player, type Profile, type ProfileRequest } from '@vale/shared';
import type { Scene, Session, Status } from './types';

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
    return { map: w.map, meId: this.player.id, players: [...w.players.values()], enemies: w.enemies, thrown: w.thrown, arrows: w.arrows, profiles, flow: w.flow };
  }
}

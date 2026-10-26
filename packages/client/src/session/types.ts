import type { ArrowView, ChatMsg, ChatRequest, DistMap, PvpInfo, EnemyView, GameEvent, InputState, PlayerView, Profile, ProfileRequest, ThrownView, WorldMap } from '@vale/shared';

// Tudo que o renderer precisa para desenhar um quadro.
export interface Scene {
  map: WorldMap; meId: string;
  players: PlayerView[]; enemies: EnemyView[]; thrown: ThrownView[]; arrows: ArrowView[];
  profiles: ReadonlyMap<string, Profile>;   // nome e aparência de cada jogador
  flow: DistMap | null;
}
export type Status = 'connecting' | 'online' | 'reconnecting' | 'offline' | 'local';

// O jogo não sabe se está online ou não: fala sempre com uma Session.
export interface Session {
  readonly map: WorldMap;
  status: Status;
  me(): PlayerView | undefined;
  step(input: InputState): GameEvent[];   // avança 1/60 s; devolve o que mostrar (já filtrado para você)
  scene(withFlow: boolean): Scene;
  setProfile(p: ProfileRequest): void;   // troca nome e aparência
  chat(req: ChatRequest): void;
  pvp(): PvpInfo | null;                 // modo do servidor e trava para desligar
  setPvp(on: boolean): void;
  onChat?: (m: ChatMsg) => void;         // mensagens que chegam (inclusive as suas)
}

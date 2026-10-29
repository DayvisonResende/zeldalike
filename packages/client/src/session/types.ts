import type { ArrowView, GearId, GearSlot, ItemId, SpellView, BombView, ChatMsg, ChatRequest, DistMap, DropView, Npc, PvpInfo, Slot, EnemyView, GameEvent, InputState, PlayerView, Profile, ProfileRequest, ThrownView, WorldMap } from '@vale/shared';

// Tudo que o renderer precisa para desenhar um quadro.
export interface Scene {
  map: WorldMap; meId: string;
  players: PlayerView[]; enemies: EnemyView[]; thrown: ThrownView[]; arrows: ArrowView[]; drops: DropView[]; bombs: BombView[]; spells: SpellView[];
  chests: { x: number; y: number; open: boolean }[];   // em tiles; open = vazio para você
  npcs: Npc[];
  day: number;     // 0 = meia-noite, 0,5 = meio-dia
  dark: boolean;   // mapa sempre escuro (caverna)
  invasion: [number, number] | null;   // [gelecas restantes (-1 = aviso), segundos] enquanto houver invasão
  profiles: ReadonlyMap<string, Profile>;   // nome e aparência de cada jogador
  flow: DistMap | null;
}
// O que o mapa do mundo e o minimapa mostram: o que você já viu, as zonas seguras, os marcadores e onde está cada um.
export interface Mark { id: string; name: string; x: number; y: number; until: number }   // x, y em pixels; until: Date.now()
export interface MapState { explored: Uint8Array; safe: readonly string[]; marks: Mark[]; roster: { id: string; x: number; y: number }[] }   // roster em tiles
// Progresso e inventário do seu personagem.
export interface Inventory { bag: Slot[]; gold: number; level: number; xp: number; xpNext: number; gear: Record<GearSlot, GearId> }
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
  inventory(): Inventory | null;
  useItem(slot: number): void;
  dropItem(slot: number): void;
  equip(gear: GearId, slot: GearSlot): void;   // põe no botão A ou C
  mapState(): MapState;
  mark(x: number, y: number): void;            // marcador "venham aqui!" (pixels)
  clearMark(): void;
  shop(action: 'buy' | 'sell', shop: string, item: ItemId, n: number): void;   // comprar/vender (o mundo confere tudo)
  onChat?: (m: ChatMsg) => void;         // mensagens que chegam (inclusive as suas)
}

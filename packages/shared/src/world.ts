import { DEFAULT_RULES, type Rules } from './rules';
import { Rng } from './rng';
import type { GameEvent } from './events';
import { createPlayer, type Player } from './entities/player';
import type { Enemy } from './entities/enemy';
import type { InputState } from './input';
import type { Look } from './looks';
import { emptyInventory } from './items';
import { WorldMap, type MapData } from './world/map';
import type { DistMap } from './world/pathfinding';
import { refreshFlow, separate, updateEnemy } from './systems/ai';
import { contact } from './systems/carry';
import { updatePlayer } from './systems/control';
import { updateLife } from './systems/life';
import { inSafeZone, updatePvp } from './systems/pvp';
import { updateLoot, type Drop } from './systems/loot';
import { updatePortals } from './systems/portals';
import { updateBombs, type Bomb } from './systems/bombs';
import { updateCarried } from './systems/throwing';
import { updateArrows, updateThrown, type Arrow, type Thrown } from './systems/projectiles';
import { updateRegrowth, type Regrow } from './systems/regrowth';
import { createEnemy, inPeriod, updateSpawns, type Spawn } from './systems/spawner';
import { updateInvasion, type Invasion } from './systems/invasion';
import { updateSpells, type Spell } from './systems/magic';
import { updateBlocks, type BlockHome } from './systems/blocks';
import { updateExplore } from './systems/explore';

// O mundo inteiro: mapa, jogadores, inimigos e objetos voando. Roda igual no servidor e no navegador.
export class World {
  readonly map: WorldMap;
  rules: Rules;
  readonly rng: Rng;
  tick = 0;
  nextId = 1;
  players = new Map<string, Player>();
  enemies: Enemy[] = [];
  thrown: Thrown[] = [];
  arrows: Arrow[] = [];
  drops: Drop[] = [];
  bombs: Bomb[] = [];
  spells: Spell[] = [];
  blockHomes = new Map<string, BlockHome>();   // bloco fora do lugar ("x,y" de agora) → de onde veio
  plateGates = new Set<string>();             // portões que as placas abriram
  plateGroups?: [number, number][][];
  spawns: Spawn[];
  regrow = new Map<string, Regrow>();
  flow: DistMap | null = null;
  flowKey = '';
  private events: GameEvent[] = [];
  id = 'local';                  // id do mapa (o servidor põe o de world.maps); entra na chave dos baús
  now: () => number = Date.now;  // relógio de parede, para o que dura entre sessões (baús)
  predicting = false;            // mundo da previsão no cliente: só a própria jogadora, o resto vem do servidor
  invasion: Invasion | null = null;
  nextInvasion = 0; invasionEvery = -1;   // tick da próxima invasão; `every` usado para agendar (reagenda se o config mudar)
  home = true;   // é o mapa principal? Quem cai fora dele renasce no principal (o servidor cuida da transferência)

  constructor(data: MapData, rules: Rules = DEFAULT_RULES, seed = 1) {
    this.map = new WorldMap(data); this.rules = rules; this.rng = new Rng(seed);
    this.spawns = data.enemies.map(s => ({ type: s.type, tx: s.x, ty: s.y, alive: null, at: 0, when: s.when }));
    this.spawns.forEach((s, i) => {
      if (inSafeZone(this, s.tx * 16 + 8, s.ty * 16 + 8) || !inPeriod(this, s)) return;   // zona segura não tem monstros; os de outro período esperam
      const e = createEnemy(this, s.type, s.tx, s.ty, i); this.enemies.push(e); s.alive = e.id;
    });
  }

  addPlayer(id: string, name: string, x = this.map.data.spawn.x, y = this.map.data.spawn.y, look?: Look) {
    const p = createPlayer(id, name, x, y, look, this.rules.player.maxHp, this.rules.player.maxMana);
    p.bag = emptyInventory(this.rules.inventory.slots);
    this.players.set(id, p);
    return p;
  }
  removePlayer(id: string) { this.players.delete(id); }
  setInput(id: string, input: InputState) {
    const p = this.players.get(id); if (!p) return;
    p.input = { ...input, tap: p.input.tap | input.tap };   // toques acumulam até o próximo passo
  }
  setTile(tx: number, ty: number, c: string) { this.map.set(tx, ty, c); this.emit({ t: 'tile', tx, ty, c }); }
  emit(e: GameEvent) { this.events.push(e); }

  // Avança um jogador com um input. O servidor usa isto para aplicar cada input exatamente uma vez,
  // igual ao que o cliente previu; quem não mandou input neste passo fica parado esperando.
  stepPlayer(id: string, input: InputState) {
    const p = this.players.get(id); if (!p) return;
    this.setInput(id, input); updatePlayer(this, p); p.input.tap = 0;
  }
  // Avança um passo (1/60 s) e devolve os eventos desse passo.
  // Com `players: false`, os jogadores já foram avançados por stepPlayer.
  // Com `life: false` (previsão no cliente), vida, mana e renascimento ficam por conta do servidor.
  step(opts: { players?: boolean; life?: boolean } = {}): GameEvent[] {
    this.tick++;
    if (opts.players !== false) for (const p of this.players.values()) { updatePlayer(this, p); p.input.tap = 0; }
    refreshFlow(this);
    for (const e of this.enemies) updateEnemy(this, e);
    separate(this);
    this.enemies = this.enemies.filter(e => !e.dead);
    updateCarried(this);
    updateThrown(this); updateArrows(this); updateSpells(this); updateBombs(this); contact(this);
    updatePortals(this);
    if (opts.life !== false) { updateLife(this); updatePvp(this); updateLoot(this); }
    updateRegrowth(this); updateSpawns(this);
    if (opts.life !== false) { updateInvasion(this); updateBlocks(this); updateExplore(this); }
    for (const p of this.players.values()) {
      const r = this.map.regionAt(p.x, p.y);
      if (r && r.id !== p.region) { p.region = r.id; this.emit({ t: 'region', to: p.id, name: r.name }); }
    }
    const out = this.events; this.events = [];
    return out;
  }
}

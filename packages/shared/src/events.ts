import type { ItemId, Rarity } from './items';
import type { ShopOffer } from './systems/shop';

// Tudo que a simulação quer que o cliente mostre ou toque. A simulação não desenha nem faz som:
// ela só emite eventos, e cada cliente decide o que exibir (normalmente só o que está perto).
// `by` marca o jogador que causou o efeito: o cliente dele já o mostrou na hora (previsão),
// então o servidor não manda de novo para ele.
export type Sfx = 'swing' | 'cut' | 'hit' | 'lift' | 'throw' | 'break' | 'splash' | 'charge' | 'spin' | 'bump' | 'poof'
  | 'sign' | 'bow' | 'step' | 'dash' | 'bonk' | 'hop' | 'land' | 'thunk' | 'down' | 'pickup' | 'levelup' | 'use' | 'chest' | 'cast' | 'bite' | 'fuse' | 'boom' | 'cluck' | 'swarm' | 'fire' | 'heal' | 'shadow' | 'scrape' | 'rare' | 'legend' | 'invite';
export type Palette = 'leaf' | 'grass' | 'rock' | 'water' | 'dust' | 'spark' | 'splinter' | 'fire' | 'heal' | 'shadow';
export interface BurstOpts { s?: number; z?: number; up?: number }

export type GameEvent =
  | { t: 'sfx'; name: Sfx; x: number; y: number; by?: string }
  | { t: 'burst'; x: number; y: number; palette: Palette; n: number; o: BurstOpts; by?: string }
  | { t: 'poof'; x: number; y: number }
  | { t: 'tile'; tx: number; ty: number; c: string }
  | { t: 'shake'; to: string; n: number; by?: string }
  | { t: 'dialog'; to: string; pages: string[]; title?: string; npc?: string; shop?: ShopOffer }   // npc: "x,y" de quem fala (ele se vira para você); shop: abre a loja ao fechar a fala
  | { t: 'region'; to: string; name: string }
  | { t: 'zone'; to: string; safe: boolean }            // entrou/saiu de zona segura
  | { t: 'kill'; by: string; victim: string }          // um jogador derrubou outro
  | { t: 'gain'; to: string; x: number; y: number; text: string }   // texto que sobe da cabeça: +5 XP, +1 Coração…
  | { t: 'levelup'; id: string; x: number; y: number; level: number }
  | { t: 'notice'; to: string; text: string }          // aviso curto só para você (inventário cheio…)
  | { t: 'portal'; id: string; to: string; arrive: string }   // jogador entrou num portal para outro mapa (o servidor transfere)
  | { t: 'gohome'; id: string }
  | { t: 'announce'; text: string }
  | { t: 'slide'; fx: number; fy: number; tx: number; ty: number; by?: string }   // bloco empurrado (o cliente anima o deslize)
  | { t: 'glow'; x: number; y: number; r: number; s: number }   // clarão do Cajado de Luz: ilumina o escuro por s segundos                    // aviso para o servidor inteiro (vira mensagem no chat)
  | { t: 'fish'; id: string; item: ItemId; size: number }
  | { t: 'found'; id: string; name: string; item: ItemId; rarity: Rarity };   // achou épico ou lendário (o servidor anuncia no chat)   // pescou (o servidor confere recordes)                       // caído fora do mapa principal: renasce lá (o servidor transfere)

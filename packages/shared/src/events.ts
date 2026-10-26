// Tudo que a simulação quer que o cliente mostre ou toque. A simulação não desenha nem faz som:
// ela só emite eventos, e cada cliente decide o que exibir (normalmente só o que está perto).
// `by` marca o jogador que causou o efeito: o cliente dele já o mostrou na hora (previsão),
// então o servidor não manda de novo para ele.
export type Sfx = 'swing' | 'cut' | 'hit' | 'lift' | 'throw' | 'break' | 'splash' | 'charge' | 'spin' | 'bump' | 'poof'
  | 'sign' | 'bow' | 'step' | 'dash' | 'bonk' | 'hop' | 'land' | 'thunk' | 'down';
export type Palette = 'leaf' | 'grass' | 'rock' | 'water' | 'dust' | 'spark' | 'splinter';
export interface BurstOpts { s?: number; z?: number; up?: number }

export type GameEvent =
  | { t: 'sfx'; name: Sfx; x: number; y: number; by?: string }
  | { t: 'burst'; x: number; y: number; palette: Palette; n: number; o: BurstOpts; by?: string }
  | { t: 'poof'; x: number; y: number }
  | { t: 'tile'; tx: number; ty: number; c: string }
  | { t: 'shake'; to: string; n: number; by?: string }
  | { t: 'dialog'; to: string; pages: string[] }
  | { t: 'region'; to: string; name: string }
  | { t: 'zone'; to: string; safe: boolean }            // entrou/saiu de zona segura
  | { t: 'kill'; by: string; victim: string };         // um jogador derrubou outro

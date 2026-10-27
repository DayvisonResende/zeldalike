/* .  grama   ,  grama densa   f flores   g mato alto (corta)   p trilha   d terra   x piso de pedra
   T  árvore  b  arbusto (corta e levanta)   r pedra (levanta)   w água   k ponte   c penhasco   s placa   o pilar
   q  chão de caverna   W parede de caverna   h entrada de caverna   u escada   t tocha (ilumina à noite)
   X  paredão rachado   Y parede de caverna rachada (bomba abre; fecham de novo com o tempo)
   j  tocha apagada (o fogo acende; acesas todas as do grupo, o portão perto abre)   G portão   I parede ilusória (a luz revela)
   B  bloco (empurra)   P placa de pressão   Q bloco em cima de placa */
export const SOLID = new Set(['T', 'b', 'r', 'w', 'c', 's', 'o', 'W', 't', 'X', 'Y', 'j', 'G', 'I', 'B', 'Q']);
export const GRASSY = new Set(['.', ',', 'f', 'g', 'T', 'b', 'r', 's']);
// Caverna: o chão em volta de pedras e arbustos vira chão de caverna (no desenho e quando se levanta uma pedra).
export const CAVE = new Set(['q', 'W', 'u', 'h']);
export function nearCave(get: (tx: number, ty: number) => string, tx: number, ty: number) {
  return CAVE.has(get(tx, ty - 1)) || CAVE.has(get(tx + 1, ty)) || CAVE.has(get(tx, ty + 1)) || CAVE.has(get(tx - 1, ty));
}
// Flechas e arremessos passam sobre a água, e a água não bloqueia a visão.
export const blocksShot = (c: string) => SOLID.has(c) && c !== 'w';

// Todos os tipos de tile, na ordem do tileset do Tiled (content/maps/tileset.png). Para criar um tipo novo,
// acrescente no fim (nunca no meio: mudaria o número dos que já estão pintados nos mapas) e rode `npm run map:tileset`.
export const TILE_KINDS = [
  { code: '.', name: 'Grama' }, { code: ',', name: 'Grama densa' }, { code: 'f', name: 'Flores' }, { code: 'g', name: 'Mato alto' },
  { code: 'p', name: 'Trilha' }, { code: 'd', name: 'Terra' }, { code: 'x', name: 'Piso de pedra' },
  { code: 'T', name: 'Árvore' }, { code: 'b', name: 'Arbusto' }, { code: 'r', name: 'Pedra' },
  { code: 'w', name: 'Água' }, { code: 'k', name: 'Ponte' }, { code: 'c', name: 'Penhasco' }, { code: 's', name: 'Placa' }, { code: 'o', name: 'Pilar' },
  { code: 'q', name: 'Chão de caverna' }, { code: 'W', name: 'Parede de caverna' }, { code: 'h', name: 'Entrada de caverna' }, { code: 'u', name: 'Escada' },
  { code: 't', name: 'Tocha' }, { code: 'X', name: 'Paredão rachado' }, { code: 'Y', name: 'Parede de caverna rachada' },
  { code: 'j', name: 'Tocha apagada' }, { code: 'G', name: 'Portão' }, { code: 'I', name: 'Parede ilusória' },
  { code: 'B', name: 'Bloco (empurra)' }, { code: 'P', name: 'Placa de pressão' }, { code: 'Q', name: 'Bloco na placa' }
] as const;

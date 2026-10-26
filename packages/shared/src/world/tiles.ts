/* .  grama   ,  grama densa   f flores   g mato alto (corta)   p trilha   d terra   x piso de pedra
   T  árvore  b  arbusto (corta e levanta)   r pedra (levanta)   w água   k ponte   c penhasco   s placa   o pilar */
export const SOLID = new Set(['T', 'b', 'r', 'w', 'c', 's', 'o']);
export const GRASSY = new Set(['.', ',', 'f', 'g', 'T', 'b', 'r', 's']);
// Flechas e arremessos passam sobre a água, e a água não bloqueia a visão.
export const blocksShot = (c: string) => SOLID.has(c) && c !== 'w';

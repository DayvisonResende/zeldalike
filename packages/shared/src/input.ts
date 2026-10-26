export type Button = 'a' | 'b' | 'c' | 'd';   // a espada, b levantar/ler, c arco, d dash
export const BUTTON: Record<Button, number> = { a: 1, b: 2, c: 4, d: 8 };

// O que um jogador manda a cada passo. `tap` marca botões apertados desde o último envio,
// para um toque rápido não se perder entre dois passos.
export interface InputState {
  up: boolean; down: boolean; left: boolean; right: boolean;
  a: boolean; b: boolean; c: boolean; d: boolean;
  tap: number;
  aim: number | null;   // ângulo da mira do mouse; null = segue a direção do personagem
}
export function emptyInput(): InputState {
  return { up: false, down: false, left: false, right: false, a: false, b: false, c: false, d: false, tap: 0, aim: null };
}

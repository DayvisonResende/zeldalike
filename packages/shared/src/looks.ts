// Aparência escolhida por cada jogador. Viaja pela rede só como índices nas paletas.
export interface Look { cloak: number; hair: number }
export interface Profile { id: string; name: string; look: Look }

export const CLOAKS = [
  { name: 'Turquesa', base: '#2f8f9b', dark: '#1d5d69', light: '#5cbcc3' },
  { name: 'Carmim', base: '#b8434a', dark: '#7d2a33', light: '#e07a76' },
  { name: 'Floresta', base: '#4f8f3a', dark: '#2f5f25', light: '#84c063' },
  { name: 'Real', base: '#3d5fc0', dark: '#283f86', light: '#7393e6' },
  { name: 'Ameixa', base: '#7f4aa8', dark: '#532f73', light: '#ad7fd6' },
  { name: 'Âmbar', base: '#c98a2e', dark: '#8a5a1a', light: '#ecb860' },
  { name: 'Grafite', base: '#4a4f5c', dark: '#2e323b', light: '#7a8090' },
  { name: 'Neve', base: '#d9dce6', dark: '#9da2b3', light: '#f4f6fb' }
] as const;
export const HAIRS = [
  { name: 'Ameixa', base: '#3d2552', light: '#6a4386' },
  { name: 'Castanho', base: '#5a3a24', light: '#8a5d3a' },
  { name: 'Preto', base: '#22202a', light: '#4a4656' },
  { name: 'Ruivo', base: '#a8471f', light: '#d6713e' },
  { name: 'Loiro', base: '#c99a3c', light: '#edcc72' },
  { name: 'Grisalho', base: '#8d8a94', light: '#bdbac4' },
  { name: 'Rosa', base: '#c4537e', light: '#e889ad' },
  { name: 'Azul', base: '#2f5a9e', light: '#5a86c9' }
] as const;
export const DEFAULT_LOOK: Look = { cloak: 0, hair: 0 };
export const NAME_MAX = 16;

// Nome: letras (com acento), números, espaço, _ e -. Vazio vira "Viajante".
export function cleanName(raw: unknown) {
  const s = typeof raw === 'string' ? raw.replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim() : '';
  return s || 'Viajante';
}
export function cleanLook(raw: unknown): Look {
  const r = (raw ?? {}) as Partial<Record<keyof Look, unknown>>;
  const idx = (v: unknown, n: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? v as number : 0;
  return { cloak: idx(r.cloak, CLOAKS.length), hair: idx(r.hair, HAIRS.length) };
}

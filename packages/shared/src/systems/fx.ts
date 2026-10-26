import type { BurstOpts, Palette, Sfx } from '../events';
import type { World } from '../world';

// `by` só entra quando existe, para não viajar um campo vazio pela rede.
export const sfx = (w: World, name: Sfx, at: { x: number; y: number }, by?: string) => w.emit(by ? { t: 'sfx', name, x: at.x, y: at.y, by } : { t: 'sfx', name, x: at.x, y: at.y });
export const burst = (w: World, x: number, y: number, palette: Palette, n: number, o: BurstOpts = {}, by?: string) => w.emit(by ? { t: 'burst', x, y, palette, n, o, by } : { t: 'burst', x, y, palette, n, o });

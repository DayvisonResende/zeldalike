import { DEFAULT_LOOK, cleanLook, cleanName, type ProfileRequest } from '@vale/shared';

// Preferências deste navegador: o seu personagem e as opções de exibição.
export type NameMode = 'all' | 'others' | 'none';
export type PadSize = 's' | 'm' | 'l';
export interface Settings { names: NameMode; bubbles: boolean; sound: boolean; paths: boolean; padSize: PadSize; vibrate: boolean; aimAssist: boolean; minimap: boolean }
const DEFAULTS: Settings = { names: 'all', bubbles: true, sound: true, paths: false, padSize: 'm', vibrate: true, aimAssist: true, minimap: true };

function read<T>(key: string): Partial<T> | null {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function write(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { } }

export function loadProfile(): ProfileRequest {
  const saved = read<ProfileRequest>('vale.perfil');
  if (saved) return { name: cleanName(saved.name), look: cleanLook(saved.look) };
  let old: string | null = null;
  try { old = localStorage.getItem('vale.nome'); } catch { }   // nome guardado pela versão anterior
  const p = { name: cleanName(old || 'Viajante ' + (100 + ((Math.random() * 900) | 0))), look: { ...DEFAULT_LOOK } };
  saveProfile(p);
  return p;
}
export const saveProfile = (p: ProfileRequest) => write('vale.perfil', p);

export function loadSettings(): Settings {
  const s = read<Settings>('vale.opcoes') ?? {};
  return {
    names: s.names === 'others' || s.names === 'none' ? s.names : DEFAULTS.names,
    bubbles: typeof s.bubbles === 'boolean' ? s.bubbles : DEFAULTS.bubbles,
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULTS.sound,
    paths: typeof s.paths === 'boolean' ? s.paths : DEFAULTS.paths,
    padSize: s.padSize === 's' || s.padSize === 'l' ? s.padSize : DEFAULTS.padSize,
    vibrate: typeof s.vibrate === 'boolean' ? s.vibrate : DEFAULTS.vibrate,
    aimAssist: typeof s.aimAssist === 'boolean' ? s.aimAssist : DEFAULTS.aimAssist,
    minimap: typeof s.minimap === 'boolean' ? s.minimap : DEFAULTS.minimap
  };
}
export const saveSettings = (s: Settings) => write('vale.opcoes', s);
// Nomes ignorados no chat (em minúsculas).
export function loadIgnored() { const v = read<string[]>('vale.ignorados'); return new Set(Array.isArray(v) ? v.filter(n => typeof n === 'string') : []); }
export const saveIgnored = (s: Set<string>) => write('vale.ignorados', [...s]);

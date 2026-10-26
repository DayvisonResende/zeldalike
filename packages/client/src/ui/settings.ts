import { DEFAULT_LOOK, cleanLook, cleanName, type ProfileRequest } from '@vale/shared';

// Preferências deste navegador: o seu personagem e as opções de exibição.
export type NameMode = 'all' | 'others' | 'none';
export interface Settings { names: NameMode; bubbles: boolean; sound: boolean; paths: boolean }
const DEFAULTS: Settings = { names: 'all', bubbles: true, sound: true, paths: false };

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
    paths: typeof s.paths === 'boolean' ? s.paths : DEFAULTS.paths
  };
}
export const saveSettings = (s: Settings) => write('vale.opcoes', s);

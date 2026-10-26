import type { Config } from './schema';

// Configuração atual, compartilhada pelo servidor. Quem precisa reagir a mudanças se inscreve.
let current: Config | null = null;
const subs = new Set<(c: Config) => void>();
export function getConfig() { if (!current) throw new Error('config ainda não carregada'); return current; }
export function setConfig(c: Config) { current = c; for (const f of subs) f(c); }
export function onConfig(f: (c: Config) => void) { subs.add(f); return () => subs.delete(f); }

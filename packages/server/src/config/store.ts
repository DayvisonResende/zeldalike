import path from 'node:path';
import type { Config } from './schema';

// Pasta do arquivo de config: caminhos do config (banco, backups) são relativos a ela.
let baseDir = process.cwd(), file = '';
export function setConfigDir(dir: string) { baseDir = dir; }
export function setConfigFile(f: string) { file = f; setConfigDir(path.dirname(f)); }
export const configFile = () => file;   // o config.yaml em uso (a Oficina grava nele)
export const configPath = (p: string) => path.resolve(baseDir, p);

// Configuração atual, compartilhada pelo servidor. Quem precisa reagir a mudanças se inscreve.
let current: Config | null = null;
const subs = new Set<(c: Config) => void>();
export function getConfig() { if (!current) throw new Error('config ainda não carregada'); return current; }
export function setConfig(c: Config) { current = c; for (const f of subs) f(c); }
export function onConfig(f: (c: Config) => void) { subs.add(f); return () => subs.delete(f); }

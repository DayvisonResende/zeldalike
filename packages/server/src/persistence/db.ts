import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { migrations } from './migrations';
import type { DB } from './schema';

export type Db = Kysely<DB>;

// Abre (ou cria) o arquivo do banco e aplica as migrações pendentes. ':memory:' serve para testes.
export async function openDatabase(file: string): Promise<Db> {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');   // leituras não esperam as escritas
  sqlite.pragma('foreign_keys = ON');
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  const { error, results } = await new Migrator({ db, provider: { getMigrations: async () => migrations } }).migrateToLatest();
  for (const r of results ?? []) if (r.status === 'Success') console.log(`[banco] migração aplicada: ${r.migrationName}`);
  if (error) throw error;
  return db;
}

// Banco atual do servidor (aberto uma vez na partida).
let current: Db | null = null;
export function setDb(db: Db) { current = db; }
export function getDb() { if (!current) throw new Error('banco ainda não aberto'); return current; }
